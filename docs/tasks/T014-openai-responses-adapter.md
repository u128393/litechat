# T014 - Implement OpenAI Responses Adapter

## Scope

- Build the provider adapter contract used by the chat backend.
- Implement the OpenAI Responses adapter.
- Support configurable base URL and encrypted API key usage.
- Support streaming responses.

## Out Of Scope

- Browser chat UI wiring.
- Admin configuration pages.

## Dependencies

- T003.
- T009.
- T010.

## Deliverables

- Provider adapter interface.
- OpenAI Responses adapter implementation.
- Message mapping and streaming translation utilities.

## Acceptance Criteria

- The adapter can create a streamed response for a configured model.
- The adapter uses the configured base URL and decrypted API key.
- Response mapping is isolated from route handlers.
- Adapter failures are converted into safe application errors.

## Current Status

- State: `pending`
- Next Step: define the adapter contract and the OpenAI Responses streaming implementation.
- Blockers: none.

## Log

- 2026-04-02: Task created from initial system design.
