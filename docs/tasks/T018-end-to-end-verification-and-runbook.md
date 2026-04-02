# T018 - Verify End-To-End Flow And Finalize Runbook

## Scope

- Document local setup and run instructions.
- Verify the full happy path from admin bootstrap to live chat.
- Record remaining known limitations if any.
- Ensure the task log reflects final completion state across the chain.

## Out Of Scope

- New feature work unrelated to launch readiness.
- Production deployment automation.

## Dependencies

- T005.
- T011.
- T017.

## Deliverables

- Local runbook.
- Smoke-test checklist.
- Final status updates on implementation tasks.

## Acceptance Criteria

- A new developer can follow the documented setup path and run the project locally.
- The setup script, database selection flow, login flow, provider/model setup, and live chat path are verified together.
- Browser-language default selection, manual language switching, and local preference restore are verified.
- Known gaps are documented instead of left implicit.

## Current Status

- State: `completed`
- Next Step: none.
- Blockers: none.

## Log

- 2026-04-02: Task created from initial system design.
- 2026-04-02: Began end-to-end verification and runbook finalization; syncing task index status before executing the verification pass.
- 2026-04-02: Added `docs/local-runbook.md` with standard setup, a no-secrets mock Responses verification path, manual browser smoke steps, and explicit known limitations.
- 2026-04-02: Verified `scripts/setup/init-admin.ts` against a fresh temporary SQLite database, confirmed protected-route redirects and login flow, created provider and model configs through the admin APIs, and streamed chat successfully through `/api/chat` using a local OpenAI-compatible mock endpoint.
- 2026-04-02: Ran `npm run build`, `npm run db:verify-factory`, `npm run auth:verify`, `npm run providers:verify`, `npm run models:verify`, and `npm run chat:verify` to close out the final integration pass.
