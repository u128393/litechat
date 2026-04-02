# T002 - Add Environment And App Config

## Scope

- Define required environment variables.
- Add environment parsing and validation.
- Add example env documentation for local development.
- Centralize app-level config values.
- Define the database-type-specific config contract used by setup and runtime.

## Out Of Scope

- Database connection implementation.
- Admin initialization logic.

## Dependencies

- T001.

## Deliverables

- Environment schema and loader.
- `.env.example` with documented required values.
- Shared config module for use across server code.

## Acceptance Criteria

- Missing required environment variables fail fast in development.
- Optional values have explicit defaults or documented behavior.
- The app starts successfully with values from `.env.local`.
- The env contract supports selecting the database type and the required connection settings for each supported database.

## Current Status

- State: `completed`
- Next Step: begin T003 by building the database portability seam on top of the shared config contract added here.
- Blockers: none.

## Log

- 2026-04-02: Task created from initial system design.
- 2026-04-02: Implementation started. Defining the environment contract, validation, and shared app config for runtime and setup flows.
- 2026-04-02: Shipped a server-only app config loader with explicit env parsing and validation for auth/session settings, database selection, database-specific connection settings, and provider-key encryption. Added `.env.example`, wired config loading into the server-rendered app path so invalid local config fails early, and verified the app with a temporary valid `.env.local` plus a production build.
