# T009 - Implement Provider Config Backend

## Scope

- Define the `provider_configs` schema and migrations.
- Implement repository and service logic for provider config CRUD.
- Add secure API key encryption and decryption handling.
- Expose admin-only API endpoints for provider config management.

## Out Of Scope

- Admin page UI.
- Model config management.
- Live chat requests.

## Dependencies

- T003.
- T008.

## Deliverables

- Provider config schema.
- Encryption utility for API keys at rest.
- Admin API routes for create, list, and update.

## Acceptance Criteria

- Admins can create and update provider configs through server APIs.
- API keys are encrypted before database storage.
- Disabled providers remain stored but can be filtered from active use.
- Non-admin requests are rejected.

## Current Status

- State: `pending`
- Next Step: implement provider persistence and secure secret handling.
- Blockers: none.

## Log

- 2026-04-02: Task created from initial system design.
