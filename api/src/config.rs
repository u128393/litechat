use std::env;

use url::Url;

const DEFAULT_SESSION_COOKIE_NAME: &str = "litechat_session";
const DEFAULT_SESSION_TTL_HOURS: i64 = 24 * 30;

#[derive(Clone, Debug)]
pub struct AppConfig {
    pub auth: AuthConfig,
    pub database: DatabaseConfig,
    pub server: ServerConfig,
    pub security: SecurityConfig,
    pub storage: Option<StorageConfig>,
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
pub enum StorageConfig {
    S3(S3StorageConfig),
    Oss(OssStorageConfig),
}

#[derive(Clone, Debug)]
pub struct S3StorageConfig {
    pub bucket: String,
    pub region: String,
    pub endpoint: Option<String>,
    pub access_key_id: String,
    pub secret_access_key: String,
    pub public_base_url: String,
    pub force_path_style: bool,
    pub max_file_size_bytes: u64,
}

#[derive(Clone, Debug)]
pub struct OssStorageConfig {
    pub bucket: String,
    pub endpoint: String,
    pub region: String,
    pub access_key_id: String,
    pub access_key_secret: String,
    pub public_endpoint: String,
    pub max_file_size_bytes: u64,
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
            storage: load_storage_config()?,
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

fn load_storage_config() -> Result<Option<StorageConfig>, String> {
    let s3 = load_s3_storage_config()?;
    let oss = load_oss_storage_config()?;

    match (s3, oss) {
        (None, None) => Ok(None),
        (Some(config), None) => Ok(Some(StorageConfig::S3(config))),
        (None, Some(config)) => Ok(Some(StorageConfig::Oss(config))),
        (Some(_), Some(_)) => Err(
            "Configure only one file storage backend: STORAGE_S3_* or STORAGE_OSS_*.".to_string(),
        ),
    }
}

fn load_s3_storage_config() -> Result<Option<S3StorageConfig>, String> {
    let keys = [
        "STORAGE_S3_BUCKET",
        "STORAGE_S3_REGION",
        "STORAGE_S3_ACCESS_KEY_ID",
        "STORAGE_S3_SECRET_ACCESS_KEY",
        "STORAGE_S3_PUBLIC_BASE_URL",
        "STORAGE_S3_ENDPOINT",
        "STORAGE_S3_FORCE_PATH_STYLE",
        "STORAGE_S3_MAX_FILE_SIZE_BYTES",
    ];

    if !has_any_env(&keys) {
        return Ok(None);
    }

    let bucket = required_storage_env("STORAGE_S3_BUCKET")?;
    let region = required_storage_env("STORAGE_S3_REGION")?;
    let access_key_id = required_storage_env("STORAGE_S3_ACCESS_KEY_ID")?;
    let secret_access_key = required_storage_env("STORAGE_S3_SECRET_ACCESS_KEY")?;
    let public_base_url = required_storage_env("STORAGE_S3_PUBLIC_BASE_URL")?;

    Ok(Some(S3StorageConfig {
        bucket,
        region,
        endpoint: optional_env("STORAGE_S3_ENDPOINT"),
        access_key_id,
        secret_access_key,
        public_base_url: normalize_public_base_url(&public_base_url),
        force_path_style: env::var("STORAGE_S3_FORCE_PATH_STYLE")
            .ok()
            .map(|value| {
                matches!(
                    value.trim().to_ascii_lowercase().as_str(),
                    "1" | "true" | "yes"
                )
            })
            .unwrap_or(false),
        max_file_size_bytes: env::var("STORAGE_S3_MAX_FILE_SIZE_BYTES")
            .ok()
            .and_then(|value| value.parse::<u64>().ok())
            .unwrap_or(50 * 1024 * 1024),
    }))
}

fn load_oss_storage_config() -> Result<Option<OssStorageConfig>, String> {
    let keys = [
        "STORAGE_OSS_ENDPOINT",
        "STORAGE_OSS_ACCESS_KEY_ID",
        "STORAGE_OSS_ACCESS_KEY_SECRET",
        "STORAGE_OSS_PUBLIC_ENDPOINT",
        "STORAGE_OSS_MAX_FILE_SIZE_BYTES",
    ];

    if !has_any_env(&keys) {
        return Ok(None);
    }

    let endpoint = required_storage_env("STORAGE_OSS_ENDPOINT")?;
    let endpoint = normalize_endpoint(&endpoint);
    let (bucket, region) = parse_oss_virtual_host_endpoint(&endpoint)?;
    let access_key_id = required_storage_env("STORAGE_OSS_ACCESS_KEY_ID")?;
    let access_key_secret = required_storage_env("STORAGE_OSS_ACCESS_KEY_SECRET")?;
    let public_endpoint = optional_env("STORAGE_OSS_PUBLIC_ENDPOINT")
        .map(|value| normalize_endpoint(&value))
        .unwrap_or_else(|| endpoint.clone());

    Ok(Some(OssStorageConfig {
        bucket,
        endpoint,
        region,
        access_key_id,
        access_key_secret,
        public_endpoint,
        max_file_size_bytes: env::var("STORAGE_OSS_MAX_FILE_SIZE_BYTES")
            .ok()
            .and_then(|value| value.parse::<u64>().ok())
            .unwrap_or(50 * 1024 * 1024),
    }))
}

fn has_any_env(keys: &[&str]) -> bool {
    keys.iter().any(|key| optional_env(key).is_some())
}

fn required_storage_env(key: &str) -> Result<String, String> {
    optional_env(key).ok_or_else(|| format!("{key} is required when file storage is configured"))
}

fn normalize_public_base_url(value: &str) -> String {
    value.trim_end_matches('/').to_string()
}

fn normalize_endpoint(value: &str) -> String {
    value.trim_end_matches('/').to_string()
}

fn parse_oss_virtual_host_endpoint(endpoint: &str) -> Result<(String, String), String> {
    let url = Url::parse(endpoint).map_err(|_| {
        "STORAGE_OSS_ENDPOINT must be a valid virtual-host style HTTPS URL.".to_string()
    })?;

    if url.scheme() != "https" {
        return Err("STORAGE_OSS_ENDPOINT must use https.".to_string());
    }

    let host = url.host_str().ok_or_else(|| {
        "STORAGE_OSS_ENDPOINT must include a virtual-host style OSS host.".to_string()
    })?;
    let mut labels = host.split('.');
    let bucket = labels.next().unwrap_or_default();
    let oss_region = labels.next().unwrap_or_default();

    if bucket.is_empty() || !oss_region.starts_with("oss-") {
        return Err(
            "STORAGE_OSS_ENDPOINT must use virtual-host style, for example https://bucket.oss-cn-hongkong.aliyuncs.com."
                .to_string(),
        );
    }

    let region = oss_region.trim_start_matches("oss-");
    if region.is_empty() {
        return Err("STORAGE_OSS_ENDPOINT contains an invalid OSS region.".to_string());
    }

    Ok((bucket.to_string(), region.to_string()))
}

fn optional_env(key: &str) -> Option<String> {
    env::var(key)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}
