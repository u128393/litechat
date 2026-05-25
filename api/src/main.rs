mod app_state;
mod config;
mod db;
mod http_error;
mod modules;
mod routes;
mod support;

use std::{
    collections::BTreeMap,
    fs,
    path::{Path, PathBuf},
};

use axum::serve;
use clap::{CommandFactory, Parser, Subcommand};
use dialoguer::{Input, Password};
use sea_orm::{EntityTrait, PaginatorTrait};
use tokio::net::TcpListener;
use tower_cookies::CookieManagerLayer;
use tracing::info;

use crate::{
    app_state::AppState,
    config::AppConfig,
    db::{connect_database, migrate_database},
    modules::users::CreateInitialAdminRequest,
    routes::create_router,
    support::password::hash_password,
};

#[derive(Parser)]
#[command(name = "litechat", version, about = "LiteChat API service")]
struct Cli {
    #[command(subcommand)]
    command: Option<Commands>,
}

#[derive(Subcommand)]
enum Commands {
    Serve,
    Migrate,
    Init,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();
    tracing_subscriber::fmt()
        .with_target(false)
        .compact()
        .init();

    let cli = Cli::parse();

    match cli.command {
        None => {
            Cli::command().print_help()?;
            println!();
        }
        Some(Commands::Serve) => serve_command().await?,
        Some(Commands::Migrate) => migrate_command().await?,
        Some(Commands::Init) => init_command().await?,
    }

    Ok(())
}

async fn serve_command() -> Result<(), Box<dyn std::error::Error>> {
    let config = AppConfig::load().map_err(std::io::Error::other)?;
    let database = connect_database(&config).await?;
    migrate_database(&database).await?;

    let bind_address = format!("{}:{}", config.server.host, config.server.port);
    let state = AppState::new(config, database);
    let app = create_router(state).layer(CookieManagerLayer::new());
    let listener = TcpListener::bind(&bind_address).await?;

    info!("listening on http://{bind_address}");

    serve(listener, app).await?;
    Ok(())
}

async fn migrate_command() -> Result<(), Box<dyn std::error::Error>> {
    let config = AppConfig::load().map_err(std::io::Error::other)?;
    let database = connect_database(&config).await?;
    migrate_database(&database).await?;
    println!("Applied database migrations.");
    Ok(())
}

async fn init_command() -> Result<(), Box<dyn std::error::Error>> {
    let env_path = PathBuf::from(".env");
    let existing = read_env_file(&env_path)?;

    let database_url = prompt_string(
        "Database connection string",
        existing
            .get("DATABASE_URL")
            .cloned()
            .unwrap_or_else(|| "sqlite://data/litechat.db?mode=rwc".to_string()),
    )?
    .trim()
    .to_string();

    if !(database_url.starts_with("sqlite:")
        || database_url.starts_with("postgres://")
        || database_url.starts_with("postgresql://")
        || database_url.starts_with("mysql://"))
    {
        return Err(std::io::Error::other(
            "Database connection string must start with sqlite:, postgres://, postgresql://, or mysql://.",
        )
        .into());
    }

    let auth_session_secret = prompt_string(
        "Session secret",
        existing
            .get("AUTH_SESSION_SECRET")
            .cloned()
            .unwrap_or_else(generate_secret),
    )?;
    let auth_session_cookie_name = prompt_string(
        "Session cookie name",
        existing
            .get("AUTH_SESSION_COOKIE_NAME")
            .cloned()
            .unwrap_or_else(|| "litechat_session".to_string()),
    )?;
    let auth_session_ttl_hours = prompt_string(
        "Session TTL hours",
        existing
            .get("AUTH_SESSION_TTL_HOURS")
            .cloned()
            .unwrap_or_else(|| "720".to_string()),
    )?;
    let provider_key_encryption_secret = prompt_string(
        "Provider key encryption secret",
        existing
            .get("PROVIDER_KEY_ENCRYPTION_SECRET")
            .cloned()
            .unwrap_or_else(generate_secret),
    )?;
    let app_host = prompt_string(
        "Bind host",
        existing
            .get("APP_HOST")
            .cloned()
            .unwrap_or_else(|| "127.0.0.1".to_string()),
    )?;
    let app_port = prompt_string(
        "Bind port",
        existing
            .get("APP_PORT")
            .cloned()
            .unwrap_or_else(|| "8787".to_string()),
    )?;
    let admin_email = prompt_admin_email()?;
    let admin_password = prompt_password()?;

    ensure_sqlite_database_parent_dir(&database_url)?;

    let merged = vec![
        ("DATABASE_URL", database_url),
        ("DATABASE_TYPE", String::new()),
        ("DATABASE_SQLITE_PATH", String::new()),
        ("DATABASE_HOST", String::new()),
        ("DATABASE_PORT", String::new()),
        ("DATABASE_NAME", String::new()),
        ("DATABASE_USER", String::new()),
        ("DATABASE_PASSWORD", String::new()),
        ("DATABASE_SSL_MODE", String::new()),
        ("AUTH_SESSION_SECRET", auth_session_secret),
        ("AUTH_SESSION_COOKIE_NAME", auth_session_cookie_name),
        ("AUTH_SESSION_TTL_HOURS", auth_session_ttl_hours),
        (
            "PROVIDER_KEY_ENCRYPTION_SECRET",
            provider_key_encryption_secret,
        ),
        ("APP_HOST", app_host),
        ("APP_PORT", app_port),
    ];

    write_env_file(&env_path, &existing, &merged)?;
    dotenvy::from_path_override(&env_path)?;

    let config = AppConfig::load().map_err(std::io::Error::other)?;
    let database = connect_database(&config).await?;
    migrate_database(&database).await?;

    if db::entities::users::Entity::find().count(&database).await? > 0 {
        return Err(std::io::Error::other("Database already contains users. `litechat init` only supports first-time initialization.").into());
    }

    let state = AppState::new(config, database);
    let password_hash =
        hash_password(&admin_password).map_err(|error| std::io::Error::other(error.message))?;
    state
        .users_service
        .create_initial_admin(CreateInitialAdminRequest {
            email: admin_email.clone(),
            password_hash,
        })
        .await
        .map_err(|error| std::io::Error::other(error.message))?;

    println!("Initialized database and created admin user {admin_email}.");
    Ok(())
}

