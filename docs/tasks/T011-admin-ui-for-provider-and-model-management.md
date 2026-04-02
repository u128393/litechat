# T011 - Build Admin UI For Provider And Model Management

## Scope

- Build provider management screens.
- Build model management screens.
- Reuse the shared app shell and keep navigation lightweight.
- Support create and update flows needed for v1.
- Ensure labels and actions can be localized by the shared i18n layer later in the task chain.

## Out Of Scope

- Advanced bulk actions.
- Deletion workflows if disabling is sufficient for v1.

## Dependencies

- T008.
- T009.
- T010.

## Deliverables

- Provider list and edit/create forms.
- Model list and edit/create forms.
- Lightweight management navigation.

## Acceptance Criteria

- An admin can configure at least one provider and one enabled model entirely from the UI.
- API validation errors are surfaced clearly.
- The management area remains visually aligned with the main chat app.
- Admin UI strings are implemented in a way that can be translated through shared message dictionaries.

## Current Status

- State: `completed`
- Next Step: none.
- Blockers: none.

## Log

- 2026-04-02: Task created from initial system design.
- 2026-04-02: Began implementation. Updating task tracking first, then reviewing the admin shell, API contracts, and shared UI patterns before building the provider and model management UI.
- 2026-04-02: Built a single-page admin management workspace with lightweight section navigation, centralized admin UI copy, provider create/update flows, model create/update flows, and inline request error handling against the existing admin APIs.
- 2026-04-02: Verification passed with `npm run build`. Task marked complete and ready to commit.
