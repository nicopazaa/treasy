# Roadmap

Source note: no external tracker reference is present in this repo, so this roadmap is derived from verified code gaps and active architecture needs.

## Now
- [ ] Add baseline quality gates (`lint` + `test`) and wire them into package scripts.
  - Goal: Prevent silent regressions in parsing, persistence, and layout logic.
  - Acceptance criteria:
    - [ ] `package.json` contains reproducible lint and test scripts.
    - [ ] CI/local command sequence is documented in `docs/STATUS.md`.

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

## UNKNOWN
- External product priority ordering is UNKNOWN.
  - Verification path: confirm official priority order with maintainers or external planning tool.
