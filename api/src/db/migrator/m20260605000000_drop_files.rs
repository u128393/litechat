use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[derive(DeriveIden)]
enum Files {
    Table,
    Id,
    UserId,
    ObjectKey,
    Name,
    MimeType,
    SizeBytes,
    Url,
    Status,
    CreatedAt,
    UpdatedAt,
}

#[derive(DeriveIden)]
enum Users {
    Table,
    Id,
}

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(Files::Table).if_exists().to_owned())
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(Files::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(Files::Id)
                            .string_len(191)
                            .not_null()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(Files::UserId).string_len(191).not_null())
                    .col(ColumnDef::new(Files::ObjectKey).string_len(2048).not_null())
                    .col(ColumnDef::new(Files::Name).string_len(512).not_null())
                    .col(ColumnDef::new(Files::MimeType).string_len(255).not_null())
                    .col(ColumnDef::new(Files::SizeBytes).big_integer().not_null())
                    .col(ColumnDef::new(Files::Url).string_len(4096).not_null())
                    .col(ColumnDef::new(Files::Status).string_len(32).not_null())
                    .col(
                        ColumnDef::new(Files::CreatedAt)
                            .timestamp_with_time_zone()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(Files::UpdatedAt)
                            .timestamp_with_time_zone()
                            .not_null(),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk-files-user-id")
                            .from(Files::Table, Files::UserId)
                            .to(Users::Table, Users::Id)
                            .on_delete(ForeignKeyAction::Cascade)
                            .on_update(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("files_user_id_idx")
                    .table(Files::Table)
                    .col(Files::UserId)
                    .to_owned(),
            )
            .await?;

        Ok(())
    }
}
