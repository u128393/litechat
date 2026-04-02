# T007 - Build Shared App Shell And Chat Layout Skeleton

## Scope

- Create the main authenticated shell used by both regular users and admins.
- Build the ChatGPT-style structural layout: sidebar, top bar, content panel, composer area.
- Establish shared styling tokens and layout behavior for desktop and mobile.
- Reserve shared shell affordances for a future language switcher in the user menu or header.

## Out Of Scope

- Real chat data.
- Admin forms.
- Provider integration.

## Dependencies

- T006.

## Deliverables

- Shared authenticated layout.
- Responsive sidebar and main panel shell.
- Placeholder states for conversations and messages.

## Acceptance Criteria

- Logged-in users land inside the shared shell.
- The layout works on desktop and mobile without obvious breakage.
- The shell can host both chat features and a lightweight admin entry.
- The shell leaves a clear integration point for localization controls without structural rework.

## Current Status

- State: `completed`
- Next Step: T008 can add admin entry routing and authorization guards on top of the shared shell menu affordance.
- Blockers: none.

## Log

- 2026-04-02: Task created from initial system design.
- 2026-04-02: Implementation started. Replacing the temporary protected landing page with the shared authenticated app shell, responsive chat layout skeleton, and reserved integration points for localization and future admin menu actions.
- 2026-04-02: Shipped a shared protected shell with a desktop sidebar, mobile drawer navigation, model/status top bar, empty-state chat timeline, multiline composer, user menu logout flow, admin-menu placeholder, and localization control slots. Verified with `npm run build`.
