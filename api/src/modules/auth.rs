use std::sync::Arc;

use axum::{Json, extract::State, http::StatusCode};
use chrono::{Duration, Utc};
use sea_orm::{ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, Set};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tower_cookies::{Cookie, Cookies};
use uuid::Uuid;

use crate::{
    app_state::AppState,
    config::AppConfig,
    db::entities::{sessions, users},
    http_error::HttpError,
    support::{
        password::{hash_password, verify_password},
        time::to_rfc3339,
    },
};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CurrentUser {
    pub session_id: String,
    pub user_id: String,
    pub email: String,
    pub role: String,
    pub expires_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
    pub next: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChangePasswordRequest {
    pub current_password: String,
    pub new_password: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoginResponse {
    pub success: bool,
    pub redirect_to: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LogoutResponse {
    pub success: bool,
    pub redirect_to: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthMeResponse {
    pub user: Option<CurrentUser>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChangePasswordResponse {
    pub success: bool,
    pub redirect_to: String,
}

#[derive(Clone)]
pub struct AuthService {
    database: DatabaseConnection,
    config: Arc<AppConfig>,
}

impl AuthService {
    pub fn new(database: DatabaseConnection, config: Arc<AppConfig>) -> Self {
        Self { database, config }
    }

    pub async fn login(
        &self,
        payload: LoginRequest,
        cookies: &Cookies,
    ) -> Result<LoginResponse, HttpError> {
        let email = normalize_email(&payload.email);
        let user = users::Entity::find()
            .filter(users::Column::Email.eq(email))
            .one(&self.database)
            .await
            .map_err(internal_error)?
            .ok_or_else(|| {
                HttpError::new(
                    StatusCode::UNAUTHORIZED,
                    "Invalid email or password.",
                    Some("invalid_credentials".to_string()),
                )
            })?;

        if !user.enabled || !verify_password(&user.password_hash, &payload.password) {
            return Err(HttpError::new(
                StatusCode::UNAUTHORIZED,
                "Invalid email or password.",
                Some("invalid_credentials".to_string()),
            ));
        }

        let now = Utc::now();
        let raw_token = format!("{}:{}", user.id, Uuid::new_v4());
        let token_hash = self.hash_session_token(&raw_token);

        sessions::ActiveModel {
            id: Set(Uuid::new_v4().to_string()),
            user_id: Set(user.id),
            token_hash: Set(token_hash),
            expires_at: Set(now + Duration::hours(self.config.auth.session_ttl_hours)),
            created_at: Set(now),
            invalidated_at: Set(None),
        }
        .insert(&self.database)
        .await
        .map_err(internal_error)?;

        cookies.add(
            Cookie::build((self.config.auth.session_cookie_name.clone(), raw_token))
                .path("/")
                .http_only(true)
                .same_site(tower_cookies::cookie::SameSite::Lax)
                .secure(self.config.auth.secure_cookies)
                .build(),
        );

        Ok(LoginResponse {
            success: true,
            redirect_to: sanitize_redirect(payload.next.as_deref().unwrap_or("/")),
        })
    }

    pub async fn logout(&self, cookies: &Cookies) -> LogoutResponse {
        if let Some(cookie) = cookies.get(&self.config.auth.session_cookie_name) {
            let token_hash = self.hash_session_token(cookie.value());
            let _ = sessions::Entity::update_many()
                .col_expr(
                    sessions::Column::InvalidatedAt,
                    sea_orm::sea_query::Expr::value(Utc::now()),
                )
                .filter(sessions::Column::TokenHash.eq(token_hash))
                .exec(&self.database)
                .await;
        }

        cookies.remove(Cookie::from(self.config.auth.session_cookie_name.clone()));

        LogoutResponse {
            success: true,
            redirect_to: "/login".to_string(),
        }
    }

    pub async fn me(&self, cookies: &Cookies) -> Result<Option<CurrentUser>, HttpError> {
        self.resolve_current_user(cookies).await
    }

    pub async fn change_password(
        &self,
        payload: ChangePasswordRequest,
        cookies: &Cookies,
    ) -> Result<ChangePasswordResponse, HttpError> {
        if payload.new_password.len() < 8 {
            return Err(HttpError::new(
                StatusCode::BAD_REQUEST,
                "New password must be at least 8 characters.",
                Some("min_length".to_string()),
            ));
        }

        let current_user = self.require_current_user(cookies).await?;
        let user = users::Entity::find_by_id(current_user.user_id.clone())
            .one(&self.database)
            .await
            .map_err(internal_error)?
            .ok_or_else(|| HttpError::new(StatusCode::NOT_FOUND, "User not found.", None))?;

        if !verify_password(&user.password_hash, &payload.current_password) {
            return Err(HttpError::new(
                StatusCode::BAD_REQUEST,
                "Current password is incorrect.",
                Some("invalid_credentials".to_string()),
            ));
        }

        let mut model: users::ActiveModel = user.into();
        model.password_hash = Set(hash_password(&payload.new_password)?);
        model.updated_at = Set(Utc::now());
        model.update(&self.database).await.map_err(internal_error)?;

        self.invalidate_sessions_by_user_id(&current_user.user_id)
            .await?;
        cookies.remove(Cookie::from(self.config.auth.session_cookie_name.clone()));

        Ok(ChangePasswordResponse {
            success: true,
            redirect_to: "/login?password_changed=1".to_string(),
        })
    }

    pub async fn require_current_user(&self, cookies: &Cookies) -> Result<CurrentUser, HttpError> {
        self.resolve_current_user(cookies)
            .await?
            .ok_or_else(HttpError::unauthorized)
    }

    pub async fn require_admin_user(&self, cookies: &Cookies) -> Result<CurrentUser, HttpError> {
        let user = self.require_current_user(cookies).await?;
        if user.role != "admin" {
            return Err(HttpError::forbidden());
        }
        Ok(user)
    }

    pub async fn invalidate_sessions_by_user_id(&self, user_id: &str) -> Result<(), HttpError> {
        sessions::Entity::update_many()
            .col_expr(
                sessions::Column::InvalidatedAt,
                sea_orm::sea_query::Expr::value(Utc::now()),
            )
            .filter(sessions::Column::UserId.eq(user_id.to_string()))
            .filter(sessions::Column::InvalidatedAt.is_null())
            .exec(&self.database)
            .await
            .map_err(internal_error)?;

        Ok(())
    }

    pub fn hash_session_token(&self, token: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(self.config.auth.session_secret.as_bytes());
        hasher.update(token.as_bytes());
        format!("{:x}", hasher.finalize())
    }

    async fn resolve_current_user(
        &self,
        cookies: &Cookies,
    ) -> Result<Option<CurrentUser>, HttpError> {
        let Some(cookie) = cookies.get(&self.config.auth.session_cookie_name) else {
            return Ok(None);
        };

        let token_hash = self.hash_session_token(cookie.value());
        let session = sessions::Entity::find()
            .filter(sessions::Column::TokenHash.eq(token_hash))
            .filter(sessions::Column::InvalidatedAt.is_null())
            .one(&self.database)
            .await
            .map_err(internal_error)?;

        let Some(session) = session else {
            return Ok(None);
        };

        if session.expires_at <= Utc::now() {
            return Ok(None);
        }

        let user = users::Entity::find_by_id(session.user_id.clone())
            .one(&self.database)
            .await
            .map_err(internal_error)?;

        let Some(user) = user else {
            return Ok(None);
        };

        if !user.enabled {
            return Ok(None);
        }

        Ok(Some(CurrentUser {
            session_id: session.id,
            user_id: user.id,
            email: user.email,
            role: user.role,
            expires_at: to_rfc3339(session.expires_at),
        }))
    }
}

pub async fn login(
    State(state): State<AppState>,
    cookies: Cookies,
    Json(payload): Json<LoginRequest>,
) -> Result<Json<LoginResponse>, HttpError> {
    Ok(Json(state.auth_service.login(payload, &cookies).await?))
}

pub async fn logout(State(state): State<AppState>, cookies: Cookies) -> Json<LogoutResponse> {
    Json(state.auth_service.logout(&cookies).await)
}

pub async fn me(
    State(state): State<AppState>,
    cookies: Cookies,
) -> Result<Json<AuthMeResponse>, HttpError> {
    Ok(Json(AuthMeResponse {
        user: state.auth_service.me(&cookies).await?,
    }))
}

pub async fn change_password(
    State(state): State<AppState>,
    cookies: Cookies,
    Json(payload): Json<ChangePasswordRequest>,
) -> Result<Json<ChangePasswordResponse>, HttpError> {
    Ok(Json(
        state
            .auth_service
            .change_password(payload, &cookies)
            .await?,
    ))
}

fn normalize_email(email: &str) -> String {
    email.trim().to_lowercase()
}

fn sanitize_redirect(value: &str) -> String {
    if value.starts_with('/') && !value.starts_with("//") {
        value.to_string()
    } else {
        "/".to_string()
    }
}

fn internal_error(error: sea_orm::DbErr) -> HttpError {
    HttpError::internal(format!("Database error: {error}"))
}
