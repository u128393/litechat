use sea_orm_migration::prelude::*;

mod m20260522000000_initial_schema;
mod m20260602000000_files;
mod m20260605000000_drop_files;

pub struct Migrator;

#[async_trait::async_trait]
impl MigratorTrait for Migrator {
    fn migrations() -> Vec<Box<dyn MigrationTrait>> {
        vec![
            Box::new(m20260522000000_initial_schema::Migration),
            Box::new(m20260602000000_files::Migration),
            Box::new(m20260605000000_drop_files::Migration),
        ]
    }
}
