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
use serde_json::json;
use tower_cookies::Cookies;
use uuid::Uuid;

use crate::{
    app_state::AppState,
    db::entities::users,
    http_error::HttpError,
    modules::auth::{AuthService, CurrentUser},
    support::{password::hash_password, time::to_rfc3339},
};

#[derive(Serialize, Clone)]
pub struct ManagedUserPayload {
    pub id: String,
    pub email: String,
    pub role: String,
    pub enabled: bool,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    #[serde(rename = "updatedAt")]
    pub updated_at: String,
}

#[derive(Serialize)]
pub struct UsersResponse {
    pub users: Vec<ManagedUserPayload>,
}

#[derive(Serialize)]
pub struct UserResponse {
    pub user: ManagedUserPayload,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateManagedUserRequest {
    pub email: String,
    pub password: String,
    pub role: String,
    pub enabled: Option<bool>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateManagedUserRequest {
    pub enabled: Option<bool>,
}

#[derive(Deserialize)]
pub struct ResetManagedUserPasswordRequest {
    pub password: String,
}

pub struct CreateInitialAdminRequest {
    pub email: String,
    pub password_hash: String,
}

#[derive(Clone)]
pub struct UsersService {
    database: DatabaseConnection,
    auth_service: AuthService,
}

impl UsersService {
    pub fn new(database: DatabaseConnection, auth_service: AuthService) -> Self {
        Self {
            database,
            auth_service,
        }
    }

    pub async fn create_initial_admin(
        &self,
        request: CreateInitialAdminRequest,
    ) -> Result<users::Model, HttpError> {
        let now = Utc::now();
        users::ActiveModel {
            id: Set(Uuid::new_v4().to_string()),
            email: Set(normalize_email(&request.email)),
            password_hash: Set(request.password_hash),
            role: Set("admin".to_string()),
            enabled: Set(true),
            created_at: Set(now),
            updated_at: Set(now),
        }
        .insert(&self.database)
        .await
        .map_err(internal_error)
    }

    pub async fn list_admin_users(
        &self,
        actor: &CurrentUser,
    ) -> Result<Vec<ManagedUserPayload>, HttpError> {
        ensure_admin(actor)?;

        Ok(users::Entity::find()
            .order_by_asc(users::Column::CreatedAt)
            .order_by_asc(users::Column::Email)
            .all(&self.database)
            .await
            .map_err(internal_error)?
            .into_iter()
            .map(to_managed_user_payload)
            .collect())
    }

    pub async fn create_admin_user(
        &self,
        actor: &CurrentUser,
        payload: CreateManagedUserRequest,
    ) -> Result<ManagedUserPayload, HttpError> {
        ensure_admin(actor)?;
        let email = normalize_email(&payload.email);

        if payload.password.len() < 8 {
            return Err(HttpError::new(
                StatusCode::BAD_REQUEST,
                "Password must be at least 8 characters.",
                Some("min_length".to_string()),
            ));
        }

        let exists = users::Entity::find()
            .filter(users::Column::Email.eq(email.clone()))
            .one(&self.database)
            .await
            .map_err(internal_error)?
            .is_some();

        if exists {
            return Err(HttpError::new(
                StatusCode::CONFLICT,
                "Email already exists.",
                Some("email_exists".to_string()),
            ));
        }

        let now = Utc::now();
        let user = users::ActiveModel {
            id: Set(Uuid::new_v4().to_string()),
            email: Set(email),
            password_hash: Set(hash_password(&payload.password)?),
            role: Set(normalize_user_role(&payload.role)?),
            enabled: Set(payload.enabled.unwrap_or(true)),
            created_at: Set(now),
            updated_at: Set(now),
        }
        .insert(&self.database)
        .await
        .map_err(internal_error)?;

        Ok(to_managed_user_payload(user))
    }

    pub async fn update_admin_user(
        &self,
        actor: &CurrentUser,
        user_id: String,
        payload: UpdateManagedUserRequest,
    ) -> Result<ManagedUserPayload, HttpError> {
        ensure_admin(actor)?;
        let user = users::Entity::find_by_id(user_id.clone())
            .one(&self.database)
            .await
            .map_err(internal_error)?
            .ok_or_else(|| {
                HttpError::new(
                    StatusCode::NOT_FOUND,
                    "User not found.",
                    Some("user_not_found".to_string()),
                )
            })?;

        if payload.enabled == Some(false) && actor.user_id == user_id {
            return Err(HttpError::new(
                StatusCode::BAD_REQUEST,
                "You cannot disable your own account.",
                Some("cannot_disable_self".to_string()),
            ));
        }

        let mut model: users::ActiveModel = user.into();
        model.enabled = Set(payload
            .enabled
            .unwrap_or(model.enabled.take().unwrap_or(true)));
        model.updated_at = Set(Utc::now());
        let updated = model.update(&self.database).await.map_err(internal_error)?;

        if payload.enabled == Some(false) {
            self.auth_service
                .invalidate_sessions_by_user_id(&user_id)
                .await?;
        }

        Ok(to_managed_user_payload(updated))
    }

    pub async fn delete_admin_user(
        &self,
        actor: &CurrentUser,
        user_id: String,
    ) -> Result<(), HttpError> {
        ensure_admin(actor)?;
        if actor.user_id == user_id {
            return Err(HttpError::new(
                StatusCode::BAD_REQUEST,
                "You cannot delete your own account.",
                Some("cannot_delete_self".to_string()),
            ));
        }

        let deleted = users::Entity::delete_by_id(user_id)
            .exec(&self.database)
            .await
            .map_err(internal_error)?;

        if deleted.rows_affected == 0 {
            return Err(HttpError::new(
                StatusCode::NOT_FOUND,
                "User not found.",
                Some("user_not_found".to_string()),
            ));
        }

        Ok(())
    }

    pub async fn reset_admin_user_password(
        &self,
        actor: &CurrentUser,
        user_id: String,
        payload: ResetManagedUserPasswordRequest,
    ) -> Result<ManagedUserPayload, HttpError> {
        ensure_admin(actor)?;
        if payload.password.len() < 8 {
            return Err(HttpError::new(
                StatusCode::BAD_REQUEST,
                "Password must be at least 8 characters.",
                Some("min_length".to_string()),
            ));
        }

        let user = users::Entity::find_by_id(user_id.clone())
            .one(&self.database)
            .await
            .map_err(internal_error)?
            .ok_or_else(|| {
                HttpError::new(
                    StatusCode::NOT_FOUND,
                    "User not found.",
                    Some("user_not_found".to_string()),
                )
            })?;

        let mut model: users::ActiveModel = user.into();
        model.password_hash = Set(hash_password(&payload.password)?);
        model.updated_at = Set(Utc::now());
        let updated = model.update(&self.database).await.map_err(internal_error)?;

        self.auth_service
            .invalidate_sessions_by_user_id(&user_id)
            .await?;

        Ok(to_managed_user_payload(updated))
    }
}

pub async fn list_admin_users(
    State(state): State<AppState>,
    cookies: Cookies,
) -> Result<Json<UsersResponse>, HttpError> {
    let actor = state.auth_service.require_admin_user(&cookies).await?;
    Ok(Json(UsersResponse {
        users: state.users_service.list_admin_users(&actor).await?,
    }))
}

pub async fn create_admin_user(
    State(state): State<AppState>,
    cookies: Cookies,
    Json(payload): Json<CreateManagedUserRequest>,
) -> Result<Json<UserResponse>, HttpError> {
    let actor = state.auth_service.require_admin_user(&cookies).await?;
    Ok(Json(UserResponse {
        user: state
            .users_service
            .create_admin_user(&actor, payload)
            .await?,
    }))
}

pub async fn update_admin_user(
    State(state): State<AppState>,
    cookies: Cookies,
    Path(user_id): Path<String>,
    Json(payload): Json<UpdateManagedUserRequest>,
) -> Result<Json<UserResponse>, HttpError> {
    let actor = state.auth_service.require_admin_user(&cookies).await?;
    Ok(Json(UserResponse {
        user: state
            .users_service
            .update_admin_user(&actor, user_id, payload)
            .await?,
    }))
}

pub async fn delete_admin_user(
    State(state): State<AppState>,
    cookies: Cookies,
    Path(user_id): Path<String>,
) -> Result<Json<serde_json::Value>, HttpError> {
    let actor = state.auth_service.require_admin_user(&cookies).await?;
    state
        .users_service
        .delete_admin_user(&actor, user_id)
        .await?;
    Ok(Json(json!({ "success": true })))
}

pub async fn reset_admin_user_password(
    State(state): State<AppState>,
    cookies: Cookies,
    Path(user_id): Path<String>,
    Json(payload): Json<ResetManagedUserPasswordRequest>,
) -> Result<Json<UserResponse>, HttpError> {
    let actor = state.auth_service.require_admin_user(&cookies).await?;
    Ok(Json(UserResponse {
        user: state
            .users_service
            .reset_admin_user_password(&actor, user_id, payload)
            .await?,
    }))
}

fn to_managed_user_payload(user: users::Model) -> ManagedUserPayload {
    ManagedUserPayload {
        id: user.id,
        email: user.email,
        role: user.role,
        enabled: user.enabled,
        created_at: to_rfc3339(user.created_at),
        updated_at: to_rfc3339(user.updated_at),
    }
}

fn ensure_admin(actor: &CurrentUser) -> Result<(), HttpError> {
    if actor.role != "admin" {
        Err(HttpError::forbidden())
    } else {
        Ok(())
    }
}

fn normalize_email(email: &str) -> String {
    email.trim().to_lowercase()
}

fn normalize_user_role(value: &str) -> Result<String, HttpError> {
    match value.trim() {
        "user" | "admin" => Ok(value.trim().to_string()),
        _ => Err(HttpError::new(
            StatusCode::BAD_REQUEST,
            "role must be user or admin.",
            None,
        )),
    }
}

fn internal_error(error: sea_orm::DbErr) -> HttpError {
    HttpError::internal(format!("Database error: {error}"))
}
