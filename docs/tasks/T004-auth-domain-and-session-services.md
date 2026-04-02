# T004 - Implement Auth Domain And Session Services

## Scope

- Define `users` and `sessions` schema.
- Implement password hashing and verification.
- Implement session creation, lookup, and invalidation.
- Add server-side auth helpers for current-user resolution.

## Out Of Scope

- Login page UI.
- Admin initialization script.
- Password reset flows.
- Authenticated password change UI or API flows.

## Dependencies

- T003.

## Deliverables

- User and session migrations.
- Auth service modules.
- Cookie/session helpers.

## Acceptance Criteria

- A password can be securely hashed and verified.
- A valid session can be created and resolved to the current user.
- Logout invalidates the stored session.
- Role data is available for later admin route checks.

## Current Status

- State: `completed`
- Next Step: T005 can build the first-admin/bootstrap script on top of the shipped user creation, password hashing, and session helpers.
- Blockers: none.

## Log

- 2026-04-02: Task created from initial system design.
- 2026-04-02: Implementation started. Adding durable user/session schema, password hashing, session lifecycle services, and current-user helpers.
- 2026-04-02: Shipped durable `users` and `sessions` schema through the shared Drizzle seam, added Argon2id password hashing/verification, implemented database-backed session lifecycle services plus current-user/cookie helpers, generated the initial migration, and verified with `npm run auth:verify`, `npm run db:generate`, `npm run db:migrate`, and `npm run build` using temporary SQLite-backed environment values.
