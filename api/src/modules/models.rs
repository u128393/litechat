use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use chrono::Utc;
use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, QueryOrder, Set,
};
use serde::{Deserialize, Serialize};
use tower_cookies::Cookies;
use uuid::Uuid;

use crate::{
    app_state::AppState,
    db::entities::{model_configs, provider_configs},
    http_error::HttpError,
    support::time::to_rfc3339,
};

#[derive(Serialize)]
pub struct ModelsResponse {
    pub models: Vec<UserSelectableModel>,
}

#[derive(Serialize)]
pub struct UserSelectableModel {
    pub id: String,
    #[serde(rename = "modelId")]
    pub model_id: String,
    #[serde(rename = "displayName")]
    pub display_name: String,
    #[serde(rename = "supportsWebSearch")]
    pub supports_web_search: bool,
    #[serde(rename = "supportsImageGeneration")]
    pub supports_image_generation: bool,
}

#[derive(Serialize, Clone)]
pub struct ModelConfigPayload {
    pub id: String,
    #[serde(rename = "providerConfigId")]
    pub provider_config_id: String,
    #[serde(rename = "modelId")]
    pub model_id: String,
    #[serde(rename = "displayName")]
    pub display_name: String,
    pub visible: bool,
    #[serde(rename = "supportsWebSearch")]
    pub supports_web_search: bool,
    #[serde(rename = "supportsImageGeneration")]
    pub supports_image_generation: bool,
    #[serde(rename = "sortOrder")]
    pub sort_order: i32,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
}

#[derive(Serialize)]
pub struct ModelConfigsResponse {
    #[serde(rename = "modelConfigs")]
    pub model_configs: Vec<ModelConfigPayload>,
}

