# T012A - Add Localization And Browser Preferences

## Scope

- Add a shared i18n layer for English and Simplified Chinese.
- Detect the initial language from the browser.
- Add a user-facing language switcher.
- Persist language preference locally in the browser.
- Define a client-side preference store for last selected model.

## Out Of Scope

- Server-side user preference persistence.
- Additional languages beyond English and Simplified Chinese.
- Translation management tooling for non-developer editors.

## Dependencies

- T007.
- T012.

## Deliverables

- Shared message dictionaries for `en` and `zh-CN`.
- Locale resolution logic with browser detection and fallback.
- Local preference helpers for `language` and `lastSelectedModelConfigId`.
- A UI control that lets the user switch languages.

## Acceptance Criteria

- On first load, the app chooses English or Simplified Chinese based on the browser language.
- Unsupported browser languages fall back to English.
- Users can manually switch language without reauthentication.
- The selected language is restored after reload from browser-local preferences.
- The preference layer exposes an API that later chat tasks can use for remembering the last selected model.

## Current Status

- State: `completed`
- Next Step: none.
- Blockers: none.

## Log

- 2026-04-02: Task created to cover bilingual UI and browser-local preferences.
- 2026-04-02: Began implementation by updating task status, then reviewing the protected shell, admin surfaces, and browser-local IndexedDB store entry points for a minimal shared i18n and preference layer.
- 2026-04-02: Added a shared client-side locale layer for `en` and `zh-CN`, browser-backed preference helpers for `language` and `lastSelectedModelConfigId`, a protected-shell language switcher, and localized authenticated shell/admin surfaces without introducing server-side preference persistence.
- 2026-04-02: Verified the task with `npm run build`, including TypeScript checks from the Next.js production build, then prepared the worktree for commit.
