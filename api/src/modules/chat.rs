use std::{collections::{HashMap, HashSet, VecDeque}, sync::Arc};

use axum::{
    Json,
    body::Body,
    extract::State,
    http::{StatusCode, header},
    response::Response,
};
use base64::{Engine as _, engine::general_purpose};
use bytes::Bytes;
use futures_util::{StreamExt, stream::{self, BoxStream}};
use reqwest::Client;
use sea_orm::{ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tower_cookies::Cookies;
use uuid::Uuid;

use crate::{
    app_state::AppState,
    config::AppConfig,
    db::entities::{app_settings, model_configs, provider_configs, user_settings},
    http_error::HttpError,
    modules::files::{FileAttachmentPayload, FilesService, GeneratedFileInput},
    support::crypto::decrypt_provider_api_key,
};

const DEFAULT_OPENAI_BASE_URL: &str = "https://api.openai.com/v1/";
const DEFAULT_CHAT_SYSTEM_PROMPT: &str = "You are a helpful assistant.";
const ATTACHMENTS_SYSTEM_PROMPT: &str = "User messages may begin with an <attachments> block. Each <file> entry describes a user-uploaded file and includes its URL. Treat the text after the attachments block as the user's message. Use the files when the model can access and understand them.";
const TITLE_USER_PROMPT: &str = "Create a concise conversation title for the chat history above.\n\nThe title will be displayed in the chat sidebar as the conversation name. It should summarize the user's main topic or task, not answer the latest message.\n\nRequirements:\n- Return only the title.\n- Use plain text only.\n- Do not use Markdown, backticks, bold, italic, bullets, quotes, or code formatting.\n- Use the same language as the conversation when possible.\n- Keep it specific and readable.\n- Keep it 3 to 8 words and no more than 60 characters.";
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
    #[serde(default)]
    pub attachments: Vec<ChatRequestAttachment>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatRequestAttachment {
    pub id: String,
    pub name: String,
    pub mime_type: String,
    pub size: u64,
    pub url: String,
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
    supports_image_generation: bool,
}

impl ChatModelTarget {
    fn without_tools(&self) -> Self {
        Self {
            model_id: self.model_id.clone(),
            base_url: self.base_url.clone(),
            api_key: self.api_key.clone(),
            supports_web_search: false,
            supports_image_generation: false,
        }
    }
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
    files_service: FilesService,
}

impl ChatService {
    pub fn new(database: DatabaseConnection, config: Arc<AppConfig>, files_service: FilesService) -> Self {
        Self { database, config, files_service }
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
        let mut messages = render_message_attachments(payload.messages)?;
        messages.insert(
            0,
            ChatRequestMessage {
                role: "system".to_string(),
                content: build_chat_system_prompt(&personalization),
                attachments: Vec::new(),
            },
        );

        let upstream = build_responses_request(&model, messages, true, true);
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

        let stream = build_chat_response_stream(response.bytes_stream().boxed(), self.files_service.clone());

        Response::builder()
            .status(StatusCode::OK)
            .header(header::CACHE_CONTROL, "no-store")
            .header("X-Accel-Buffering", "no")
            .header(header::CONTENT_TYPE, "application/x-ndjson; charset=utf-8")
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
        user_id: &str,
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

        let personalization = self.get_personalization(user_id).await?;
        let mut messages = vec![ChatRequestMessage {
            role: "system".to_string(),
            content: build_chat_system_prompt(&personalization),
            attachments: Vec::new(),
        }];
        messages.extend(
            payload
                .messages
                .into_iter()
                .map(|message| ChatRequestMessage {
                    role: message.role,
                    content: message.content.chars().take(4000).collect(),
                    attachments: Vec::new(),
                }),
        );
        messages.push(ChatRequestMessage {
            role: "user".to_string(),
            content: TITLE_USER_PROMPT.to_string(),
            attachments: Vec::new(),
        });

        let upstream = build_responses_request(&model.without_tools(), messages, true, false);
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
            supports_image_generation: model_config.supports_image_generation,
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
    let user = state.auth_service.require_current_user(&cookies).await?;
    Ok(Json(
        state
            .chat_service
            .chat_title(&user.user_id, payload)
            .await?,
    ))
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

        for attachment in &message.attachments {
            if attachment.id.trim().is_empty() {
                return Err(HttpError::new(
                    StatusCode::BAD_REQUEST,
                    "messages[].attachments[].id must be a non-empty string.",
                    Some("invalid_request".to_string()),
                ));
            }
            if attachment.name.trim().is_empty()
                || attachment.mime_type.trim().is_empty()
                || attachment.url.trim().is_empty()
                || attachment.size == 0
            {
                return Err(HttpError::new(
                    StatusCode::BAD_REQUEST,
                    "messages[].attachments[] must include name, mimeType, size, and url.",
                    Some("invalid_request".to_string()),
                ));
            }
        }
    }

    Ok(())
}

fn render_message_attachments(
    messages: Vec<ChatRequestMessage>,
) -> Result<Vec<ChatRequestMessage>, HttpError> {
    messages
        .into_iter()
        .map(render_message_attachment_block)
        .collect()
}

fn render_message_attachment_block(
    mut message: ChatRequestMessage,
) -> Result<ChatRequestMessage, HttpError> {
    if message.attachments.is_empty() {
        return Ok(message);
    }

    let mut block = String::from("<attachments>\n");
    for attachment in &message.attachments {
        block.push_str("  <file>\n");
        block.push_str(&format!(
            "    <name>{}</name>\n",
            escape_xml_text(&attachment.name)
        ));
        block.push_str(&format!(
            "    <mime_type>{}</mime_type>\n",
            escape_xml_text(&attachment.mime_type)
        ));
        block.push_str(&format!(
            "    <size_bytes>{}</size_bytes>\n",
            attachment.size
        ));
        block.push_str(&format!(
            "    <url>{}</url>\n",
            escape_xml_text(&attachment.url)
        ));
        block.push_str("  </file>\n");
    }
    block.push_str("</attachments>\n\n");
    block.push_str(&message.content);

    message.content = block;
    message.attachments.clear();
    Ok(message)
}

fn build_responses_request(
    model: &ChatModelTarget,
    messages: Vec<ChatRequestMessage>,
    stream: bool,
    include_image_generation: bool,
) -> ResponsesRequestBody {
    let mut tools = Vec::new();

    if model.supports_web_search {
        tools.push(serde_json::json!({ "type": "web_search" }));
    }

    if include_image_generation && model.supports_image_generation {
        tools.push(serde_json::json!({ "type": "image_generation" }));
    }

    let tools = if tools.is_empty() {
        None
    } else {
        Some(tools)
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

#[derive(Debug, Serialize)]
#[serde(tag = "type", rename_all = "snake_case", rename_all_fields = "camelCase")]
enum ChatStreamEvent {
    PartAdded { part: ChatStreamPart },
    TextDelta { part_id: String, delta: String },
    ImageCompleted { part_id: String, image: FileAttachmentPayload, revised_prompt: Option<String> },
    ImageFailed { part_id: String, message: String },
    Done,
    Error { code: String, message: String },
}

#[derive(Debug, Serialize, Clone)]
#[serde(tag = "type", rename_all = "snake_case")]
enum ChatStreamPart {
    Text { id: String, text: String },
    Image { id: String, status: String },
}

struct ChatStreamState {
    upstream: BoxStream<'static, Result<Bytes, reqwest::Error>>,
    parser: SseParser,
    pending: VecDeque<Result<Bytes, std::io::Error>>,
    mapper: ResponsePartMapper,
    files_service: FilesService,
    finished: bool,
}

#[derive(Default)]
struct SseParser {
    buffer: String,
}

#[derive(Default)]
struct ResponsePartMapper {
    text_parts_by_output_index: HashMap<usize, String>,
    image_parts_by_output_index: HashMap<usize, String>,
    image_parts_by_item_id: HashMap<String, String>,
    completed_image_item_ids: HashSet<String>,
}

fn build_chat_response_stream(
    upstream: BoxStream<'static, Result<Bytes, reqwest::Error>>,
    files_service: FilesService,
) -> impl futures_util::Stream<Item = Result<Bytes, std::io::Error>> {
    stream::unfold(
        ChatStreamState {
            upstream,
            parser: SseParser::default(),
            pending: VecDeque::new(),
            mapper: ResponsePartMapper::default(),
            files_service,
            finished: false,
        },
        |mut state| async move {
            loop {
                if let Some(event) = state.pending.pop_front() {
                    return Some((event, state));
                }

                if state.finished {
                    return None;
                }

                let Some(chunk) = state.upstream.next().await else {
                    let events = state.parser.finish();
                    for event in events {
                        let next = handle_upstream_event(&mut state.mapper, &state.files_service, event).await;
                        if next.iter().any(|event| matches!(event, ChatStreamEvent::Done)) {
                            state.finished = true;
                        }
                        state.pending.extend(next.into_iter().map(|event| to_ndjson_bytes(&event)));
                    }

                    if !state.pending.is_empty() {
                        continue;
                    }

                    for event in state.mapper.finish_unresolved_images() {
                        state.pending.push_back(to_ndjson_bytes(&event));
                    }

                    state.pending.push_back(to_ndjson_bytes(&ChatStreamEvent::Done));
                    state.finished = true;
                    continue;
                };

                let chunk = match chunk {
                    Ok(bytes) => bytes,
                    Err(error) => {
                        state.pending.push_back(to_ndjson_bytes(&ChatStreamEvent::Error {
                            code: "upstream_stream_failed".to_string(),
                            message: error.to_string(),
                        }));
                        state.finished = true;
                        continue;
                    }
                };

                let events = state.parser.push_bytes(&chunk);
                for event in events {
                    let next = handle_upstream_event(&mut state.mapper, &state.files_service, event).await;
                    if next.iter().any(|event| matches!(event, ChatStreamEvent::Done)) {
                        state.finished = true;
                    }
                    state.pending.extend(next.into_iter().map(|event| to_ndjson_bytes(&event)));
                }
            }
        },
    )
}

impl SseParser {
    fn push_bytes(&mut self, bytes: &[u8]) -> Vec<Value> {
        self.buffer
            .push_str(&String::from_utf8_lossy(bytes).replace("\r\n", "\n"));

        let mut events = Vec::new();
        while let Some(index) = self.buffer.find("\n\n") {
            let raw_event = self.buffer[..index].to_string();
            self.buffer.drain(..index + 2);
            events.extend(self.parse_raw_event(&raw_event));
        }

        events
    }

    fn finish(&mut self) -> Vec<Value> {
        if self.buffer.trim().is_empty() {
            self.buffer.clear();
            return Vec::new();
        }

        let remaining = std::mem::take(&mut self.buffer);
        self.parse_raw_event(&remaining)
    }

    fn parse_raw_event(&self, raw_event: &str) -> Vec<Value> {
        let data_lines = raw_event
            .lines()
            .filter_map(|line| line.strip_prefix("data:"))
            .map(str::trim_start)
            .collect::<Vec<_>>();

        if data_lines.is_empty() {
            return Vec::new();
        }

        let payload = data_lines.join("\n");
        if payload == "[DONE]" {
            return Vec::new();
        }

        serde_json::from_str::<Value>(&payload)
            .map(|value| vec![value])
            .unwrap_or_default()
    }
}

async fn handle_upstream_event(
    mapper: &mut ResponsePartMapper,
    files_service: &FilesService,
    event: Value,
) -> Vec<ChatStreamEvent> {
    match event.get("type").and_then(Value::as_str) {
        Some("response.output_item.added") => handle_output_item_added(mapper, &event),
        Some("response.output_item.done") => handle_output_item_done(mapper, files_service, &event).await,
        Some("response.output_text.delta") => handle_output_text_delta(mapper, &event),
        Some("response.completed") => handle_response_completed(mapper, files_service, &event).await,
        Some("response.failed") => vec![ChatStreamEvent::Error {
            code: "upstream_request_failed".to_string(),
            message: "The model provider could not complete the request.".to_string(),
        }],
        Some("error") => vec![ChatStreamEvent::Error {
            code: event.get("code").and_then(Value::as_str).unwrap_or("upstream_request_failed").to_string(),
            message: event.get("message").and_then(Value::as_str).unwrap_or("The model provider could not complete the request.").to_string(),
        }],
        _ => Vec::new(),
    }
}

async fn handle_output_item_done(
    mapper: &mut ResponsePartMapper,
    files_service: &FilesService,
    event: &Value,
) -> Vec<ChatStreamEvent> {
    let output_index = event.get("output_index").and_then(Value::as_u64).map(|value| value as usize).unwrap_or(0);
    let item = event.get("item").unwrap_or(event);

    if item.get("type").and_then(Value::as_str) != Some("image_generation_call") {
        return Vec::new();
    }

    handle_completed_image_item(mapper, files_service, output_index, item).await
}

fn handle_output_item_added(mapper: &mut ResponsePartMapper, event: &Value) -> Vec<ChatStreamEvent> {
    let output_index = event.get("output_index").and_then(Value::as_u64).map(|value| value as usize);
    let item = event.get("item").unwrap_or(event);
    match item.get("type").and_then(Value::as_str) {
        Some("message") => {
            let part_id = create_part_id();
            if let Some(index) = output_index {
                mapper.text_parts_by_output_index.insert(index, part_id.clone());
            }
            vec![ChatStreamEvent::PartAdded { part: ChatStreamPart::Text { id: part_id, text: String::new() } }]
        }
        Some("image_generation_call") => {
            let part_id = create_part_id();
            if let Some(index) = output_index {
                mapper.image_parts_by_output_index.insert(index, part_id.clone());
            }
            if let Some(item_id) = item.get("id").and_then(Value::as_str) {
                mapper.image_parts_by_item_id.insert(item_id.to_string(), part_id.clone());
            }
            vec![ChatStreamEvent::PartAdded { part: ChatStreamPart::Image { id: part_id, status: "generating".to_string() } }]
        }
        _ => Vec::new(),
    }
}

fn handle_output_text_delta(mapper: &mut ResponsePartMapper, event: &Value) -> Vec<ChatStreamEvent> {
    let Some(delta) = event.get("delta").and_then(Value::as_str) else {
        return Vec::new();
    };
    let output_index = event.get("output_index").and_then(Value::as_u64).map(|value| value as usize).unwrap_or(0);
    let (part_id, should_add_part) = match mapper.text_parts_by_output_index.get(&output_index) {
        Some(part_id) => (part_id.clone(), false),
        None => {
            let part_id = create_part_id();
            mapper.text_parts_by_output_index.insert(output_index, part_id.clone());
            (part_id, true)
        }
    };

    let mut events = Vec::new();
    if should_add_part {
        events.push(ChatStreamEvent::PartAdded { part: ChatStreamPart::Text { id: part_id.clone(), text: String::new() } });
    }
    events.push(ChatStreamEvent::TextDelta { part_id, delta: delta.to_string() });
    events
}

async fn handle_response_completed(
    mapper: &mut ResponsePartMapper,
    files_service: &FilesService,
    event: &Value,
) -> Vec<ChatStreamEvent> {
    let Some(outputs) = event
        .get("response")
        .and_then(|response| response.get("output"))
        .and_then(Value::as_array) else {
        return vec![ChatStreamEvent::Done];
    };

    let mut events = Vec::new();
    for (output_index, output) in outputs.iter().enumerate() {
        if output.get("type").and_then(Value::as_str) != Some("image_generation_call") {
            continue;
        }

        events.extend(handle_completed_image_item(mapper, files_service, output_index, output).await);
    }

    events.push(ChatStreamEvent::Done);
    events
}

async fn handle_completed_image_item(
    mapper: &mut ResponsePartMapper,
    files_service: &FilesService,
    output_index: usize,
    output: &Value,
) -> Vec<ChatStreamEvent> {
    let item_id = output.get("id").and_then(Value::as_str).unwrap_or_default().to_string();
    if !item_id.is_empty() && mapper.completed_image_item_ids.contains(&item_id) {
        return Vec::new();
    }

    let part_id = resolve_image_part_id(mapper, output_index, output);
    let mut events = Vec::new();

    if !mapper.has_image_part(&part_id) {
        events.push(ChatStreamEvent::PartAdded { part: ChatStreamPart::Image { id: part_id.clone(), status: "generating".to_string() } });
    }

    let Some(result) = output.get("result").and_then(Value::as_str) else {
        return Vec::new();
    };

    if !item_id.is_empty() {
        mapper.completed_image_item_ids.insert(item_id);
    }

    match store_generated_image(files_service, result).await {
        Ok(image) => events.push(ChatStreamEvent::ImageCompleted {
            part_id,
            image,
            revised_prompt: output.get("revised_prompt").and_then(Value::as_str).map(str::to_string),
        }),
        Err(error) => events.push(ChatStreamEvent::ImageFailed {
            part_id,
            message: error.message,
        }),
    }

    events
}

impl ResponsePartMapper {
    fn has_image_part(&self, part_id: &str) -> bool {
        self.image_parts_by_output_index.values().any(|value| value == part_id)
            || self.image_parts_by_item_id.values().any(|value| value == part_id)
    }

    fn finish_unresolved_images(&self) -> Vec<ChatStreamEvent> {
        self.image_parts_by_item_id
            .iter()
            .filter(|(item_id, _)| !self.completed_image_item_ids.contains(*item_id))
            .map(|(_, part_id)| ChatStreamEvent::ImageFailed {
                part_id: part_id.clone(),
                message: "Image generation finished without image data.".to_string(),
            })
            .collect()
    }
}

fn resolve_image_part_id(mapper: &mut ResponsePartMapper, output_index: usize, output: &Value) -> String {
    if let Some(item_id) = output.get("id").and_then(Value::as_str) {
        if let Some(part_id) = mapper.image_parts_by_item_id.get(item_id) {
            return part_id.clone();
        }
    }

    if let Some(part_id) = mapper.image_parts_by_output_index.get(&output_index) {
        return part_id.clone();
    }

    let part_id = create_part_id();
    mapper.image_parts_by_output_index.insert(output_index, part_id.clone());
    if let Some(item_id) = output.get("id").and_then(Value::as_str) {
        mapper.image_parts_by_item_id.insert(item_id.to_string(), part_id.clone());
    }
    part_id
}

async fn store_generated_image(files_service: &FilesService, image_base64: &str) -> Result<FileAttachmentPayload, HttpError> {
    let bytes = general_purpose::STANDARD
        .decode(image_base64)
        .map_err(|_| HttpError::internal("Generated image data is invalid."))?;

    files_service
        .store_generated_file(GeneratedFileInput {
            name: "generated-image.png".to_string(),
            mime_type: "image/png".to_string(),
            bytes,
        })
        .await
}

fn create_part_id() -> String {
    format!("part-{}", Uuid::new_v4())
}

fn to_ndjson_bytes(event: &ChatStreamEvent) -> Result<Bytes, std::io::Error> {
    serde_json::to_string(event)
        .map(|line| Bytes::from(format!("{line}\n")))
        .map_err(std::io::Error::other)
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
    let base_prompt = format!("{DEFAULT_CHAT_SYSTEM_PROMPT}\n\n{ATTACHMENTS_SYSTEM_PROMPT}");

    if personalization.is_empty() {
        return base_prompt;
    }

    format!("{base_prompt}\n\n{personalization}")
}

fn escape_xml_text(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
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
