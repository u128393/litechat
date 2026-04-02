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

- State: `pending`
- Next Step: execute and document the full local verification pass once all implementation tasks are complete.
- Blockers: waits on prior tasks.

## Log

- 2026-04-02: Task created from initial system design.
