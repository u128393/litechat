use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[derive(DeriveIden)]
enum ModelConfigs {
    Table,
    SupportsImageGeneration,
}

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                Table::alter()
                    .table(ModelConfigs::Table)
                    .add_column(
                        ColumnDef::new(ModelConfigs::SupportsImageGeneration)
                            .boolean()
                            .not_null()
                            .default(false),
                    )
                    .to_owned(),
            )
            .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                Table::alter()
                    .table(ModelConfigs::Table)
                    .drop_column(ModelConfigs::SupportsImageGeneration)
                    .to_owned(),
            )
            .await?;

        Ok(())
    }
}
