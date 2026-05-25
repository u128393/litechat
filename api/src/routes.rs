use axum::{
    Router,
    routing::{get, patch, post},
};

use crate::{
    app_state::AppState,
    modules::{auth, chat, models, providers, settings, users},
};

pub fn create_router(state: AppState) -> Router {
    Router::new()
        .route("/api/auth/login", post(auth::login))
        .route("/api/auth/logout", post(auth::logout))
        .route("/api/auth/me", get(auth::me))
        .route("/api/auth/password", post(auth::change_password))
        .route("/api/models", get(models::list_models))
        .route("/api/chat", post(chat::chat))
        .route("/api/chat/title", post(chat::chat_title))
        .route(
            "/api/account/settings",
            get(settings::get_account_settings).put(settings::update_account_settings),
        )
        .route(
            "/api/admin/users",
            get(users::list_admin_users).post(users::create_admin_user),
        )
        .route(
            "/api/admin/users/{user_id}",
            patch(users::update_admin_user).delete(users::delete_admin_user),
        )
        .route(
            "/api/admin/users/{user_id}/password",
            post(users::reset_admin_user_password),
        )
        .route(
            "/api/admin/provider-configs",
            get(providers::list_provider_configs).post(providers::create_provider_config),
        )
        .route(
            "/api/admin/provider-configs/{provider_config_id}",
            patch(providers::update_provider_config).delete(providers::delete_provider_config),
        )
        .route(
            "/api/admin/model-configs",
            get(models::list_model_configs)
                .post(models::create_model_config)
                .patch(models::reorder_model_configs),
        )
        .route(
            "/api/admin/model-configs/{model_config_id}",
            patch(models::update_model_config).delete(models::delete_model_config),
        )
        .route(
            "/api/admin/settings",
            get(settings::get_app_settings).put(settings::update_app_settings),
        )
        .with_state(state)
}
