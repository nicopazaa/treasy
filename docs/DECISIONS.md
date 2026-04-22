# Decisions (ADR-lite)

Append-only, concise records of implemented architectural decisions observed in this repo.

## Template
### ID + Date
DEC-XXX - YYYY-MM-DD

### Status
Accepted | Superseded (by DEC-YYY)

### Decision (one line)
One sentence describing the decision.

### Context
- Problem:
- Constraints:
- Affected paths:

### Consequences
- Benefits:
- Tradeoffs/risks:
- Follow-ups:

---

### DEC-001 - 2026-02-10
### Status
Accepted

### Decision (one line)
Free-text notes are stored in a dedicated notes repository key, and only parseable workout input mutates workout logs/sets.

### Context
- Problem: Notes and workout logs were mixed in one flow.
- Constraints: Local-first storage, deterministic parsing, no new dependency requirement.
- Affected paths: `src/app/actions/useAppActions.ts`, `src/domain/quicklog/parseInputToAction.ts`, `src/features/notes/data/notesRepository.ts`, `src/features/notes/model/notesMigration.ts`.

### Consequences
- Benefits: Workout timeline/analytics stay workout-focused; notes can be managed independently.
- Tradeoffs/risks: Unknown exercise text now defaults to note behavior instead of auto-creating workout entries.
- Follow-ups: Add explicit note management UX beyond read/list if needed.

---

### DEC-002 - 2026-02-10
### Status
Accepted

### Decision (one line)
Persistence uses critical immediate saves for high-risk mutations and debounced saves for lower-risk updates.

### Context
- Problem: Need reliability without writing AsyncStorage on every minor interaction.
- Constraints: Single AsyncStorage app-state blob, app lifecycle interruptions.
- Affected paths: `src/app/state/persist.ts`, `src/app/state/useAppStore.ts`, `src/app/actions/useAppActions.ts`.

### Consequences
- Benefits: Critical updates are durable; frequent UI updates avoid write thrash.
- Tradeoffs/risks: Debounced updates can still be at risk if app terminates before flush.
- Follow-ups: Consider telemetry or tests around persistence edge cases.

---

### DEC-003 - 2026-02-10
### Status
Accepted

### Decision (one line)
Navigation is handled by a custom in-memory stack with swipe gestures, instead of a react-navigation router stack.

### Context
- Problem: App needed lightweight custom back/forward + edge swipe behavior.
- Constraints: Existing screen-switch architecture in `App.tsx`.
- Affected paths: `src/app/navigation/useNavStack.ts`, `src/app/navigation/types.ts`, `App.tsx`, `src/app/navigation/BackSwipeContext.tsx`.

### Consequences
- Benefits: Full control over stack semantics and edge-swipe behavior.
- Tradeoffs/risks: Less ecosystem support than router-based navigation; more custom maintenance burden.
- Follow-ups: Keep blocker registration and swipe constants aligned with complex screens.

---

### DEC-004 - 2026-02-10
### Status
Accepted

### Decision (one line)
Home two-column behavior is width-mode driven, with fixed right-column order and fixed-height last-workout card/chip-scroll behavior.

### Context
- Problem: Layout consistency across desktop web, mobile web, and PWA required deterministic mode behavior.
- Constraints: Preserve existing visual tokens and card components.
- Affected paths: `src/screens/HomeScreen.tsx`.

### Consequences
- Benefits: Stable right-column ordering and predictable cross-platform layout mode behavior.
- Tradeoffs/risks: Last-workout card height lock depends on first-measurement flow and can be brittle if internal structure changes.
- Follow-ups: Add UI regression checks for Home two-column layout.

---

### DEC-005 - 2026-02-10
### Status
Accepted

### Decision (one line)
Home workout session lifecycle is tracked explicitly via persisted `activeWorkout` state, and `LIVE` is shown only for active sessions.

### Context
- Problem: Home treated any logged sets today as implicitly `LIVE`, with no explicit finish action.
- Constraints: Preserve existing navigation/tap behavior, avoid new dependencies, keep backward compatibility with previously stored app state.
- Affected paths: `src/domain/workouts/types.ts`, `src/features/workouts/model/initialState.ts`, `src/features/workouts/data/storage.ts`, `src/app/actions/useAppActions.ts`, `App.tsx`, `src/screens/HomeScreen.tsx`, `src/shared/i18n/i18n.ts`.

### Consequences
- Benefits: Users can explicitly end a workout; Home card/panel now distinguish active vs finished and show duration after finishing.
- Tradeoffs/risks: Session lifecycle is currently single-session-oriented (last started/finished window), so unusual same-day restart/edit flows depend on action-layer heuristics.
- Follow-ups: Add automated UI/state tests for active-session start/finish transitions and same-day restart behavior.

---

### DEC-006 - 2026-02-10
### Status
Accepted

### Decision (one line)
Home "Dagens økt" primary text is lifecycle-driven copy rather than set-count copy.

