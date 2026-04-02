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

- State: `pending`
- Next Step: build minimal admin pages that fully drive provider/model setup.
- Blockers: none.

## Log

- 2026-04-02: Task created from initial system design.
