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

- State: `completed`
- Next Step: begin T004 by building auth and session services on top of the shared `src/server/db` seam and migration flow added here.
- Blockers: none.

## Log

- 2026-04-02: Task created from initial system design.
- 2026-04-02: Implementation started. Building the shared Drizzle database seam, migration tooling, and repository scaffolding for the supported database types.
- 2026-04-02: Shipped a shared `src/server/db` portability seam with Drizzle-backed SQLite, PostgreSQL, and MySQL-compatible connection factories; added `drizzle.config.ts`, runtime migration wiring, local-env loading for out-of-Next scripts, repository scaffolding helpers, and an empty initial migration journal under `drizzle/meta`. Verified adapter resolution with `npm run db:verify-factory`, verified migration execution wiring with `npm run db:migrate` and `npm run db:generate`, and confirmed the app still builds with `npm run build`.
