# T005 - Build Setup Script For Database And First Admin

## Scope

- Create an initialization script that collects database setup and creates the first admin user.
- Let the user choose the database type.
- Collect the required connection information for the selected database type.
- Accept admin email and password through flags or prompts.
- Prevent accidental duplicate creation for the same email.
- Document how to run the script.

## Out Of Scope

- General user registration.
- Password reset or rotation flows.

## Dependencies

- T002.
- T003.
- T004.

## Deliverables

- A runnable script under a `scripts` directory.
- Database configuration bootstrap written for local runtime use.
- Command documentation.
- Safe validation for input email and password.

## Acceptance Criteria

- Running the script lets the user select SQLite, PostgreSQL, or MySQL-compatible configuration.
- For SQLite, the script defaults the database file to a path inside the project deployment directory.
- Running the script inserts an admin user with the provided email.
- The stored password is hashed, not plain text.
- Re-running with the same email fails safely or reports the existing admin clearly.
- The script can be used before the web app is launched and leaves the app with usable local database config.

## Runbook

- Interactive: `npm run setup:init-admin`
- Non-interactive SQLite example: `npm run setup:init-admin -- --db-type sqlite --admin-email admin@example.com --admin-password 'correct horse battery staple' --non-interactive`
- PostgreSQL with URL: `npm run setup:init-admin -- --db-type postgres --db-url 'postgres://litechat:litechat@127.0.0.1:5432/litechat' --admin-email admin@example.com --admin-password 'correct horse battery staple' --non-interactive`
- MySQL with discrete fields: `npm run setup:init-admin -- --db-type mysql --db-host 127.0.0.1 --db-port 3306 --db-name litechat --db-user litechat --db-password litechat --admin-email admin@example.com --admin-password 'correct horse battery staple' --non-interactive`
- Use `--env-file <path>` if you need to write to a file other than `.env.local`.

## Current Status

- State: `completed`
- Next Step: start T006 and verify the login flow against an admin provisioned by the setup script.
- Blockers: none.

## Log

- 2026-04-02: Task created from initial system design.
- 2026-04-02: Implementation started. Building the setup CLI for database selection, local env bootstrap, and first-admin creation.
- 2026-04-02: Shipped `scripts/setup/init-admin.ts` plus an `npm run setup:init-admin` entrypoint. The script now supports interactive prompts or flags, writes merged local env config, runs migrations through the shared database factory, creates the first admin through the auth service, and refuses duplicate emails before insert. Verified the SQLite path flow, confirmed Argon2 password hashing in the `users` table, confirmed duplicate reruns fail clearly, and confirmed the app can build and start from the generated `.env.local`.
