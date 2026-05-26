use std::sync::Arc;

use axum::{
    Json,
    body::Body,
    extract::State,
    http::{StatusCode, header},
    response::Response,
};
use bytes::Bytes;
use futures_util::StreamExt;
use reqwest::Client;
use sea_orm::{ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tower_cookies::Cookies;

use crate::{
    app_state::AppState,
    config::AppConfig,
    db::entities::{app_settings, model_configs, provider_configs, user_settings},
    http_error::HttpError,
    support::crypto::decrypt_provider_api_key,
};

const DEFAULT_OPENAI_BASE_URL: &str = "https://api.openai.com/v1/";
const DEFAULT_CHAT_SYSTEM_PROMPT: &str = "You are a helpful assistant.";
const TITLE_SYSTEM_PROMPT: &str = "Generate a short title for the conversation. Return only the title, with no explanation and no surrounding quotes. Use the same language as the conversation when possible. Keep it concise: 3 to 8 words, maximum 60 characters.";
const MODEL_PROVIDER_USER_AGENT: &str = concat!("litechat/", env!("CARGO_PKG_VERSION"));

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateChatRequest {
    pub model_config_id: String,
    pub messages: Vec<ChatRequestMessage>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateChatTitleRequest {
    pub fallback_model_config_id: String,
    pub messages: Vec<ChatRequestMessage>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ChatRequestMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Serialize)]
pub struct ChatTitleResponse {
    pub title: String,
}

#[derive(Clone)]
struct ChatModelTarget {
    model_id: String,
    base_url: Option<String>,
    api_key: String,
    supports_web_search: bool,
}

#[derive(Serialize)]
struct ResponsesRequestBody {
    model: String,
    input: Vec<Value>,
    stream: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    tools: Option<Vec<Value>>,
}

#[derive(Clone)]
pub struct ChatService {
    database: DatabaseConnection,
    config: Arc<AppConfig>,
}

impl ChatService {
    pub fn new(database: DatabaseConnection, config: Arc<AppConfig>) -> Self {
        Self { database, config }
    }

    pub async fn chat(
        &self,
        user_id: &str,
        payload: CreateChatRequest,
    ) -> Result<Response, HttpError> {
        validate_messages(&payload.messages)?;

        let model = self
            .resolve_chat_model(&payload.model_config_id, false)
            .await?;
        let personalization = self.get_personalization(user_id).await?;
        let mut messages = payload.messages;
        messages.insert(
            0,
            ChatRequestMessage {
                role: "system".to_string(),
                content: build_chat_system_prompt(&personalization),
            },
        );

        let upstream = build_responses_request(&model, messages, true);
        let response = Client::new()
            .post(build_responses_url(model.base_url.as_deref()))
            .bearer_auth(model.api_key)
            .header(header::USER_AGENT, MODEL_PROVIDER_USER_AGENT)
            .json(&upstream)
            .send()
            .await
            .map_err(|_| {
                HttpError::new(
                    StatusCode::BAD_GATEWAY,
                    "The model provider request failed.",
                    Some("upstream_request_failed".to_string()),
                )
            })?;

        if !response.status().is_success() {
            return Err(HttpError::new(
                StatusCode::BAD_GATEWAY,
                format!(
                    "The model provider request failed with status {}.",
                    response.status()
                ),
                Some("upstream_request_failed".to_string()),
            ));
        }

        let stream = response.bytes_stream().map(|chunk| {
            chunk
                .map(|bytes| filter_sse_text_deltas(&bytes))
                .map_err(std::io::Error::other)
        });

        Response::builder()
            .status(StatusCode::OK)
            .header(header::CACHE_CONTROL, "no-store")
            .header(header::CONTENT_TYPE, "text/plain; charset=utf-8")
            .body(Body::from_stream(stream))
            .map_err(|_| {
                HttpError::new(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Failed to build response.",
                    None,
                )
            })
    }

    pub async fn chat_title(
        &self,
        payload: CreateChatTitleRequest,
    ) -> Result<ChatTitleResponse, HttpError> {
        validate_messages(&payload.messages)?;

        let configured_model_id = app_settings::Entity::find_by_id(1)
            .one(&self.database)
            .await
            .map_err(internal_error)?
            .and_then(|item| item.title_generation_model_config_id);

        let model = if let Some(model_id) = configured_model_id {
            self.resolve_chat_model(&model_id, true).await.unwrap_or(
                self.resolve_chat_model(&payload.fallback_model_config_id, false)
                    .await?,
            )
        } else {
            self.resolve_chat_model(&payload.fallback_model_config_id, false)
                .await?
        };

        let mut messages = vec![ChatRequestMessage {
            role: "system".to_string(),
            content: TITLE_SYSTEM_PROMPT.to_string(),
        }];
        messages.extend(
            payload
                .messages
                .into_iter()
                .map(|message| ChatRequestMessage {
                    role: message.role,
                    content: message.content.chars().take(4000).collect(),
                }),
        );

        let upstream = build_responses_request(&model, messages, true);
        let response = Client::new()
            .post(build_responses_url(model.base_url.as_deref()))
            .bearer_auth(model.api_key)
            .header(header::USER_AGENT, MODEL_PROVIDER_USER_AGENT)
            .json(&upstream)
            .send()
            .await
            .map_err(|_| {
                HttpError::new(
                    StatusCode::BAD_GATEWAY,
                    "The model provider request failed.",
                    Some("upstream_request_failed".to_string()),
                )
            })?;

        if !response.status().is_success() {
            return Err(HttpError::new(
                StatusCode::BAD_GATEWAY,
                "The model provider request failed.",
                Some("upstream_request_failed".to_string()),
            ));
        }

        let body = response.text().await.map_err(|_| {
            HttpError::new(
                StatusCode::BAD_GATEWAY,
                "The model provider returned an invalid response.",
                Some("upstream_response_invalid".to_string()),
            )
        })?;
        let title = sanitize_generated_title(&collect_sse_text(&body));

        if title.is_empty() {
            return Err(HttpError::new(
                StatusCode::BAD_GATEWAY,
                "The model did not return a title.",
                Some("empty_title".to_string()),
            ));
        }

        Ok(ChatTitleResponse { title })
    }

    async fn resolve_chat_model(
        &self,
        model_config_id: &str,
        allow_hidden: bool,
    ) -> Result<ChatModelTarget, HttpError> {
        let model_config = model_configs::Entity::find_by_id(model_config_id.to_string())
            .one(&self.database)
            .await
            .map_err(internal_error)?
            .ok_or_else(|| {
                HttpError::new(
                    StatusCode::NOT_FOUND,
                    "The selected model could not be found.",
                    Some("model_config_not_found".to_string()),
                )
            })?;

        if !allow_hidden && !model_config.visible {
            return Err(HttpError::new(
                StatusCode::CONFLICT,
                "The selected model is not available.",
                Some("model_not_available".to_string()),
            ));
        }

        let provider_config =
            provider_configs::Entity::find_by_id(model_config.provider_config_id.clone())
                .one(&self.database)
                .await
                .map_err(internal_error)?
                .ok_or_else(|| {
                    HttpError::new(
                        StatusCode::NOT_FOUND,
                        "The selected model provider could not be found.",
                        Some("provider_config_not_found".to_string()),
                    )
                })?;

        if !provider_config.enabled {
            return Err(HttpError::new(
                StatusCode::CONFLICT,
                "The selected model provider is not available.",
                Some("provider_not_available".to_string()),
            ));
        }

        if provider_config.provider_type != "openai-responses" {
            return Err(HttpError::new(
                StatusCode::CONFLICT,
                "The selected model provider is not supported.",
                Some("unsupported_provider".to_string()),
            ));
        }

        let api_key = decrypt_provider_api_key(&self.config, &provider_config.api_key_encrypted)
            .map_err(|message| {
                HttpError::new(
                    StatusCode::BAD_REQUEST,
                    message,
                    Some("invalid_request".to_string()),
                )
            })?;

        Ok(ChatModelTarget {
            model_id: model_config.model_id,
            base_url: provider_config.base_url,
            api_key,
            supports_web_search: model_config.supports_web_search,
        })
    }

    async fn get_personalization(&self, user_id: &str) -> Result<String, HttpError> {
        Ok(user_settings::Entity::find()
            .filter(user_settings::Column::UserId.eq(user_id.to_string()))
            .one(&self.database)
            .await
            .map_err(internal_error)?
            .map(|item| item.personalization.trim().to_string())
            .unwrap_or_default())
    }
}

pub async fn chat(
    State(state): State<AppState>,
    cookies: Cookies,
    Json(payload): Json<CreateChatRequest>,
) -> Result<Response, HttpError> {
    let user = state.auth_service.require_current_user(&cookies).await?;
    state.chat_service.chat(&user.user_id, payload).await
}

pub async fn chat_title(
    State(state): State<AppState>,
    cookies: Cookies,
    Json(payload): Json<CreateChatTitleRequest>,
) -> Result<Json<ChatTitleResponse>, HttpError> {
    let _ = state.auth_service.require_current_user(&cookies).await?;
    Ok(Json(state.chat_service.chat_title(payload).await?))
}

fn validate_messages(messages: &[ChatRequestMessage]) -> Result<(), HttpError> {
    if messages.is_empty() {
        return Err(HttpError::new(
            StatusCode::BAD_REQUEST,
            "messages must be a non-empty array.",
            Some("invalid_request".to_string()),
        ));
    }

    for message in messages {
        if message.content.trim().is_empty() {
            return Err(HttpError::new(
                StatusCode::BAD_REQUEST,
                "messages[].content must be a non-empty string.",
                Some("invalid_request".to_string()),
            ));
        }
        match message.role.as_str() {
            "system" | "user" | "assistant" | "tool" => {}
            _ => {
                return Err(HttpError::new(
                    StatusCode::BAD_REQUEST,
                    "messages[].role must be one of system, user, assistant, or tool.",
                    Some("invalid_request".to_string()),
                ));
            }
        }
    }

    Ok(())
}

fn build_responses_request(
    model: &ChatModelTarget,
    messages: Vec<ChatRequestMessage>,
    stream: bool,
) -> ResponsesRequestBody {
    let tools = if model.supports_web_search {
        Some(vec![serde_json::json!({ "type": "web_search" })])
    } else {
        None
    };

    ResponsesRequestBody {
        model: model.model_id.clone(),
        input: messages
            .into_iter()
            .map(|message| {
                let content_type = if message.role == "assistant" {
                    "output_text"
                } else {
                    "input_text"
                };
                serde_json::json!({
                    "role": message.role,
                    "content": [{ "type": content_type, "text": message.content }]
                })
            })
            .collect(),
        stream,
        tools,
    }
}

fn build_responses_url(base_url: Option<&str>) -> String {
    let base = base_url.unwrap_or(DEFAULT_OPENAI_BASE_URL);
    let normalized = if base.ends_with('/') {
        base.to_string()
    } else {
        format!("{base}/")
    };
    format!("{}responses", normalized)
}

fn build_chat_system_prompt(personalization: &str) -> String {
    let personalization = personalization.trim();

    if personalization.is_empty() {
        return DEFAULT_CHAT_SYSTEM_PROMPT.to_string();
    }

    format!("{DEFAULT_CHAT_SYSTEM_PROMPT}\n\n{personalization}")
}

fn filter_sse_text_deltas(bytes: &[u8]) -> Bytes {
    Bytes::from(collect_sse_text(&String::from_utf8_lossy(bytes)))
}

fn collect_sse_text(body: &str) -> String {
    let mut output = String::new();

    for raw_event in body.split("\n\n") {
        let data_lines = raw_event
            .lines()
            .filter_map(|line| line.strip_prefix("data:"))
            .map(str::trim_start)
            .collect::<Vec<_>>();

        if data_lines.is_empty() {
            continue;
        }

        let payload = data_lines.join("\n");
        if payload == "[DONE]" {
            continue;
        }

        let Ok(json) = serde_json::from_str::<Value>(&payload) else {
            continue;
        };

        if json.get("type").and_then(Value::as_str) == Some("response.output_text.delta") {
            if let Some(delta) = json.get("delta").and_then(Value::as_str) {
                output.push_str(delta);
            }
        }
    }

    output
}

fn sanitize_generated_title(value: &str) -> String {
    let first_line = value.trim().lines().next().unwrap_or("");
    let normalized = first_line.split_whitespace().collect::<Vec<_>>().join(" ");
    normalized
        .trim_matches(|character| matches!(character, '"' | '\'' | '“' | '”' | '‘' | '’'))
        .chars()
        .take(60)
        .collect::<String>()
        .trim()
        .to_string()
}

fn internal_error(error: sea_orm::DbErr) -> HttpError {
    HttpError::internal(format!("Database error: {error}"))
}
