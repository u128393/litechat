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

- State: `pending`
- Next Step: add recovery paths and refine interaction states after live chat is working.
- Blockers: none.

## Log

- 2026-04-02: Task created from initial system design.
