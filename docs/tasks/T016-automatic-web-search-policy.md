# T016 - Enable Automatic Web Search Policy

## Scope

- Add backend logic that injects model-native web search tools when configured.
- Keep the behavior invisible to the user interface.
- Respect per-model capability flags from admin-managed config.

## Out Of Scope

- A user-facing web search toggle.
- Custom search providers.

## Dependencies

- T014.
- T015.

## Deliverables

- Web search tool injection logic inside the chat request path.
- Capability-aware validation for supported models.

## Acceptance Criteria

- Models marked as supporting web search receive the proper Responses tool configuration automatically.
- Models not marked for web search send normal chat requests.
- The chat UI exposes no web search checkbox or toggle.

## Current Status

- State: `completed`
- Next Step: none.
- Blockers: none.

## Log

- 2026-04-02: Task created from initial system design.
- 2026-04-02: Began implementation; updating task status before code changes and preparing server-side web search injection.
- 2026-04-02: Added server-side automatic web search tool resolution in the chat route using adapter capabilities so supported models opt in without any UI changes.
- 2026-04-02: Verified the updated chat adapter flow with `npm run chat:verify` and `npm run build`.
