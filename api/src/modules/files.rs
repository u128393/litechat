use std::{collections::BTreeMap, sync::Arc, time::Duration};

use aws_config::BehaviorVersion;
use aws_credential_types::Credentials;
use aws_sdk_s3::{Client as S3Client, config::Region, presigning::PresigningConfig};
use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use base64::{Engine as _, engine::general_purpose};
use chrono::Utc;
use hmac::{Hmac, Mac};
use percent_encoding::{AsciiSet, CONTROLS, utf8_percent_encode};
use sea_orm::{ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, Set};
use serde::{Deserialize, Serialize};
use sha1::Sha1;
use tower_cookies::Cookies;
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
const QUERY_ENCODE_SET: &AsciiSet = &CONTROLS
    .add(b' ')
    .add(b'"')
    .add(b'#')
    .add(b'%')
    .add(b'&')
    .add(b'+')
    .add(b'<')
    .add(b'>')
    .add(b'?')
    .add(b'[')
    .add(b']')
    .add(b'`')
    .add(b'{')
    .add(b'}');

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
            StorageBackend::Oss { config } => format!("{}/{}", config.public_base_url, object_key),
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
    let expires = Utc::now().timestamp() + UPLOAD_PRESIGN_TTL_SECONDS as i64;
    let canonical_resource = format!("/{}/{}", config.bucket, object_key);
    let string_to_sign = format!("PUT\n\n{mime_type}\n{expires}\n{canonical_resource}");
    let signature = sign_oss_request(&config.access_key_secret, &string_to_sign)?;
    let encoded_access_key_id = percent_encode_query(&config.access_key_id);
    let encoded_signature = percent_encode_query(&signature);
    let encoded_object_key = percent_encode_object_key(object_key);
    let url = format!(
        "{}/{encoded_object_key}?OSSAccessKeyId={encoded_access_key_id}&Expires={expires}&Signature={encoded_signature}",
        config.endpoint
    );

    Ok(UploadRequestPayload {
        method: "PUT".to_string(),
        url,
        headers: BTreeMap::from([("Content-Type".to_string(), mime_type.to_string())]),
    })
}

fn sign_oss_request(access_key_secret: &str, string_to_sign: &str) -> Result<String, HttpError> {
    let mut mac = Hmac::<Sha1>::new_from_slice(access_key_secret.as_bytes())
        .map_err(|_| HttpError::internal("Failed to create upload request."))?;
    mac.update(string_to_sign.as_bytes());
    Ok(general_purpose::STANDARD.encode(mac.finalize().into_bytes()))
}

fn percent_encode_query(value: &str) -> String {
    utf8_percent_encode(value, QUERY_ENCODE_SET).to_string()
}

fn percent_encode_object_key(value: &str) -> String {
    value
        .split('/')
        .map(percent_encode_query)
        .collect::<Vec<_>>()
        .join("/")
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
