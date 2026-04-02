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

- State: `pending`
- Next Step: implement durable user/session schema and service methods.
- Blockers: none.

## Log

- 2026-04-02: Task created from initial system design.
