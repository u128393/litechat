use std::env;

const DEFAULT_SESSION_COOKIE_NAME: &str = "litechat_session";
const DEFAULT_SESSION_TTL_HOURS: i64 = 24 * 30;

#[derive(Clone, Debug)]
pub struct AppConfig {
    pub auth: AuthConfig,
    pub database: DatabaseConfig,
    pub server: ServerConfig,
    pub security: SecurityConfig,
}

#[derive(Clone, Debug)]
pub struct ServerConfig {
    pub host: String,
    pub port: u16,
}

#[derive(Clone, Debug)]
pub struct AuthConfig {
    pub session_secret: String,
    pub session_cookie_name: String,
    pub session_ttl_hours: i64,
    pub secure_cookies: bool,
}

#[derive(Clone, Debug)]
pub struct SecurityConfig {
    pub provider_key_encryption_secret: String,
}

#[derive(Clone, Debug)]
pub struct DatabaseConfig {
    pub url: String,
    pub backend: DatabaseBackend,
}

#[derive(Clone, Debug)]
pub enum DatabaseBackend {
    Sqlite,
    Postgres,
    Mysql,
}

impl AppConfig {
    pub fn load() -> Result<Self, String> {
        let environment = env::var("NODE_ENV").unwrap_or_else(|_| "development".to_string());
        let secure_cookies = environment == "production";

        Ok(Self {
            auth: AuthConfig {
                session_secret: required_env("AUTH_SESSION_SECRET")?,
                session_cookie_name: env::var("AUTH_SESSION_COOKIE_NAME")
                    .unwrap_or_else(|_| DEFAULT_SESSION_COOKIE_NAME.to_string()),
                session_ttl_hours: env::var("AUTH_SESSION_TTL_HOURS")
                    .ok()
                    .and_then(|value| value.parse::<i64>().ok())
                    .unwrap_or(DEFAULT_SESSION_TTL_HOURS),
                secure_cookies,
            },
            database: load_database_config()?,
            server: ServerConfig {
                host: env::var("APP_HOST").unwrap_or_else(|_| "127.0.0.1".to_string()),
                port: env::var("APP_PORT")
                    .ok()
                    .and_then(|value| value.parse::<u16>().ok())
                    .unwrap_or(8787),
            },
            security: SecurityConfig {
                provider_key_encryption_secret: required_env("PROVIDER_KEY_ENCRYPTION_SECRET")?,
            },
        })
    }
}

impl DatabaseConfig {
    pub fn connection_url(&self) -> String {
        self.url.clone()
    }
}

fn load_database_config() -> Result<DatabaseConfig, String> {
    let url = required_env("DATABASE_URL")?;
    let backend = if url.starts_with("sqlite:") {
        DatabaseBackend::Sqlite
    } else if url.starts_with("postgres://") || url.starts_with("postgresql://") {
        DatabaseBackend::Postgres
    } else if url.starts_with("mysql://") {
        DatabaseBackend::Mysql
    } else {
        return Err(
            "DATABASE_URL must start with sqlite:, postgres://, postgresql://, or mysql://"
                .to_string(),
        );
    };

    Ok(DatabaseConfig { url, backend })
}

fn required_env(key: &str) -> Result<String, String> {
    env::var(key)
        .map(|value| value.trim().to_string())
        .map_err(|_| format!("{key} is required"))
        .and_then(|value| {
            if value.is_empty() {
                Err(format!("{key} is required"))
            } else {
                Ok(value)
            }
        })
}
