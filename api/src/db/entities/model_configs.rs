use chrono::{DateTime, Utc};
use sea_orm::entity::prelude::*;

#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel)]
#[sea_orm(table_name = "model_configs")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: String,
    pub provider_config_id: String,
    pub model_id: String,
    pub display_name: String,
    pub visible: bool,
    pub supports_web_search: bool,
    pub supports_image_generation: bool,
    pub sort_order: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::provider_configs::Entity",
        from = "Column::ProviderConfigId",
        to = "super::provider_configs::Column::Id",
        on_update = "Cascade",
        on_delete = "Cascade"
    )]
    ProviderConfig,
}

impl Related<super::provider_configs::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::ProviderConfig.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
