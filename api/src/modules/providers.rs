use std::sync::Arc;

use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use chrono::Utc;
use sea_orm::{ActiveModelTrait, DatabaseConnection, EntityTrait, QueryOrder, Set};
use serde::{Deserialize, Serialize};
use serde_json::json;
use tower_cookies::Cookies;
use uuid::Uuid;

use crate::{
    app_state::AppState,
    config::AppConfig,
    db::entities::provider_configs,
    http_error::HttpError,
    support::{crypto::encrypt_provider_api_key, time::to_rfc3339},
};

#[derive(Serialize, Clone)]
pub struct ProviderConfigPayload {
    pub id: String,
    pub name: String,
    #[serde(rename = "providerType")]
    pub provider_type: String,
    #[serde(rename = "baseUrl")]
    pub base_url: Option<String>,
    pub enabled: bool,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
}

#[derive(Serialize)]
pub struct ProviderConfigsResponse {
    #[serde(rename = "providerConfigs")]
    pub provider_configs: Vec<ProviderConfigPayload>,
}

#[derive(Serialize)]
pub struct ProviderConfigResponse {
    #[serde(rename = "providerConfig")]
    pub provider_config: ProviderConfigPayload,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProviderConfigRequest {
    pub name: String,
    pub provider_type: Option<String>,
    pub base_url: Option<String>,
    pub api_key: String,
    pub enabled: Option<bool>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateProviderConfigRequest {
    pub name: Option<String>,
    pub provider_type: Option<String>,
    pub base_url: Option<String>,
    pub api_key: Option<String>,
    pub enabled: Option<bool>,
}

#[derive(Clone)]
pub struct ProvidersService {
    database: DatabaseConnection,
    config: Arc<AppConfig>,
}

impl ProvidersService {
    pub fn new(database: DatabaseConnection, config: Arc<AppConfig>) -> Self {
        Self { database, config }
    }

    pub async fn list(&self) -> Result<Vec<ProviderConfigPayload>, HttpError> {
        Ok(provider_configs::Entity::find()
            .order_by_asc(provider_configs::Column::CreatedAt)
            .all(&self.database)
            .await
            .map_err(internal_error)?
            .into_iter()
            .map(to_provider_config_payload)
            .collect())
    }

    pub async fn create(
        &self,
        payload: CreateProviderConfigRequest,
    ) -> Result<ProviderConfigPayload, HttpError> {
        let now = Utc::now();
        let item = provider_configs::ActiveModel {
            id: Set(Uuid::new_v4().to_string()),
            name: Set(read_required_string(&payload.name, "name")?),
            provider_type: Set(normalize_provider_type(payload.provider_type.as_deref())?),
            base_url: Set(normalize_optional_url(payload.base_url.as_deref())?),
            api_key_encrypted: Set(encrypt_provider_api_key(
                &self.config,
                &read_required_string(&payload.api_key, "apiKey")?,
            )
            .map_err(invalid_request_error)?),
            enabled: Set(payload.enabled.unwrap_or(true)),
            created_at: Set(now),
            updated_at: Set(now),
        }
        .insert(&self.database)
        .await
        .map_err(internal_error)?;

        Ok(to_provider_config_payload(item))
    }

    pub async fn update(
        &self,
        provider_config_id: String,
        payload: UpdateProviderConfigRequest,
    ) -> Result<ProviderConfigPayload, HttpError> {
        let item = provider_configs::Entity::find_by_id(provider_config_id)
            .one(&self.database)
            .await
            .map_err(internal_error)?
            .ok_or_else(|| {
                HttpError::new(StatusCode::NOT_FOUND, "Provider config not found.", None)
            })?;

        let existing_api_key = item.api_key_encrypted.clone();
        let existing_base_url = item.base_url.clone();
        let existing_name = item.name.clone();
        let existing_provider_type = item.provider_type.clone();
        let existing_enabled = item.enabled;

        let mut model: provider_configs::ActiveModel = item.into();
        model.name = Set(payload
            .name
            .as_deref()
            .map(|value| read_required_string(value, "name"))
            .transpose()?
            .unwrap_or(existing_name));
        model.provider_type = Set(payload
            .provider_type
            .as_deref()
            .map(|value| normalize_provider_type(Some(value)))
            .transpose()?
            .unwrap_or(existing_provider_type));
        model.base_url = Set(if payload.base_url.is_some() {
            normalize_optional_url(payload.base_url.as_deref())?
        } else {
            existing_base_url
        });
        model.api_key_encrypted = Set(match payload.api_key.as_deref() {
            Some(api_key) => {
                encrypt_provider_api_key(&self.config, &read_required_string(api_key, "apiKey")?)
                    .map_err(invalid_request_error)?
            }
            None => existing_api_key,
        });
        model.enabled = Set(payload.enabled.unwrap_or(existing_enabled));
        model.updated_at = Set(Utc::now());

        Ok(to_provider_config_payload(
            model.update(&self.database).await.map_err(internal_error)?,
        ))
    }

    pub async fn delete(&self, provider_config_id: String) -> Result<(), HttpError> {
        let deleted = provider_configs::Entity::delete_by_id(provider_config_id)
            .exec(&self.database)
            .await
            .map_err(internal_error)?;

        if deleted.rows_affected == 0 {
            return Err(HttpError::new(
                StatusCode::NOT_FOUND,
                "Provider config not found.",
                None,
            ));
        }

        Ok(())
    }
}

pub async fn list_provider_configs(
    State(state): State<AppState>,
    cookies: Cookies,
) -> Result<Json<ProviderConfigsResponse>, HttpError> {
    let _ = state.auth_service.require_admin_user(&cookies).await?;
    Ok(Json(ProviderConfigsResponse {
        provider_configs: state.providers_service.list().await?,
    }))
}

pub async fn create_provider_config(
    State(state): State<AppState>,
    cookies: Cookies,
    Json(payload): Json<CreateProviderConfigRequest>,
) -> Result<Json<ProviderConfigResponse>, HttpError> {
    let _ = state.auth_service.require_admin_user(&cookies).await?;
    Ok(Json(ProviderConfigResponse {
        provider_config: state.providers_service.create(payload).await?,
    }))
}

pub async fn update_provider_config(
    State(state): State<AppState>,
    cookies: Cookies,
    Path(provider_config_id): Path<String>,
    Json(payload): Json<UpdateProviderConfigRequest>,
) -> Result<Json<ProviderConfigResponse>, HttpError> {
    let _ = state.auth_service.require_admin_user(&cookies).await?;
    Ok(Json(ProviderConfigResponse {
        provider_config: state
            .providers_service
            .update(provider_config_id, payload)
            .await?,
    }))
}

pub async fn delete_provider_config(
    State(state): State<AppState>,
    cookies: Cookies,
    Path(provider_config_id): Path<String>,
) -> Result<Json<serde_json::Value>, HttpError> {
    let _ = state.auth_service.require_admin_user(&cookies).await?;
    state.providers_service.delete(provider_config_id).await?;
    Ok(Json(json!({ "success": true })))
}

fn to_provider_config_payload(item: provider_configs::Model) -> ProviderConfigPayload {
    ProviderConfigPayload {
        id: item.id,
        name: item.name,
        provider_type: item.provider_type,
        base_url: item.base_url,
        enabled: item.enabled,
        created_at: to_rfc3339(item.created_at),
        updated_at: to_rfc3339(item.updated_at),
    }
}

fn normalize_provider_type(value: Option<&str>) -> Result<String, HttpError> {
    match value.unwrap_or("openai-responses").trim() {
        "openai-responses" => Ok("openai-responses".to_string()),
        _ => Err(HttpError::new(
            StatusCode::BAD_REQUEST,
            "providerType must be `openai-responses`.",
            None,
        )),
    }
}

fn normalize_optional_url(value: Option<&str>) -> Result<Option<String>, HttpError> {
    let Some(value) = value.map(str::trim) else {
        return Ok(None);
    };

    if value.is_empty() {
        return Ok(None);
    }

    let parsed = url::Url::parse(value).map_err(|_| {
        HttpError::new(
            StatusCode::BAD_REQUEST,
            "baseUrl must be a valid URL string or null.",
            None,
        )
    })?;
    Ok(Some(parsed.to_string()))
}

fn read_required_string(value: &str, field_name: &str) -> Result<String, HttpError> {
    let normalized = value.trim();
    if normalized.is_empty() {
        return Err(HttpError::new(
            StatusCode::BAD_REQUEST,
            format!("{field_name} must be a non-empty string."),
            None,
        ));
    }
    Ok(normalized.to_string())
}

fn invalid_request_error(message: String) -> HttpError {
    HttpError::new(StatusCode::BAD_REQUEST, message, None)
}

fn internal_error(error: sea_orm::DbErr) -> HttpError {
    HttpError::internal(format!("Database error: {error}"))
}
