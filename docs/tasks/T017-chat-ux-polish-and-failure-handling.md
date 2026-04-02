# T017 - Polish Chat UX And Failure Handling

## Scope

- Add stop generation behavior.
- Add retry and clear error states where appropriate.
- Improve empty state, loading state, and streaming state UX.
- Persist useful UI preferences locally if needed.
- Apply the final bilingual UX pass across user and admin surfaces.

## Out Of Scope

- New major product features.
- Server-side analytics.

## Dependencies

- T013.
- T011.
- T015.
- T016.
- T012A.

## Deliverables

- Improved interaction flows around streaming and failures.
- Stable desktop and mobile chat experience.
- Small UX refinements aligned with the ChatGPT-style target.

## Acceptance Criteria

- Users can stop an in-flight response.
- Upstream and validation errors are visible and recoverable.
- Empty and streaming states feel complete rather than placeholder-only.
- Mobile interaction remains usable for the core chat loop.
- Chat and admin UI both render correctly in English and Simplified Chinese.

## Current Status

- State: `completed`
- Next Step: hand off for T018 end-to-end verification and runbook finalization.
- Blockers: none.

## Log

- 2026-04-02: Task created from initial system design.
- 2026-04-02: Began implementation. Updating task tracking first, then wiring stop/retry/error recovery and bilingual UX polish across chat and admin surfaces.
- 2026-04-02: Added abortable chat streaming with stop support, retryable error handling, localized UX copy, locale-aware timestamps, and fuller loading/empty/streaming states.
- 2026-04-02: Verified with `npm run chat:verify` and `npm run build`. Build passed with the existing Next.js NFT tracing warning from `next.config.ts` -> `src/server/db/config.ts`.
