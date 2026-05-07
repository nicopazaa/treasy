# Roadmap

Source note: no external tracker reference is present in this repo, so this roadmap is derived from verified code gaps and active architecture needs.

## Now
- [x] Add baseline quality gates (`typecheck` + architecture verification) and wire them into package scripts/CI.
  - Goal: Prevent silent regressions in parsing, persistence, and layout logic.
  - Acceptance criteria:
    - [x] `package.json` contains reproducible verification scripts (`verify` + `verify:architecture`).
    - [x] CI/local command sequence is documented in `docs/STATUS.md`.

- [ ] Expand baseline quality gates with lint + functional tests.
  - Goal: Catch style and behavior regressions in addition to type/architecture regressions.
  - Acceptance criteria:
    - [ ] Add lint script and enforce on CI.
    - [ ] Add automated tests for parsing/persistence flows.

- [ ] Add regression coverage for Home wide-mode layout behavior.
  - Goal: Keep right-column order fixed and prevent alignment regressions.
  - Acceptance criteria:
    - [ ] Two-column mode keeps right stack order `Cardio -> Kroppsvekt -> Forrige okt -> Notater`.
    - [ ] Analyse/Notater bottom-alignment behavior is validated.

- [ ] Finalize notes migration hardening.
  - Goal: Ensure legacy notes/logs migrate once without duplicates.
  - Acceptance criteria:
    - [ ] Migration scenarios are documented with before/after examples.
    - [ ] Duplicate-note and duplicate-log edge cases are covered by tests.

## Next
- [x] Add Supabase-backed cloud identity + authenticated sync backend.
  - Goal: Move from device-local user ids to real account identity and server persistence.
  - Acceptance criteria:
    - [x] Supabase Auth can upgrade local identity to a stable cloud user id when configured.
    - [x] Sync endpoint accepts authenticated requests with a verified Supabase bearer token.
    - [x] Server-side storage schema and write path are documented and implemented.

- [ ] Decide whether to keep or remove currently unreferenced modules.
  - Goal: Reduce maintenance surface and dead paths.
  - Acceptance criteria:
    - [ ] Decision documented for `src/domain/parsing/applyParsedChunks.ts`.
    - [ ] Decision documented for `src/screens/ExerciseScreen.tsx` routing status.

- [ ] Introduce explicit migration versioning for persisted data.
  - Goal: Move from ad hoc normalization to explicit migration steps.
  - Acceptance criteria:
    - [ ] Storage version strategy documented.
    - [ ] Backward-compatibility path validated with old payload fixtures.

- [x] Implement sync outbox + tombstone flow on top of new entity sync metadata.
  - Goal: Make local mutations backend-syncable without lossy hard-delete behavior.
  - Acceptance criteria:
    - [x] Mutations emit outbox events with idempotency-safe identifiers.
    - [x] Delete operations use tombstones (`deletedAt`) before remote ACK.

- [x] Move app-state persistence from single blob to entity-oriented AsyncStorage keys.
  - Goal: Reduce blob coupling and prepare per-entity sync/storage evolution.
  - Acceptance criteria:
    - [x] App-state persistence writes split keys per entity group + sync state.
    - [x] Legacy `treasy_app_state_v2` is supported as read fallback migration path.

- [ ] Implement sync processor (transport + ACK + retry) on top of local outbox.
- [x] Implement sync processor (transport + ACK + retry) on top of local outbox.
  - Goal: Move from local sync intent capture to actual remote sync execution.
  - Acceptance criteria:
    - [x] Outbox events are batched/sent and marked acknowledged on success.
    - [x] Retry/backoff and failure visibility are documented and implemented.

## Later
- [ ] Expand analytics to include cardio-specific metrics in Insights/Analysis.
  - Goal: Avoid set-only blind spots in summary views.
  - Acceptance criteria:
    - [ ] Cardio entries are represented in analysis metrics where relevant.

- [ ] Evaluate optional sync/backup restore strategy beyond local-only storage.
  - Goal: Improve recoverability across devices.
  - Acceptance criteria:
    - [ ] Architecture decision documented (local-only vs sync).
    - [ ] Security/privacy constraints documented.

- [ ] Define conflict-resolution rules for concurrent device edits.
  - Goal: Make multi-device sync deterministic when two clients update the same entity independently.
  - Acceptance criteria:
    - [ ] Winner/merge policy is documented per operation type (`upsert`, `delete`, restore).
    - [ ] Processor behavior for conflict responses is implemented and covered by tests.

## UNKNOWN
- External product priority ordering is UNKNOWN.
  - Verification path: confirm official priority order with maintainers or external planning tool.
