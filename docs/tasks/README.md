# Task Index

## Purpose

This directory tracks the implementation plan as independent task files. Each task file contains scope, out-of-scope boundaries, dependencies, acceptance criteria, current status, and a running log.

## Status Values

- `pending`: not started
- `in_progress`: actively being worked on
- `blocked`: cannot proceed yet
- `completed`: finished and accepted

## Execution Order

Tasks are ordered to produce a runnable system without leaving integration gaps.

| ID | Title | Depends On | Status |
| --- | --- | --- | --- |
| T001 | Bootstrap Next.js workspace | none | completed |
| T002 | Add environment and app config | T001 | completed |
| T003 | Set up multi-database layer and connection factory | T001, T002 | completed |
| T004 | Implement auth domain and session services | T003 | completed |
| T005 | Build setup script for database and first admin | T002, T003, T004 | completed |
| T006 | Build login UI and protected route flow | T004, T005 | completed |
| T007 | Build shared app shell and ChatGPT-style layout skeleton | T006 | completed |
| T008 | Add admin entry points and authorization guards | T006, T007 | completed |
| T009 | Implement provider config backend | T003, T008 | completed |
| T010 | Implement model config backend | T003, T009 | completed |
| T011 | Build admin UI for provider and model management | T008, T009, T010 | completed |
| T012 | Implement browser local conversation store | T007 | completed |
| T012A | Add localization and browser preferences | T007, T012 | completed |
| T013 | Build chat workspace interactions | T007, T010, T012, T012A | completed |
| T014 | Implement OpenAI Responses adapter | T003, T009, T010 | completed |
| T015 | Implement chat streaming API route | T006, T010, T012, T014 | completed |
| T016 | Enable automatic web search policy | T014, T015 | pending |
| T017 | Polish chat UX and failure handling | T011, T013, T015, T016, T012A | pending |
| T018 | Verify end-to-end flow and finalize runbook | T005, T011, T017 | pending |
| T019 | Add user password reset flow | T004, T006, T017 | pending |

## Critical Path

The shortest path to a working build is:

1. T001-T006 for a logged-in app.
2. T007-T013 for the usable chat workspace, localization, and local storage.
3. T009-T011 for admin-managed shared model configuration.
4. T014-T016 for live Responses API chat with automatic web search.
5. T017-T018 for polish, validation, and run instructions.
6. T019 for the lower-priority password reset enhancement.

## Runnable End State

After all tasks are `completed`, the following should work locally:

1. Start the app.
2. Run the setup script and choose the database configuration.
3. Log in.
4. Configure an OpenAI Responses provider and model.
5. Open the main chat view.
6. Confirm the UI defaults to the browser language and allows manual switching.
7. Start a conversation stored only in the browser.
8. Receive a streamed response from the configured model.
9. Reload and confirm language and last selected model preference are restored.
10. Change the password through the lower-priority in-app password reset flow.

## Logging Rule

Every task file should keep append-only log entries with date-stamped progress updates. When implementation begins, update the corresponding task file first.
