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

## Current Status

- State: `pending`
- Next Step: decide the setup CLI interface for database selection plus admin bootstrap.
- Blockers: none.

## Log

- 2026-04-02: Task created from initial system design.
