use std::{collections::BTreeMap, sync::Arc, time::Duration};

use aws_config::BehaviorVersion;
use aws_credential_types::Credentials;
use aws_sdk_s3::{Client as S3Client, config::Region, presigning::PresigningConfig};
use axum::{
    Json,
    extract::{Path, State},
    http::StatusCode,
};
use chrono::Utc;
use sea_orm::{ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, Set};
use serde::{Deserialize, Serialize};
use tower_cookies::Cookies;
use uuid::Uuid;

use crate::{
    app_state::AppState,
    config::{AppConfig, StorageConfig},
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
pub struct FilesService {
    database: DatabaseConnection,
    config: Arc<AppConfig>,
    s3_client: Option<S3Client>,
}

impl FilesService {
    pub fn new(database: DatabaseConnection, config: Arc<AppConfig>) -> Self {
        let s3_client = config.storage.as_ref().map(build_s3_client);
        Self {
            database,
            config,
            s3_client,
        }
    }

    pub fn capabilities(&self) -> FileCapabilitiesResponse {
        FileCapabilitiesResponse {
            enabled: self.config.storage.is_some() && self.s3_client.is_some(),
            max_file_size_bytes: self
                .config
                .storage
                .as_ref()
                .map(|storage| storage.max_file_size_bytes),
        }
    }

    pub async fn create_upload_intent(
        &self,
        user_id: &str,
        payload: CreateUploadIntentRequest,
    ) -> Result<CreateUploadIntentResponse, HttpError> {
        let storage = self.storage_config()?;
        let s3_client = self.s3_client()?;

        if payload.size == 0 || payload.size > storage.max_file_size_bytes {
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
        let url = format!("{}/{}", storage.public_base_url, object_key);
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

        let presigned = s3_client
            .put_object()
            .bucket(&storage.bucket)
            .key(&object_key)
            .content_type(&mime_type)
            .content_length(size_bytes)
            .presigned(
                PresigningConfig::expires_in(Duration::from_secs(UPLOAD_PRESIGN_TTL_SECONDS))
                    .map_err(|_| HttpError::internal("Failed to create upload request."))?,
            )
            .await
            .map_err(|_| HttpError::internal("Failed to create upload request."))?;

        Ok(CreateUploadIntentResponse {
            file: to_file_attachment_payload(item)?,
            upload: UploadRequestPayload {
                method: presigned.method().to_string(),
                url: presigned.uri().to_string(),
                headers: presigned
                    .headers()
                    .map(|(name, value)| (name.to_string(), value.to_string()))
                    .collect(),
            },
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

    fn storage_config(&self) -> Result<&StorageConfig, HttpError> {
        self.config.storage.as_ref().ok_or_else(|| {
            HttpError::new(
                StatusCode::SERVICE_UNAVAILABLE,
                "File upload is not configured.",
                Some("file_upload_disabled".to_string()),
            )
        })
    }

    fn s3_client(&self) -> Result<&S3Client, HttpError> {
        self.s3_client.as_ref().ok_or_else(|| {
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

fn build_s3_client(storage: &StorageConfig) -> S3Client {
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