#[derive(Serialize)]
pub struct ModelConfigResponse {
    #[serde(rename = "modelConfig")]
    pub model_config: ModelConfigPayload,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateModelConfigRequest {
    pub provider_config_id: String,
    pub model_id: String,
    pub display_name: String,
    pub visible: Option<bool>,
    pub supports_web_search: Option<bool>,
    pub supports_image_generation: Option<bool>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateModelConfigRequest {
    pub provider_config_id: Option<String>,
    pub model_id: Option<String>,
    pub display_name: Option<String>,
    pub visible: Option<bool>,
    pub supports_web_search: Option<bool>,
    pub supports_image_generation: Option<bool>,
    pub sort_order: Option<i32>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReorderModelConfigsRequest {
    pub model_config_ids: Vec<String>,
}

#[derive(Clone)]
pub struct ModelsService {
    database: DatabaseConnection,
}

impl ModelsService {
    pub fn new(database: DatabaseConnection) -> Self {
        Self { database }
    }

    pub async fn list_models(&self) -> Result<Vec<UserSelectableModel>, HttpError> {
        let models = model_configs::Entity::find()
            .filter(model_configs::Column::Visible.eq(true))
            .order_by_asc(model_configs::Column::SortOrder)
            .order_by_asc(model_configs::Column::CreatedAt)
            .all(&self.database)
            .await
            .map_err(internal_error)?;

        let mut visible = Vec::new();
        for model in models {
            let provider = provider_configs::Entity::find_by_id(model.provider_config_id.clone())
                .one(&self.database)
                .await
                .map_err(internal_error)?;
            if provider.as_ref().map(|item| item.enabled).unwrap_or(false) {
                visible.push(UserSelectableModel {
                    id: model.id,
                    model_id: model.model_id,
                    display_name: model.display_name,
                    supports_web_search: model.supports_web_search,
                    supports_image_generation: model.supports_image_generation,
                });
            }
        }

        Ok(visible)
    }

    pub async fn list_model_configs(&self) -> Result<Vec<ModelConfigPayload>, HttpError> {
        Ok(model_configs::Entity::find()
            .order_by_asc(model_configs::Column::SortOrder)
            .order_by_asc(model_configs::Column::CreatedAt)
            .all(&self.database)
            .await
            .map_err(internal_error)?
            .into_iter()
            .map(to_model_config_payload)
            .collect())
    }

    pub async fn create_model_config(
        &self,
        payload: CreateModelConfigRequest,
    ) -> Result<ModelConfigPayload, HttpError> {
        ensure_provider_config_exists(&self.database, &payload.provider_config_id).await?;

        let next_sort_order = model_configs::Entity::find()
            .order_by_asc(model_configs::Column::SortOrder)
            .one(&self.database)
            .await
            .map_err(internal_error)?
            .map(|item| item.sort_order - 1)
            .unwrap_or(0);

        let now = Utc::now();
        let item = model_configs::ActiveModel {
            id: Set(Uuid::new_v4().to_string()),
            provider_config_id: Set(payload.provider_config_id),
            model_id: Set(read_required_string(&payload.model_id, "modelId")?),
            display_name: Set(read_required_string(&payload.display_name, "displayName")?),
            visible: Set(payload.visible.unwrap_or(true)),
            supports_web_search: Set(payload.supports_web_search.unwrap_or(false)),
            supports_image_generation: Set(payload.supports_image_generation.unwrap_or(false)),
            sort_order: Set(next_sort_order),
            created_at: Set(now),
            updated_at: Set(now),
        }
        .insert(&self.database)
        .await
        .map_err(internal_error)?;

        Ok(to_model_config_payload(item))
    }

    pub async fn update_model_config(
        &self,
        model_config_id: String,
        payload: UpdateModelConfigRequest,
    ) -> Result<ModelConfigPayload, HttpError> {
        let item = model_configs::Entity::find_by_id(model_config_id)
            .one(&self.database)
            .await
            .map_err(internal_error)?
            .ok_or_else(|| {
                HttpError::new(StatusCode::NOT_FOUND, "Model config not found.", None)
            })?;

        if let Some(provider_config_id) = payload.provider_config_id.as_deref() {
            ensure_provider_config_exists(&self.database, provider_config_id).await?;
        }

        let existing_provider_config_id = item.provider_config_id.clone();
        let existing_model_id = item.model_id.clone();
        let existing_display_name = item.display_name.clone();
        let existing_visible = item.visible;
        let existing_supports_web_search = item.supports_web_search;
        let existing_supports_image_generation = item.supports_image_generation;
        let existing_sort_order = item.sort_order;

        let mut model: model_configs::ActiveModel = item.into();
        model.provider_config_id = Set(payload
            .provider_config_id
            .unwrap_or(existing_provider_config_id));
        model.model_id = Set(payload
            .model_id
            .as_deref()
            .map(|value| read_required_string(value, "modelId"))
            .transpose()?
            .unwrap_or(existing_model_id));
        model.display_name = Set(payload
            .display_name
            .as_deref()
            .map(|value| read_required_string(value, "displayName"))
            .transpose()?
            .unwrap_or(existing_display_name));
        model.visible = Set(payload.visible.unwrap_or(existing_visible));
        model.supports_web_search = Set(payload
            .supports_web_search
            .unwrap_or(existing_supports_web_search));
        model.supports_image_generation = Set(payload
            .supports_image_generation
            .unwrap_or(existing_supports_image_generation));
        model.sort_order = Set(payload.sort_order.unwrap_or(existing_sort_order));
        model.updated_at = Set(Utc::now());

        Ok(to_model_config_payload(
            model.update(&self.database).await.map_err(internal_error)?,
        ))
    }

    pub async fn delete_model_config(&self, model_config_id: String) -> Result<(), HttpError> {
        let deleted = model_configs::Entity::delete_by_id(model_config_id)
            .exec(&self.database)
            .await
            .map_err(internal_error)?;

        if deleted.rows_affected == 0 {
            return Err(HttpError::new(
                StatusCode::NOT_FOUND,
                "Model config not found.",
                None,
            ));
        }

        Ok(())
    }

    pub async fn reorder_model_configs(
        &self,
        payload: ReorderModelConfigsRequest,
    ) -> Result<Vec<ModelConfigPayload>, HttpError> {
        let existing = model_configs::Entity::find()
            .order_by_asc(model_configs::Column::SortOrder)
            .order_by_asc(model_configs::Column::CreatedAt)
            .all(&self.database)
            .await
            .map_err(internal_error)?;
        let existing_ids = existing
            .iter()
            .map(|item| item.id.clone())
            .collect::<Vec<_>>();

        if payload.model_config_ids.len() != existing_ids.len()
            || payload
                .model_config_ids
                .iter()
                .any(|id| !existing_ids.contains(id))
        {
            return Err(HttpError::new(
                StatusCode::CONFLICT,
                "Model order no longer matches the stored models.",
                None,
            ));
        }

        let now = Utc::now();
        let mut existing_by_id = existing
            .into_iter()
            .map(|item| (item.id.clone(), item))
            .collect::<std::collections::HashMap<_, _>>();

        for (index, model_config_id) in payload.model_config_ids.iter().enumerate() {
            let item = existing_by_id.remove(model_config_id).ok_or_else(|| {
                HttpError::new(
                    StatusCode::CONFLICT,
                    "Model order no longer matches the stored models.",
                    None,
                )
            })?;
            let mut model: model_configs::ActiveModel = item.into();
            model.sort_order = Set(index as i32);
            model.updated_at = Set(now);
            model.update(&self.database).await.map_err(internal_error)?;
        }

        self.list_model_configs().await
    }
}

pub async fn list_models(
    State(state): State<AppState>,
    cookies: Cookies,
) -> Result<Json<ModelsResponse>, HttpError> {
    let _ = state.auth_service.require_current_user(&cookies).await?;
    Ok(Json(ModelsResponse {
        models: state.models_service.list_models().await?,
    }))
}

pub async fn list_model_configs(
    State(state): State<AppState>,
    cookies: Cookies,
) -> Result<Json<ModelConfigsResponse>, HttpError> {
    let _ = state.auth_service.require_admin_user(&cookies).await?;
    Ok(Json(ModelConfigsResponse {
        model_configs: state.models_service.list_model_configs().await?,
    }))
}

pub async fn create_model_config(
    State(state): State<AppState>,
    cookies: Cookies,
    Json(payload): Json<CreateModelConfigRequest>,
) -> Result<Json<ModelConfigResponse>, HttpError> {
    let _ = state.auth_service.require_admin_user(&cookies).await?;
    Ok(Json(ModelConfigResponse {
        model_config: state.models_service.create_model_config(payload).await?,
    }))
}

pub async fn update_model_config(
    State(state): State<AppState>,
    cookies: Cookies,
    Path(model_config_id): Path<String>,
    Json(payload): Json<UpdateModelConfigRequest>,
) -> Result<Json<ModelConfigResponse>, HttpError> {
    let _ = state.auth_service.require_admin_user(&cookies).await?;
    Ok(Json(ModelConfigResponse {
        model_config: state
            .models_service
            .update_model_config(model_config_id, payload)
            .await?,
    }))
}

pub async fn delete_model_config(
    State(state): State<AppState>,
    cookies: Cookies,
    Path(model_config_id): Path<String>,
) -> Result<Json<serde_json::Value>, HttpError> {
    let _ = state.auth_service.require_admin_user(&cookies).await?;
    state
        .models_service
        .delete_model_config(model_config_id)
        .await?;
    Ok(Json(serde_json::json!({ "success": true })))
}

pub async fn reorder_model_configs(
    State(state): State<AppState>,
    cookies: Cookies,
    Json(payload): Json<ReorderModelConfigsRequest>,
) -> Result<Json<ModelConfigsResponse>, HttpError> {
    let _ = state.auth_service.require_admin_user(&cookies).await?;
    Ok(Json(ModelConfigsResponse {
        model_configs: state.models_service.reorder_model_configs(payload).await?,
    }))
}

async fn ensure_provider_config_exists(
    database: &DatabaseConnection,
    provider_config_id: &str,
) -> Result<(), HttpError> {
    let exists = provider_configs::Entity::find_by_id(provider_config_id.to_string())
        .one(database)
        .await
        .map_err(internal_error)?
        .is_some();

    if !exists {
        return Err(HttpError::new(
            StatusCode::BAD_REQUEST,
            "Provider config not found.",
            None,
        ));
    }

    Ok(())
}

fn to_model_config_payload(item: model_configs::Model) -> ModelConfigPayload {
    ModelConfigPayload {
        id: item.id,
        provider_config_id: item.provider_config_id,
        model_id: item.model_id,
        display_name: item.display_name,
        visible: item.visible,
        supports_web_search: item.supports_web_search,
        supports_image_generation: item.supports_image_generation,
        sort_order: item.sort_order,
        created_at: to_rfc3339(item.created_at),
        updated_at: to_rfc3339(item.updated_at),
    }
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

fn internal_error(error: sea_orm::DbErr) -> HttpError {
    HttpError::internal(format!("Database error: {error}"))
}