### Context
- Problem: The card metric text was set-count based (`X sett i dag`) and did not clearly communicate lifecycle intent.
- Constraints: Keep existing workout lifecycle and LIVE chip logic unchanged; no new dependencies.
- Affected paths: `src/screens/HomeScreen.tsx`.

### Consequences
- Benefits: Users get clear next-step guidance from the card text alone (`Start en økt` -> `Fullfør økten` -> `Økt fullført ✓`).
- Tradeoffs/risks: Copy is now state-focused instead of showing set count in the primary line.
- Follow-ups: Consider adding a dedicated UI/state regression test for the three primary-text states on Home.

---

### DEC-007 - 2026-02-10
### Status
Accepted

### Decision (one line)
Home uses a persisted two-theme token system (`darkBlue` / `calmLight`) with an in-header instant toggle.

### Context
- Problem: Home visuals needed deterministic dark/calm modes without structural layout changes.
- Constraints: No new dependencies, preserve Home component hierarchy/spacing, persist choice in existing app-state storage.
- Affected paths: `src/shared/theme/themes.ts`, `src/shared/types/index.ts`, `src/features/workouts/model/initialState.ts`, `src/features/workouts/data/storage.ts`, `src/app/actions/useAppActions.ts`, `App.tsx`, `src/screens/HomeScreen.tsx`.

### Consequences
- Benefits: One semantic color source for Home; instant theme switching with persisted selection.
- Tradeoffs/risks: Home now carries token-driven color overrides alongside legacy static style entries, which increases style maintenance complexity.
- Follow-ups: Consider extending shared token usage to remaining screens for full app-wide visual consistency.

---

### DEC-008 - 2026-02-13
### Status
Accepted

### Decision (one line)
Home typography uses a fixed Treasy T0-T6 scale (22/20/18/16/15/14/13) with dark-mode contrast tiers instead of ad hoc font sizes.

### Context
- Problem: Home typography had mixed font sizes/weights (including non-system values), which weakened hierarchy and visual consistency in key cards.
- Constraints: Keep existing Home layout/flows intact, no new dependencies, and stay compatible with the existing Inter font loading setup.
- Affected paths: `src/shared/theme/tokens.ts`, `src/screens/HomeScreen.tsx`.

### Consequences
- Benefits: Deterministic hierarchy for key Home surfaces (`Dagens økt`, `Forrige økt`, notes/analysis metadata), with reusable text tiers and less per-screen tweaking.
- Tradeoffs/risks: The current font assets do not include Inter Medium, so T4 "500-like" intent is approximated with semi-bold (600).
- Follow-ups: Roll the same scale into other screens/components to complete app-wide typography consistency.

---

### DEC-009 - 2026-04-23
### Status
Accepted

### Decision (one line)
The app now uses deterministic sync metadata defaults on local entities and enforces architecture guardrails through CI verification.

### Context
- Problem: Local-first entities lacked consistent sync metadata, and architecture constraints (env access, random id usage, screen/data coupling) were not enforced automatically.
- Constraints: Keep current app behavior intact, avoid adding dependencies, and remain compatible with existing persisted payloads.
- Affected paths: `src/domain/workouts/types.ts`, `src/domain/workouts/workoutService.ts`, `src/features/workouts/data/storage.ts`, `src/features/notes/data/notesRepository.ts`, `src/shared/utils/id.ts`, `src/shared/utils/syncMeta.ts`, `scripts/verify-architecture.js`, `.github/workflows/ci.yml`.

### Consequences
- Benefits: New/normalized entities now carry backend-ready metadata (`clientId`, `updatedAt`, `version`, `syncStatus`, `deletedAt`) and CI blocks obvious architectural regressions.
- Tradeoffs/risks: Metadata is foundational only; hard deletes and full-state persistence are still present and need follow-up work for full offline sync semantics.
- Follow-ups: Introduce explicit outbox + soft-delete sync flow and move persistence from single-blob storage to entity-oriented storage.

---

### DEC-010 - 2026-04-23
### Status
Accepted

### Decision (one line)
Workout and notes mutations now emit deterministic sync outbox events with tombstones, and app-state persistence is split into entity-oriented AsyncStorage keys with legacy blob fallback read.

### Context
- Problem: Local entity metadata existed, but mutation history and delete intent were still lossy (hard deletes), and state persistence still depended on one large blob key.
- Constraints: No new dependencies, preserve current UI behavior, keep backward compatibility with already persisted payloads.
- Affected paths: `src/domain/workouts/workoutService.ts`, `src/domain/workouts/syncState.ts`, `src/shared/utils/syncQueue.ts`, `src/shared/utils/syncMeta.ts`, `src/features/workouts/data/storage.ts`, `src/features/notes/data/notesRepository.ts`, `scripts/verify-architecture.js`.

### Consequences
- Benefits: Mutations now produce idempotency-safe outbox records; deletes are represented as tombstones; persistence writes are partitioned by entity group instead of a single app-state blob.
- Tradeoffs/risks: Remote transport/ACK loop is still not implemented, so outbox growth/compaction policy is currently local-only.
- Follow-ups: Implement sync processor (send/ack/retry), then retire legacy fallback reads when migration confidence is sufficient.
