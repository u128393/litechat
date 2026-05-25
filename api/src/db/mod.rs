pub mod entities;
mod migrator;

use sea_orm::{
    ConnectOptions, ConnectionTrait, Database, DatabaseBackend as SeaDatabaseBackend,
    DatabaseConnection, DbErr, Statement,
};
use sea_orm_migration::MigratorTrait;

use crate::config::{AppConfig, DatabaseBackend};

pub async fn connect_database(config: &AppConfig) -> Result<DatabaseConnection, DbErr> {
    let mut options = ConnectOptions::new(config.database.connection_url());
    options.max_connections(10).min_connections(1);
    let database = Database::connect(options).await?;

    if matches!(config.database.backend, DatabaseBackend::Sqlite) {
        database
            .execute(Statement::from_string(
                SeaDatabaseBackend::Sqlite,
                "PRAGMA foreign_keys = ON".to_string(),
            ))
            .await?;
    }

    Ok(database)
}

pub async fn migrate_database(database: &DatabaseConnection) -> Result<(), DbErr> {
    migrator::Migrator::up(database, None).await
}
