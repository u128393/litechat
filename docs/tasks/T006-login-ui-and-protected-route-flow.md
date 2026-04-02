# T006 - Build Login UI And Protected Route Flow

## Scope

- Create the login page for email/password authentication.
- Implement login and logout API handlers.
- Protect authenticated routes.
- Redirect unauthenticated users to the login page.

## Out Of Scope

- Admin-only pages.
- Provider/model management.

## Dependencies

- T004.
- T005.

## Deliverables

- Login form UI.
- Login/logout handlers.
- Auth-aware route protection.

## Acceptance Criteria

- A valid admin created by the setup script can log in.
- Invalid credentials show a non-sensitive error.
- Protected routes are inaccessible when logged out.
- Logout clears the active session and returns to login.

## Current Status

- State: `pending`
- Next Step: wire login form submission to auth services and route guards.
- Blockers: none.

## Log

- 2026-04-02: Task created from initial system design.
