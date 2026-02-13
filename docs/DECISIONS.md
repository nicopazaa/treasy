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
