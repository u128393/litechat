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

- State: `completed`
- Next Step: T016 can build on this route to add automatic web search policy.
- Blockers: none.

## Log

- 2026-04-02: Task created from initial system design.
- 2026-04-02: Started implementation. Updating task status, then wiring the authenticated chat route and minimal browser streaming flow.
- 2026-04-02: Added authenticated `POST /api/chat` request validation, model resolution, safe error mapping, and streaming response forwarding without server-side conversation persistence.
- 2026-04-02: Wired the chat workspace send flow to `/api/chat` so assistant output streams into the existing local conversation state and remains browser-local.
- 2026-04-02: Verified with `npm run chat:verify` and `npm run build`.
