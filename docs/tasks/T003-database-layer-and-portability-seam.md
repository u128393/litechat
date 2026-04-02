# T003 - Set Up Multi-Database Layer And Connection Factory

## Scope

- Add database access for common Drizzle-backed relational databases.
- Add Drizzle schema and migration setup.
- Create a shared connection factory that resolves the active database client from config.
- Add repository scaffolding for server-owned entities.

## Out Of Scope

- Concrete auth business logic.
- Admin pages.
- Chat browser storage.

## Dependencies

- T001.
- T002.

## Deliverables

- Drizzle config.
- Database connection factory with SQLite, PostgreSQL, and MySQL-compatible support.
- Initial migrations framework.
- Shared repository/database access pattern for future tasks.

## Acceptance Criteria

- Migration and runtime connection setup work for the supported database types through a shared interface.
- App code imports the database through a single shared seam.
- No core business logic depends directly on a single database driver outside the database layer.

## Current Status

- State: `pending`
- Next Step: define the database config model, connection factory, and migration flow across the supported database types.
- Blockers: none.

## Log

- 2026-04-02: Task created from initial system design.
