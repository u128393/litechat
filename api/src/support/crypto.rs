use aes_gcm::{
    Aes256Gcm, Nonce,
    aead::{Aead, KeyInit},
};
use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
use sha2::{Digest, Sha256};

use crate::config::AppConfig;

const ENCRYPTION_VERSION: &str = "v1";
const IV_BYTES: usize = 12;

pub fn encrypt_provider_api_key(config: &AppConfig, api_key: &str) -> Result<String, String> {
    let iv = rand::random::<[u8; IV_BYTES]>();
    let cipher = Aes256Gcm::new_from_slice(&derive_key(config))
        .map_err(|_| "Invalid encryption key.".to_string())?;
    let encrypted = cipher
        .encrypt(Nonce::from_slice(&iv), api_key.as_bytes())
        .map_err(|_| "Provider API key encryption failed.".to_string())?;

    let ciphertext_len = encrypted.len().saturating_sub(16);
    let (ciphertext, auth_tag) = encrypted.split_at(ciphertext_len);

    Ok([
        ENCRYPTION_VERSION.to_string(),
        URL_SAFE_NO_PAD.encode(iv),
        URL_SAFE_NO_PAD.encode(ciphertext),
        URL_SAFE_NO_PAD.encode(auth_tag),
    ]
    .join(":"))
}

pub fn decrypt_provider_api_key(config: &AppConfig, value: &str) -> Result<String, String> {
    let parts = value.split(':').collect::<Vec<_>>();
    if parts.len() != 4 || parts[0] != ENCRYPTION_VERSION {
        return Err("Provider API key ciphertext is invalid.".to_string());
    }

    let iv = URL_SAFE_NO_PAD
        .decode(parts[1])
        .map_err(|_| "Provider API key ciphertext is invalid.".to_string())?;
    let ciphertext = URL_SAFE_NO_PAD
        .decode(parts[2])
        .map_err(|_| "Provider API key ciphertext is invalid.".to_string())?;
    let auth_tag = URL_SAFE_NO_PAD
        .decode(parts[3])
        .map_err(|_| "Provider API key ciphertext is invalid.".to_string())?;

    let mut payload = ciphertext;
    payload.extend(auth_tag);

    let cipher = Aes256Gcm::new_from_slice(&derive_key(config))
        .map_err(|_| "Invalid encryption key.".to_string())?;
    let decrypted = cipher
        .decrypt(Nonce::from_slice(&iv), payload.as_ref())
        .map_err(|_| "Provider API key ciphertext is invalid.".to_string())?;

    String::from_utf8(decrypted).map_err(|_| "Provider API key ciphertext is invalid.".to_string())
}

fn derive_key(config: &AppConfig) -> [u8; 32] {
    let digest = Sha256::digest(config.security.provider_key_encryption_secret.as_bytes());
    let mut key = [0_u8; 32];
    key.copy_from_slice(&digest);
    key
}
