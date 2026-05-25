use std::sync::Arc;

use sea_orm::DatabaseConnection;

use crate::{
    config::AppConfig,
    modules::{
        auth::AuthService, chat::ChatService, models::ModelsService, providers::ProvidersService,
        settings::SettingsService, users::UsersService,
    },
};

#[derive(Clone)]
pub struct AppState {
    pub auth_service: AuthService,
    pub chat_service: ChatService,
    pub models_service: ModelsService,
    pub providers_service: ProvidersService,
    pub settings_service: SettingsService,
    pub users_service: UsersService,
}

impl AppState {
    pub fn new(config: AppConfig, database: DatabaseConnection) -> Self {
        let config = Arc::new(config);
        let auth_service = AuthService::new(database.clone(), config.clone());
        let users_service = UsersService::new(database.clone(), auth_service.clone());
        let providers_service = ProvidersService::new(database.clone(), config.clone());
        let models_service = ModelsService::new(database.clone());
        let settings_service = SettingsService::new(database.clone());
        let chat_service = ChatService::new(database, config.clone());

        Self {
            auth_service,
            chat_service,
            models_service,
            providers_service,
            settings_service,
            users_service,
        }
    }
}