fn prompt_string(label: &str, default: String) -> Result<String, Box<dyn std::error::Error>> {
    let input = Input::new().with_prompt(label);

    if default.is_empty() {
        Ok(input.interact_text()?)
    } else {
        Ok(input.default(default).interact_text()?)
    }
}

fn prompt_admin_email() -> Result<String, Box<dyn std::error::Error>> {
    Ok(Input::new()
        .with_prompt("Admin email")
        .validate_with(|input: &String| -> Result<(), &str> {
            if is_valid_email(input.trim()) {
                Ok(())
            } else {
                Err("Enter a valid email address.")
            }
        })
        .interact_text()?
        .trim()
        .to_lowercase())
}

fn prompt_password() -> Result<String, Box<dyn std::error::Error>> {
    Ok(Password::new()
        .with_prompt("Admin password")
        .with_confirmation("Confirm admin password", "Passwords did not match.")
        .interact()?)
}

fn ensure_sqlite_database_parent_dir(url: &str) -> Result<(), Box<dyn std::error::Error>> {
    let Some(database_path) = sqlite_database_path(url) else {
        return Ok(());
    };

    let parent = Path::new(database_path).parent();
    if let Some(parent) = parent.filter(|path| !path.as_os_str().is_empty()) {
        fs::create_dir_all(parent).map_err(|error| {
            std::io::Error::other(format!(
                "Failed to create SQLite database directory {}: {error}",
                parent.display()
            ))
        })?;
    }

    Ok(())
}

fn sqlite_database_path(url: &str) -> Option<&str> {
    if !url.starts_with("sqlite:") || url.contains("mode=memory") {
        return None;
    }

    let path_with_query = url
        .strip_prefix("sqlite://")
        .or_else(|| url.strip_prefix("sqlite:"))?;
    let path = path_with_query
        .split_once('?')
        .map_or(path_with_query, |(path, _)| path);

    if path.is_empty() || path == ":memory:" {
        None
    } else {
        Some(path)
    }
}

fn generate_secret() -> String {
    use base64::Engine;
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(rand::random::<[u8; 32]>())
}

fn is_valid_email(value: &str) -> bool {
    let mut parts = value.split('@');
    let Some(local) = parts.next() else {
        return false;
    };
    let Some(domain) = parts.next() else {
        return false;
    };

    !local.is_empty() && !domain.is_empty() && !domain.starts_with('.') && parts.next().is_none()
}

fn read_env_file(path: &PathBuf) -> Result<BTreeMap<String, String>, Box<dyn std::error::Error>> {
    let mut values = BTreeMap::new();
    let content = fs::read_to_string(path).unwrap_or_default();

    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }

        if let Some((key, value)) = trimmed.split_once('=') {
            values.insert(
                key.trim().to_string(),
                value.trim().trim_matches('"').to_string(),
            );
        }
    }

    Ok(values)
}

fn write_env_file(
    path: &PathBuf,
    existing: &BTreeMap<String, String>,
    updates: &[(&str, String)],
) -> Result<(), Box<dyn std::error::Error>> {
    let mut merged = existing.clone();
    for (key, value) in updates {
        if value.is_empty() {
            merged.remove(*key);
        } else {
            merged.insert((*key).to_string(), value.clone());
        }
    }

    let mut lines = Vec::new();
    for (key, value) in merged {
        if value.is_empty() {
            continue;
        }
        lines.push(format!("{key}={}", render_env_value(&value)));
    }

    fs::write(path, format!("{}\n", lines.join("\n")))?;
    Ok(())
}

fn render_env_value(value: &str) -> String {
    if value.chars().all(|character| {
        character.is_ascii_alphanumeric() || matches!(character, '_' | '-' | '.' | ':' | '/' | '@')
    }) {
        value.to_string()
    } else {
        format!("\"{}\"", value.replace('\\', "\\\\").replace('"', "\\\""))
    }
}
