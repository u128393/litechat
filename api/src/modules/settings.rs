use axum::{Json, extract::State, http::StatusCode};
use chrono::Utc;
use sea_orm::{ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, Set};
use serde::{Deserialize, Serialize};
use tower_cookies::Cookies;

use crate::{
    app_state::AppState,
    db::entities::{app_settings, model_configs, user_settings},
    http_error::HttpError,
    support::time::to_rfc3339,
};

const PERSONALIZATION_MAX_LENGTH: usize = 8000;

#[derive(Serialize)]
pub struct SettingsResponse<T> {
    pub settings: T,
}

#[derive(Serialize, Clone)]
pub struct UserSettingsPayload {
    pub personalization: String,
    #[serde(rename = "createdAt")]
    pub created_at: Option<String>,
    #[serde(rename = "updatedAt")]
    pub updated_at: Option<String>,
}

#[derive(Serialize, Clone)]
pub struct AppSettingsPayload {
    #[serde(rename = "titleGenerationModelConfigId")]
    pub title_generation_model_config_id: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateUserSettingsRequest {
    pub personalization: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateAppSettingsRequest {
    pub title_generation_model_config_id: Option<String>,
}

#[derive(Clone)]
pub struct SettingsService {
    database: DatabaseConnection,
}

impl SettingsService {
    pub fn new(database: DatabaseConnection) -> Self {
        Self { database }
    }

    pub async fn get_user_settings(&self, user_id: &str) -> Result<UserSettingsPayload, HttpError> {
        let settings = user_settings::Entity::find_by_id(user_id.to_string())
            .one(&self.database)
            .await
            .map_err(internal_error)?;

        Ok(match settings {
            Some(settings) => UserSettingsPayload {
                personalization: settings.personalization,
                created_at: Some(to_rfc3339(settings.created_at)),
                updated_at: Some(to_rfc3339(settings.updated_at)),
            },
            None => UserSettingsPayload {
                personalization: String::new(),
                created_at: None,
                updated_at: None,
            },
        })
    }

    pub async fn update_user_settings(
        &self,
        user_id: &str,
        payload: UpdateUserSettingsRequest,
    ) -> Result<UserSettingsPayload, HttpError> {
        let personalization = payload.personalization.trim().to_string();

        if personalization.len() > PERSONALIZATION_MAX_LENGTH {
            return Err(HttpError::new(
                StatusCode::BAD_REQUEST,
                "Personalization is too long.",
                Some("personalization_too_long".to_string()),
            ));
        }

        let now = Utc::now();
        if let Some(settings) = user_settings::Entity::find_by_id(user_id.to_string())
            .one(&self.database)
            .await
            .map_err(internal_error)?
        {
            let mut model: user_settings::ActiveModel = settings.into();
            model.personalization = Set(personalization);
            model.updated_at = Set(now);
            model.update(&self.database).await.map_err(internal_error)?;
        } else {
            user_settings::ActiveModel {
                user_id: Set(user_id.to_string()),
                personalization: Set(personalization),
                created_at: Set(now),
                updated_at: Set(now),
            }
            .insert(&self.database)
            .await
            .map_err(internal_error)?;
        }

        self.get_user_settings(user_id).await
    }

    pub async fn get_app_settings(&self) -> Result<AppSettingsPayload, HttpError> {
        let settings = app_settings::Entity::find_by_id(1)
            .one(&self.database)
            .await
            .map_err(internal_error)?;

        Ok(AppSettingsPayload {
            title_generation_model_config_id: settings
                .and_then(|item| item.title_generation_model_config_id),
        })
    }

    pub async fn update_app_settings(
        &self,
        payload: UpdateAppSettingsRequest,
    ) -> Result<AppSettingsPayload, HttpError> {
        let title_generation_model_config_id = payload
            .title_generation_model_config_id
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToString::to_string);

        if let Some(model_config_id) = title_generation_model_config_id.as_deref() {
            let exists = model_configs::Entity::find()
                .filter(model_configs::Column::Id.eq(model_config_id.to_string()))
                .one(&self.database)
                .await
                .map_err(internal_error)?
                .is_some();
            if !exists {
                return Err(HttpError::new(
                    StatusCode::BAD_REQUEST,
                    "Model config not found.",
                    Some("title_generation_model_config_not_found".to_string()),
                ));
            }
        }

        let now = Utc::now();
        if let Some(settings) = app_settings::Entity::find_by_id(1)
            .one(&self.database)
            .await
            .map_err(internal_error)?
        {
            let mut model: app_settings::ActiveModel = settings.into();
            model.title_generation_model_config_id = Set(title_generation_model_config_id);
            model.updated_at = Set(now);
            model.update(&self.database).await.map_err(internal_error)?;
        } else {
            app_settings::ActiveModel {
                id: Set(1),
                title_generation_model_config_id: Set(title_generation_model_config_id),
                created_at: Set(now),
                updated_at: Set(now),
            }
            .insert(&self.database)
            .await
            .map_err(internal_error)?;
        }

        self.get_app_settings().await
    }
}

pub async fn get_account_settings(
    State(state): State<AppState>,
    cookies: Cookies,
) -> Result<Json<SettingsResponse<UserSettingsPayload>>, HttpError> {
    let user = state.auth_service.require_current_user(&cookies).await?;

    Ok(Json(SettingsResponse {
        settings: state
            .settings_service
            .get_user_settings(&user.user_id)
            .await?,
    }))
}

pub async fn update_account_settings(
    State(state): State<AppState>,
    cookies: Cookies,
    Json(payload): Json<UpdateUserSettingsRequest>,
) -> Result<Json<SettingsResponse<UserSettingsPayload>>, HttpError> {
    let user = state.auth_service.require_current_user(&cookies).await?;

    Ok(Json(SettingsResponse {
        settings: state
            .settings_service
            .update_user_settings(&user.user_id, payload)
            .await?,
    }))
}

pub async fn get_app_settings(
    State(state): State<AppState>,
    cookies: Cookies,
) -> Result<Json<SettingsResponse<AppSettingsPayload>>, HttpError> {
    let _ = state.auth_service.require_admin_user(&cookies).await?;
    Ok(Json(SettingsResponse {
        settings: state.settings_service.get_app_settings().await?,
    }))
}

pub async fn update_app_settings(
    State(state): State<AppState>,
    cookies: Cookies,
    Json(payload): Json<UpdateAppSettingsRequest>,
) -> Result<Json<SettingsResponse<AppSettingsPayload>>, HttpError> {
    let _ = state.auth_service.require_admin_user(&cookies).await?;
    Ok(Json(SettingsResponse {
        settings: state.settings_service.update_app_settings(payload).await?,
    }))
}

fn internal_error(error: sea_orm::DbErr) -> HttpError {
    HttpError::internal(format!("Database error: {error}"))
}
