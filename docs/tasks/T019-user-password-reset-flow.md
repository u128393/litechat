# T019 - Add User Password Reset Flow

## Scope

- Add a low-priority in-app password reset/change flow for authenticated users.
- Add UI entry points from the authenticated user surface.
- Validate current password before allowing a new password to be set.
- Update the stored password hash and handle session invalidation.

## Out Of Scope

- Email-based forgot-password recovery.
- Admin-triggered password resets for other users.
- MFA or additional identity verification factors.

## Dependencies

- T004.
- T006.
- T017.

## Deliverables

- Password reset/change page or modal in the authenticated app.
- Authenticated API route or server action for password update.
- Session invalidation behavior after password change.

## Acceptance Criteria

- A logged-in user can provide the current password and set a new password.
- Incorrect current passwords are rejected safely.
- The new password is stored as a hash, not plain text.
- Existing sessions are invalidated or the user is forced to sign in again after a successful change.
- Email-based recovery remains explicitly out of scope and is documented as such.

## Current Status

- State: `completed`
- Next Step: none.
- Blockers: none.

## Log

- 2026-04-02: Task created as a lower-priority post-core auth enhancement.
- 2026-04-02: Implementation started. Defining the minimal authenticated password-change UX and wiring password update plus session invalidation through the existing auth stack.
- 2026-04-02: Added an authenticated password-change page and shell entry point, validated the current password before re-hashing the new password, invalidated active sessions on success, and kept email-based recovery explicitly out of scope in the UI.
- 2026-04-02: Verified the new password-change flow with `npm run auth:verify` and `npm run build`.
