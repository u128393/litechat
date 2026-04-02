# T008 - Add Admin Entry Points And Authorization Guards

## Scope

- Add a lightweight admin entry in the user menu.
- Create admin-only route protection.
- Add shared helpers for role checking in server routes and UI.

## Out Of Scope

- Provider and model form implementation.
- Non-admin user management.

## Dependencies

- T006.
- T007.

## Deliverables

- User menu with conditional admin navigation.
- Admin layout or route group protected by role checks.
- Reusable authorization guard utilities.

## Acceptance Criteria

- Admin users can navigate to management pages.
- Non-admin users do not see the management entry.
- Non-admin access to admin routes is denied server-side.

## Current Status

- State: `pending`
- Next Step: add role-aware user menu and admin route checks.
- Blockers: none.

## Log

- 2026-04-02: Task created from initial system design.
