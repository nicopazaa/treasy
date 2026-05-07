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
- Optional sync runtime env:
  - `EXPO_PUBLIC_SUPABASE_URL`
  - `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
  - `EXPO_PUBLIC_SYNC_ENDPOINT`
  - `EXPO_PUBLIC_SYNC_BATCH_SIZE`
  - `EXPO_PUBLIC_SYNC_TIMEOUT_MS`
  - `EXPO_PUBLIC_SYNC_RETRY_BASE_MS`
  - `EXPO_PUBLIC_SYNC_RETRY_MAX_MS`

Session lifecycle:
- `AppState.activeWorkout` stores workout session start/finish timestamps for Home "Today workout" lifecycle (`startedAtISO`, optional `finishedAtISO`).

### 4) Action layer
`useAppActions` is the orchestration boundary:
- Applies domain state updates.
- Chooses persistence mode per action.
- Handles auth flows (guest/email/GitHub web callback).
- Runs one-time notes migration from legacy storage paths.

### 4a) Optional Supabase auth runtime
`src/app/auth/useSupabaseAuth.ts` is the cloud-identity runtime:
- Creates a Supabase client only when env config is present.
- Starts GitHub OAuth through Supabase Auth on web.
- Hydrates/persists the Supabase session (browser storage on web, AsyncStorage-backed adapter on native).
- Upgrades local `AppState.userId` to the authenticated Supabase user id so sync can target a shared account identity.
- Falls back cleanly to the legacy Netlify GitHub OAuth path when Supabase is not configured.

### 4b) Sync processor
`src/app/sync/useSyncProcessor.ts` is the runtime sync worker:
- Watches `AppState.sync.outbox` and the notes repository sync envelope.
- Batches events in deterministic `changedAt` order.
- Sends them to the configured endpoint with timeout handling.
- Adds an `Authorization: Bearer ...` header when a Supabase session token exists.
- Marks entities `pending` while in flight, `synced` on ACK, and `failed` on retryable failures.
- Uses exponential backoff for retries and stays inert when no endpoint is configured.

### 4c) Server sync backend
`netlify/functions/sync.js` is the authenticated sync ingress:
- Requires a Supabase bearer token and verifies it through Supabase Auth before accepting a batch.
- Rejects payloads whose `userId` does not match the authenticated Supabase user id.
- Calls Supabase Postgres RPC `public.apply_sync_batch` using the server-only service-role key.

Supabase SQL lives in `supabase/migrations/20260426_sync_backend.sql`:
- Per-entity tables: `app_exercises`, `app_sets`, `app_cardio_entries`, `app_logs`, `app_notes`.
- Persistent tombstones: `app_sync_tombstones`.
- RLS is enabled for authenticated user-scoped reads.
- Writes happen through SQL functions, not direct client table access.

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
- Notes repository now exposes sync snapshot, ACK/status helpers, and a lightweight change subscription so the app-level sync processor can react to note mutations without screen wiring.

## Auth and network boundary
- Preferred auth path is optional Supabase Auth (`src/app/auth/supabaseClient.ts` + `src/app/auth/useSupabaseAuth.ts`).
- GitHub OAuth web fallback remains in `useAppActions` (client side) plus token exchange/user lookup in Netlify function `netlify/functions/github-oauth.js`.
- Optional remote sync uses a single app-level batch POST adapter in `src/app/sync/useSyncProcessor.ts`.
- Authenticated sync ingestion now exists in `netlify/functions/sync.js` and uses Supabase REST/RPC as the database boundary.
- No remote sync call is made unless `EXPO_PUBLIC_SYNC_ENDPOINT` is present.

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
- The backend currently uses version-based stale-write protection, but richer conflict semantics (merge/winner rules surfaced to the user) are still not implemented.

## Data integrity rules
- AppState is treated as immutable.
- Domain/state update helpers return new objects/arrays.
- Persistence normalization is defensive for missing/legacy fields.
- Deletes are hard-removed from active collections but recorded as sync tombstones with deterministic outbox delete events.
- Server sync keeps its own tombstone table so lower-version stale upserts cannot resurrect previously deleted rows.
- Parsing path is deterministic and side-effect free in domain layer.
