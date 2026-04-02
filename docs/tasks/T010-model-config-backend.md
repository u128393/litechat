# T010 - Implement Model Config Backend

## Scope

- Define the `model_configs` schema and migrations.
- Implement repository and service logic for model config CRUD.
- Validate provider references and active state rules.
- Expose admin-only API endpoints for model config management.
- Expose a user-facing read endpoint for enabled model listing.

## Out Of Scope

- Admin page UI.
- Chat request execution.

## Dependencies

- T003.
- T009.

## Deliverables

- Model config schema.
- Admin model config APIs.
- Public authenticated model list API for the chat UI.

## Acceptance Criteria

- Admins can create and update model configs tied to existing providers.
- Disabled models do not appear in the user model list endpoint.
- A model cannot reference a missing provider.
- Web search support can be configured per model.

## Current Status

- State: `pending`
- Next Step: build model persistence, validation, and filtered listing APIs.
- Blockers: none.

## Log

- 2026-04-02: Task created from initial system design.
