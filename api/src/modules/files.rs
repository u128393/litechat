use std::{collections::BTreeMap, env, sync::Arc, time::Duration};

use aws_config::BehaviorVersion;
use aws_credential_types::Credentials;
use aws_sdk_s3::{Client as S3Client, config::Region, presigning::PresigningConfig};
use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use chrono::Utc;
use hmac::{Hmac, Mac};
use sea_orm::{ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, Set};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tower_cookies::Cookies;
use tracing::info;
use url::Url;
use uuid::Uuid;

use crate::{
    app_state::AppState,
    config::{AppConfig, OssStorageConfig, S3StorageConfig, StorageConfig},
    db::entities::files,
    http_error::HttpError,
};

const FILE_STATUS_PENDING: &str = "pending";
const FILE_STATUS_READY: &str = "ready";
const UPLOAD_PRESIGN_TTL_SECONDS: u64 = 15 * 60;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateUploadIntentRequest {
    pub file_name: String,
    pub mime_type: Option<String>,
    pub size: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileCapabilitiesResponse {
    pub enabled: bool,
    pub max_file_size_bytes: Option<u64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileAttachmentPayload {
    pub id: String,
    pub name: String,
    pub mime_type: String,
    pub size: u64,
    pub url: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UploadRequestPayload {
    pub method: String,
    pub url: String,
    pub headers: BTreeMap<String, String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateUploadIntentResponse {
    pub file: FileAttachmentPayload,
    pub upload: UploadRequestPayload,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CompleteUploadResponse {
    pub file: FileAttachmentPayload,
}

#[derive(Clone)]
enum StorageBackend {
    S3 {
        config: S3StorageConfig,
        client: S3Client,
    },
    Oss {
        config: OssStorageConfig,
    },
}

#[derive(Clone)]
pub struct FilesService {
    database: DatabaseConnection,
    storage: Option<StorageBackend>,
}

impl FilesService {
    pub fn new(database: DatabaseConnection, config: Arc<AppConfig>) -> Self {
        let storage = config.storage.as_ref().map(build_storage_backend);
        Self { database, storage }
    }

    pub fn capabilities(&self) -> FileCapabilitiesResponse {
        FileCapabilitiesResponse {
            enabled: self.storage.is_some(),
            max_file_size_bytes: self
                .storage
                .as_ref()
                .map(StorageBackend::max_file_size_bytes),
        }
    }

    pub async fn create_upload_intent(
        &self,
        user_id: &str,
        payload: CreateUploadIntentRequest,
    ) -> Result<CreateUploadIntentResponse, HttpError> {
        let storage = self.storage_backend()?;

        if payload.size == 0 || payload.size > storage.max_file_size_bytes() {
            return Err(HttpError::new(
                StatusCode::BAD_REQUEST,
                "File size is not allowed.",
                Some("invalid_request".to_string()),
            ));
        }

        let id = Uuid::new_v4().to_string();
        let name = sanitize_file_name(&payload.file_name);
        let mime_type = payload
            .mime_type
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_string)
            .unwrap_or_else(|| guess_mime_type(&name));
        let object_key = format!("uploads/{id}/{name}");
        let url = storage.public_url(&object_key);
        let now = Utc::now();
        let size_bytes = i64::try_from(payload.size).map_err(|_| {
            HttpError::new(
                StatusCode::BAD_REQUEST,
                "File size is not allowed.",
                Some("invalid_request".to_string()),
            )
        })?;

        let item = files::ActiveModel {
            id: Set(id),
            user_id: Set(user_id.to_string()),
            object_key: Set(object_key.clone()),
            name: Set(name),
            mime_type: Set(mime_type.clone()),
            size_bytes: Set(size_bytes),
            url: Set(url),
            status: Set(FILE_STATUS_PENDING.to_string()),
            created_at: Set(now),
            updated_at: Set(now),
        }
        .insert(&self.database)
        .await
        .map_err(internal_error)?;

        let upload = storage
            .create_upload_request(&object_key, &mime_type, size_bytes)
            .await?;

        Ok(CreateUploadIntentResponse {
            file: to_file_attachment_payload(item)?,
            upload,
        })
    }

    pub async fn complete_upload(
        &self,
        user_id: &str,
        file_id: String,
    ) -> Result<CompleteUploadResponse, HttpError> {
        let item = files::Entity::find_by_id(file_id)
            .filter(files::Column::UserId.eq(user_id.to_string()))
            .one(&self.database)
            .await
            .map_err(internal_error)?
            .ok_or_else(|| HttpError::new(StatusCode::NOT_FOUND, "File not found.", None))?;

        let mut model: files::ActiveModel = item.into();
        model.status = Set(FILE_STATUS_READY.to_string());
        model.updated_at = Set(Utc::now());

        Ok(CompleteUploadResponse {
            file: to_file_attachment_payload(
                model.update(&self.database).await.map_err(internal_error)?,
            )?,
        })
    }

    fn storage_backend(&self) -> Result<&StorageBackend, HttpError> {
        self.storage.as_ref().ok_or_else(|| {
            HttpError::new(
                StatusCode::SERVICE_UNAVAILABLE,
                "File upload is not configured.",
                Some("file_upload_disabled".to_string()),
            )
        })
    }
}

pub async fn capabilities(State(state): State<AppState>) -> Json<FileCapabilitiesResponse> {
    Json(state.files_service.capabilities())
}

pub async fn create_upload_intent(
    State(state): State<AppState>,
    cookies: Cookies,
    Json(payload): Json<CreateUploadIntentRequest>,
) -> Result<Json<CreateUploadIntentResponse>, HttpError> {
    let user = state.auth_service.require_current_user(&cookies).await?;
    Ok(Json(
        state
            .files_service
            .create_upload_intent(&user.user_id, payload)
            .await?,
    ))
}

pub async fn complete_upload(
    State(state): State<AppState>,
    cookies: Cookies,
    Path(file_id): Path<String>,
) -> Result<Json<CompleteUploadResponse>, HttpError> {
    let user = state.auth_service.require_current_user(&cookies).await?;
    Ok(Json(
        state
            .files_service
            .complete_upload(&user.user_id, file_id)
            .await?,
    ))
}

impl StorageBackend {
    fn max_file_size_bytes(&self) -> u64 {
        match self {
            StorageBackend::S3 { config, .. } => config.max_file_size_bytes,
            StorageBackend::Oss { config } => config.max_file_size_bytes,
        }
    }

    fn public_url(&self, object_key: &str) -> String {
        match self {
            StorageBackend::S3 { config, .. } => {
                format!("{}/{}", config.public_base_url, object_key)
            }
            StorageBackend::Oss { config } => format!("{}/{}", config.public_endpoint, object_key),
        }
    }

    async fn create_upload_request(
        &self,
        object_key: &str,
        mime_type: &str,
        size_bytes: i64,
    ) -> Result<UploadRequestPayload, HttpError> {
        match self {
            StorageBackend::S3 { config, client } => {
                let presigned = client
                    .put_object()
                    .bucket(&config.bucket)
                    .key(object_key)
                    .content_type(mime_type)
                    .content_length(size_bytes)
                    .presigned(
                        PresigningConfig::expires_in(Duration::from_secs(
                            UPLOAD_PRESIGN_TTL_SECONDS,
                        ))
                        .map_err(|_| HttpError::internal("Failed to create upload request."))?,
                    )
                    .await
                    .map_err(|_| HttpError::internal("Failed to create upload request."))?;

                Ok(UploadRequestPayload {
                    method: presigned.method().to_string(),
                    url: presigned.uri().to_string(),
                    headers: presigned
                        .headers()
                        .map(|(name, value)| (name.to_string(), value.to_string()))
                        .collect(),
                })
            }
            StorageBackend::Oss { config } => {
                create_oss_upload_request(config, object_key, mime_type)
            }
        }
    }
}

fn build_storage_backend(storage: &StorageConfig) -> StorageBackend {
    match storage {
        StorageConfig::S3(config) => StorageBackend::S3 {
            config: config.clone(),
            client: build_s3_client(config),
        },
        StorageConfig::Oss(config) => StorageBackend::Oss {
            config: config.clone(),
        },
    }
}

fn build_s3_client(storage: &S3StorageConfig) -> S3Client {
    let credentials = Credentials::new(
        storage.access_key_id.clone(),
        storage.secret_access_key.clone(),
        None,
        None,
        "litechat-storage",
    );
    let mut builder = aws_sdk_s3::config::Builder::new()
        .behavior_version(BehaviorVersion::latest())
        .region(Region::new(storage.region.clone()))
        .credentials_provider(credentials)
        .force_path_style(storage.force_path_style);

    if let Some(endpoint) = storage.endpoint.as_ref() {
        builder = builder.endpoint_url(endpoint);
    }

    S3Client::from_conf(builder.build())
}

fn create_oss_upload_request(
    config: &OssStorageConfig,
    object_key: &str,
    mime_type: &str,
) -> Result<UploadRequestPayload, HttpError> {
    let now = Utc::now();
    let date = now.format("%Y%m%d").to_string();
    let date_time = now.format("%Y%m%dT%H%M%SZ").to_string();
    let credential_scope = format!("{date}/{}/oss/aliyun_v4_request", config.region);
    let credential = format!("{}/{}", config.access_key_id, credential_scope);
    let additional_headers = "host";
    let host = oss_host(config)?;
    let canonical_uri = build_oss_canonical_uri(config, object_key)?;
    let expires = UPLOAD_PRESIGN_TTL_SECONDS.to_string();
    let canonical_query =
        build_oss_v4_canonical_query(additional_headers, &credential, &date_time, &expires);
    let canonical_headers = format!("content-type:{mime_type}\nhost:{host}\n");
    let canonical_request = format!(
        "PUT\n{canonical_uri}\n{canonical_query}\n{canonical_headers}\n{additional_headers}\nUNSIGNED-PAYLOAD"
    );
    let canonical_request_sha256 = hex_sha256(&canonical_request);
    let string_to_sign = format!(
        "OSS4-HMAC-SHA256\n{date_time}\n{credential_scope}\n{}",
        canonical_request_sha256
    );
    let signature = sign_oss_v4_request(
        &config.access_key_secret,
        &date,
        &config.region,
        &string_to_sign,
    )?;
    log_oss_v4_signature_debug(OssV4SignatureDebugLog {
        object_key,
        host: &host,
        credential: &credential,
        additional_headers,
        canonical_uri: &canonical_uri,
        canonical_query: &canonical_query,
        canonical_headers: &canonical_headers,
        canonical_request: &canonical_request,
        canonical_request_sha256: &canonical_request_sha256,
        string_to_sign: &string_to_sign,
        signature: &signature,
    });
    let url = build_oss_upload_url(
        config,
        object_key,
        additional_headers,
        &credential,
        &date_time,
        &expires,
        &signature,
    )?;

    Ok(UploadRequestPayload {
        method: "PUT".to_string(),
        url,
        headers: BTreeMap::from([("Content-Type".to_string(), mime_type.to_string())]),
    })
}

struct OssV4SignatureDebugLog<'a> {
    object_key: &'a str,
    host: &'a str,
    credential: &'a str,
    additional_headers: &'a str,
    canonical_uri: &'a str,
    canonical_query: &'a str,
    canonical_headers: &'a str,
    canonical_request: &'a str,
    canonical_request_sha256: &'a str,
    string_to_sign: &'a str,
    signature: &'a str,
}

fn log_oss_v4_signature_debug(payload: OssV4SignatureDebugLog<'_>) {
    if !oss_signature_debug_enabled() {
        return;
    }

    info!(
        target: "litechat::oss_signature",
        object_key = payload.object_key,
        host = payload.host,
        credential = payload.credential,
        additional_headers = payload.additional_headers,
        canonical_uri = payload.canonical_uri,
        canonical_query = payload.canonical_query,
        canonical_headers = payload.canonical_headers,
        canonical_request = payload.canonical_request,
        canonical_request_sha256 = payload.canonical_request_sha256,
        string_to_sign = payload.string_to_sign,
        signature = payload.signature,
        "OSS V4 upload signature debug"
    );
}

fn oss_signature_debug_enabled() -> bool {
    cfg!(debug_assertions)
        || env::var("STORAGE_OSS_DEBUG_SIGNATURE")
            .ok()
            .map(|value| {
                matches!(
                    value.trim().to_ascii_lowercase().as_str(),
                    "1" | "true" | "yes"
                )
            })
            .unwrap_or(false)
}

fn sign_oss_v4_request(
    access_key_secret: &str,
    date: &str,
    region: &str,
    string_to_sign: &str,
) -> Result<String, HttpError> {
    let date_key = hmac_sha256(format!("aliyun_v4{access_key_secret}").as_bytes(), date)?;
    let region_key = hmac_sha256(&date_key, region)?;
    let service_key = hmac_sha256(&region_key, "oss")?;
    let signing_key = hmac_sha256(&service_key, "aliyun_v4_request")?;
    Ok(hex_encode(&hmac_sha256(&signing_key, string_to_sign)?))
}

fn hmac_sha256(key: &[u8], data: &str) -> Result<Vec<u8>, HttpError> {
    let mut mac = Hmac::<Sha256>::new_from_slice(key)
        .map_err(|_| HttpError::internal("Failed to create upload request."))?;
    mac.update(data.as_bytes());
    Ok(mac.finalize().into_bytes().to_vec())
}

fn hex_sha256(value: &str) -> String {
    hex_encode(&Sha256::digest(value.as_bytes()))
}

fn hex_encode(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

fn build_oss_v4_canonical_query(
    additional_headers: &str,
    credential: &str,
    date_time: &str,
    expires: &str,
) -> String {
    let mut query = vec![
        ("x-oss-additional-headers", additional_headers),
        ("x-oss-credential", credential),
        ("x-oss-date", date_time),
        ("x-oss-expires", expires),
        ("x-oss-signature-version", "OSS4-HMAC-SHA256"),
    ];
    query.sort_by(|left, right| left.0.cmp(right.0));

    let mut url = Url::parse("https://example.com/").expect("static URL is valid");
    {
        let mut pairs = url.query_pairs_mut();
        for (key, value) in query {
            pairs.append_pair(key, value);
        }
    }
    url.query().unwrap_or_default().to_string()
}

fn build_oss_canonical_uri(
    config: &OssStorageConfig,
    object_key: &str,
) -> Result<String, HttpError> {
    let url = build_oss_object_url(
        "https://example.com",
        &format!("{}/{}", config.bucket, object_key),
    )?;
    Ok(url.path().to_string())
}

fn oss_host(config: &OssStorageConfig) -> Result<String, HttpError> {
    Url::parse(&config.endpoint)
        .map_err(|_| HttpError::internal("Failed to create upload request."))?
        .host_str()
        .map(str::to_string)
        .ok_or_else(|| HttpError::internal("Failed to create upload request."))
}

fn build_oss_upload_url(
    config: &OssStorageConfig,
    object_key: &str,
    additional_headers: &str,
    credential: &str,
    date_time: &str,
    expires: &str,
    signature: &str,
) -> Result<String, HttpError> {
    let mut url = build_oss_object_url(&config.endpoint, object_key)?;
    url.query_pairs_mut()
        .append_pair("x-oss-additional-headers", additional_headers)
        .append_pair("x-oss-credential", credential)
        .append_pair("x-oss-date", date_time)
        .append_pair("x-oss-expires", expires)
        .append_pair("x-oss-signature", signature)
        .append_pair("x-oss-signature-version", "OSS4-HMAC-SHA256");
    Ok(url.to_string())
}

fn build_oss_object_url(endpoint: &str, object_key: &str) -> Result<Url, HttpError> {
    let mut url = Url::parse(endpoint)
        .map_err(|_| HttpError::internal("Failed to create upload request."))?;
    url.set_path("");
    url.path_segments_mut()
        .map_err(|_| HttpError::internal("Failed to create upload request."))?
        .extend(object_key.split('/'));
    Ok(url)
}

fn sanitize_file_name(value: &str) -> String {
    let mut output = String::new();
    for character in value.trim().chars() {
        if character.is_ascii_alphanumeric() || matches!(character, '.' | '_' | '-') {
            output.push(character);
        } else if character.is_whitespace() {
            output.push('-');
        }
    }

    let output = output
        .trim_matches(['.', '-'])
        .chars()
        .take(160)
        .collect::<String>();
    if output.is_empty() {
        "file".to_string()
    } else {
        output
    }
}

fn guess_mime_type(file_name: &str) -> String {
    mime_guess::from_path(file_name)
        .first_raw()
        .unwrap_or("application/octet-stream")
        .to_string()
}

fn to_file_attachment_payload(item: files::Model) -> Result<FileAttachmentPayload, HttpError> {
    Ok(FileAttachmentPayload {
        id: item.id,
        name: item.name,
        mime_type: item.mime_type,
        size: u64::try_from(item.size_bytes)
            .map_err(|_| HttpError::internal("Invalid file size."))?,
        url: item.url,
    })
}

fn internal_error(error: sea_orm::DbErr) -> HttpError {
    HttpError::internal(format!("Database error: {error}"))
}
