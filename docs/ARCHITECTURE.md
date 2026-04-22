# Treasy Architecture

## Layering
- `App.tsx`: composition root, font bootstrap, store, nav, screen switch.
- `src/app/`: app composition concerns.
- `src/domain/`: pure domain logic (parsing, analytics, workout mutations/queries).
- `src/features/`: feature-level modules built on domain.
- `src/screens/`: screen containers and UI composition.
- `src/shared/`: theme, i18n, reusable UI, hooks, constants, utilities.

## Runtime architecture
### 1) Composition root
`App.tsx` wires:
- Global typography install (`installGlobalTypography`).
- Font loading (`Inter-Regular`, `Inter-SemiBold`, `Inter-Bold`).
- App store/hydration (`useAppStore`).
- Derived cache (`useDerivedCache`).
- Nav stack (`useNavStack`) and swipe handlers.
- Action orchestration (`useAppActions`).

### 2) Navigation
- Custom stack reducer in `src/app/navigation/useNavStack.ts`.
- Supports `navigate`, `back`, `forward`, `reset`.
- Edge-swipe back/forward gesture handling with configurable constants from `src/shared/constants.ts`.
- Gesture exclusion zones via `BackSwipeContext` blocker rectangles.

### 3) State and persistence
Store lifecycle:
- Boot load from AsyncStorage via `loadAppState`.
- In-memory React state in `useAppStore`.
- Persistence through `AppStatePersister`:
  - `saveNow` for critical writes.
  - `scheduleSave` for debounced writes.
  - `flushPending` on app background/unload.

Storage keys:
- App state (entity-oriented):
  - `treasy_app_meta_v1`
  - `treasy_app_blocks_v1`
  - `treasy_app_exercises_v1`
  - `treasy_app_sets_v1`
  - `treasy_app_cardio_entries_v1`
  - `treasy_app_logs_v1`
  - `treasy_app_notes_v1` (legacy-compatible `AppState.notes`)
  - `treasy_app_sync_v1` (`outbox` + `tombstones`)
- Legacy fallback read key: `treasy_app_state_v2` (read-only migration fallback).
- Notes repo: `treasy_notes_v1`.
- AI chat cache: `treasy_ai_chat_v1`.
- Backup snapshot: `treasy_backup_export`.

Session lifecycle:
- `AppState.activeWorkout` stores workout session start/finish timestamps for Home "Today workout" lifecycle (`startedAtISO`, optional `finishedAtISO`).

### 4) Action layer
`useAppActions` is the orchestration boundary:
- Applies domain state updates.
- Chooses persistence mode per action.
- Handles auth flows (guest/email/GitHub web callback).
- Runs one-time notes migration from legacy storage paths.

### 5) Domain logic
Workouts:
- Types: `src/domain/workouts/types.ts`.
- Mutations/queries: `src/domain/workouts/workoutService.ts`.
- Name normalization: `src/domain/workouts/nameNormalize.ts`.
- Sync queue helpers: `src/domain/workouts/syncState.ts` + `src/shared/utils/syncQueue.ts`.

Parsing:
- Parse text to chunks: `src/domain/parsing/parsePipeline.ts`.
- Quick-log decision path: `src/domain/quicklog/parseInputToAction.ts`.
- Fuzzy lookup: `src/domain/quicklog/exerciseLookup.ts`.

Analytics:
- Core metrics/time windows: `src/domain/analytics/insights.ts`.
- AI local Q/A logic: `src/features/analytics/model/aiService.ts`.

## Screen composition model
- Screen routing is a switch in `App.tsx` keyed by `NavState.screen`.
- Screen files are in `src/screens/*`.
- Main data-heavy screens (`HomeScreen`, `ProgressScreen`, `AnalysisScreen`, `HistoryScreen`) compute local view models from `AppState` and derived maps.

## Home layout architecture (current)
`src/screens/HomeScreen.tsx`:
- Two-column mode is layout-width driven (`layoutWidth >= 640`), not device-type driven.
- Right column is fixed-order stack: `cardio/bodyweight` tiles, last workout card, notes card.
- Last workout card uses fixed measured height after first layout capture.
- Muscle-group chips in last workout keep compact two-row behavior in constrained/two-column layouts, while iOS one-column mode uses fluid wrapping to show full group labels without compact overflow truncation.
- Left column stacks muscle groups list + `Notert` + `Analyse` nav cards.
- "Today workout" card and bottom sheet use explicit session lifecycle semantics:
  - `LIVE` is shown only while a session is active (`startedAtISO` exists and `finishedAtISO` is absent).
  - A top-level "Finish workout" action sets `finishedAtISO`.
  - Finished sessions show duration (`finishedAtISO - startedAtISO`) instead of `LIVE`.

## Notes architecture
- Dedicated notes repository in `src/features/notes/data/notesRepository.ts`.
- Sources tagged: `home_notes`, `quicklog`, `other`.
- Notes entities are normalized with backend-ready sync metadata defaults (`clientId`, `updatedAt`, `version`, `syncStatus`, `deletedAt`).
- Notes storage is an envelope (`notes` + `sync`) in the same key, with backward-compatible read from legacy array payloads.
- `NotertScreen` reads from repository; home card writes via `handleAddNote`.
- Startup migration (`buildNotesMigration`) lifts legacy note-like logs/notes into repository.

## Auth and network boundary
- GitHub OAuth web flow in `useAppActions` (client side).
- Token exchange and user lookup in Netlify function `netlify/functions/github-oauth.js` with timeout + status-checked fetches.
- No remote workout sync path in current repository.

## Cross-cutting concerns
- i18n: `src/shared/i18n/i18n.ts` (`t`, `blockLabel`).
- Theme tokens: `src/shared/theme/tokens.ts` (base) + `src/shared/theme/themes.ts` (persisted `darkBlue`/`calmLight` Home theme semantics).
- Global typography patching of `Text` and `TextInput`: `src/shared/theme/typography.ts`.
- Error boundary wrapper: `src/app/ErrorBoundary.tsx`.
- Architecture guard script + CI gate: `scripts/verify-architecture.js` and `.github/workflows/ci.yml`.
  - Guardrails include no direct legacy blob writes and required tombstone wiring in workout mutations.

## Verified technical debt
- No lint script and no test script in `package.json`.
- `src/domain/parsing/applyParsedChunks.ts` is currently unreferenced.
- `src/screens/ExerciseScreen.tsx` is currently unreferenced by navigation.

## Data integrity rules
- AppState is treated as immutable.
- Domain/state update helpers return new objects/arrays.
- Persistence normalization is defensive for missing/legacy fields.
- Deletes are hard-removed from active collections but recorded as sync tombstones with deterministic outbox delete events.
- Parsing path is deterministic and side-effect free in domain layer.
