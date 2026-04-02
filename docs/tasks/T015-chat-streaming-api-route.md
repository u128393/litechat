# T015 - Implement Chat Streaming API Route

## Scope

- Create the authenticated chat API route.
- Accept browser-provided local conversation history and selected model config.
- Resolve the model config and call the provider adapter.
- Stream assistant output back to the browser.

## Out Of Scope

- Automatic web search tool injection.
- Retry/stop UX polish.

## Dependencies

- T006.
- T010.
- T012.
- T014.

## Deliverables

- `POST /api/chat` route.
- Request validation.
- Stream forwarding logic.

## Acceptance Criteria

- An authenticated user can submit local conversation history to the route.
- The route rejects disabled or missing models.
- The browser receives a streamed assistant response.
- The server does not persist conversation content.

## Current Status

- State: `pending`
- Next Step: implement the route contract and adapter integration.
- Blockers: none.

## Log

- 2026-04-02: Task created from initial system design.
