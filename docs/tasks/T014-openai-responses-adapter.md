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

- State: `completed`
- Next Step: T015 can consume the adapter contract to resolve a configured model and stream normalized chat events through the API route.
- Blockers: none.

## Log

- 2026-04-02: Task created from initial system design.
- 2026-04-02: Started implementation. Updating task tracking, inspecting provider and model service shapes, and preparing the adapter contract.
- 2026-04-02: Added a minimal chat adapter contract, model/provider resolution, and an OpenAI Responses fetch-based streaming adapter with isolated message mapping and safe error translation.
- 2026-04-02: Verified the adapter with a mocked streaming upstream check via `npm run chat:verify` and completed `npm run build` successfully.
