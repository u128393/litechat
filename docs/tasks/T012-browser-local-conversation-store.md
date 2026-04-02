# T012 - Implement Browser Local Conversation Store

## Scope

- Add IndexedDB storage for conversations, messages, drafts, and lightweight UI state.
- Namespace local data by authenticated user ID.
- Create a small client storage abstraction for the chat workspace.
- Keep preference storage extensible so language and selected model can be stored locally.

## Out Of Scope

- Real provider calls.
- Cross-device sync.
- Server-side message persistence.

## Dependencies

- T007.

## Deliverables

- IndexedDB schema and helpers.
- CRUD operations for local conversations and messages.
- User-scoped storage key strategy.
- Shared local preference persistence primitives usable by later UI tasks.

## Acceptance Criteria

- A user can create, update, and read local conversations after reload.
- Local history is separated by user ID.
- Storage failures are detectable by the UI layer.
- The local storage abstraction can safely persist per-user preference values in addition to conversations.

## Current Status

- State: `pending`
- Next Step: define local store shape and persistence API for the chat workspace.
- Blockers: none.

## Log

- 2026-04-02: Task created from initial system design.
