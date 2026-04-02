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

- State: `completed`
- Next Step: T007 can build the shared authenticated app shell and chat layout on top of the protected route group and login/logout flow.
- Blockers: none.

## Log

- 2026-04-02: Task created from initial system design.
- 2026-04-02: Implementation started. Wiring the login UI, auth API handlers, and protected-route redirect flow.
- 2026-04-02: Shipped a server-rendered `/login` page, form-based `/api/auth/login` and `/api/auth/logout` handlers, a protected App Router group for authenticated pages, and shared redirect guards built on the T004 cookie/session helpers. Verified with `npm run build`, provisioned `t006-admin@example.com` through `npm run setup:init-admin -- --db-type sqlite --admin-email t006-admin@example.com --admin-password 'correct horse battery staple' --non-interactive`, then confirmed via `curl` that logged-out requests redirect to `/login`, invalid credentials return a generic error redirect, valid credentials set the session cookie and unlock `/`, and logout clears the cookie and restores the logged-out redirect behavior. `npm run start` could not bind to `:3000` because a local server was already running, so the HTTP checks were executed against that active local instance after the production build completed.
