# T013 - Build Chat Workspace Interactions

## Scope

- Wire the sidebar conversation list to local storage.
- Build the message timeline UI.
- Build the chat composer, send action, and new chat flow.
- Load enabled models into a selector in the main chat view.
- Restore the last selected enabled model from browser-local preferences when possible.

## Out Of Scope

- Live streaming from the backend.
- Automatic web search behavior.

## Dependencies

- T007.
- T010.
- T012.
- T012A.

## Deliverables

- Functional conversation list.
- Composer and message rendering components.
- Model selector wired to backend model listing.

## Acceptance Criteria

- A logged-in user can create a new local conversation.
- Drafts and messages render correctly in the workspace.
- The selected model comes from shared server-managed model configs.
- The selected model is persisted locally and restored after reload when still valid.
- The UI is ready to attach to a streaming backend without major rewrites.

## Current Status

- State: `completed`
- Next Step: T015 can attach streaming responses to the shared workspace state and composer flow.
- Blockers: none.

## Log

- 2026-04-02: Task created from initial system design.
- 2026-04-02: Started implementation. Updating the protected workspace to use browser-local conversations and shared enabled model configs.
- 2026-04-02: Completed local conversation list, message timeline, composer/send flow, and enabled model selection with local preference restore. Verified with a production build.
