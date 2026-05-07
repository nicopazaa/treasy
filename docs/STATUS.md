# Status Report

Last updated: 2026-04-26 (working tree, local changes)

## Project snapshot (verified)
- Stack: Expo 54, React Native 0.81, React 19, TypeScript 5.9, Supabase Auth JS 2 (`package.json`).
- Routing: custom stack in `src/app/navigation/useNavStack.ts`, screen switch in `App.tsx`.
- State: in-memory React state + AsyncStorage hydration in `src/app/state/useAppStore.ts`.
- Persistence: debounced/critical persister in `src/app/state/persist.ts`.
- Main storage: entity-oriented AsyncStorage keys (`treasy_app_*_v1`) in `src/features/workouts/data/storage.ts`, with legacy read fallback from `treasy_app_state_v2`.
- Notes storage: `treasy_notes_v1` (`src/features/notes/data/notesRepository.ts`).
- AI answers: local rule engine (`src/features/analytics/model/aiService.ts`).

## Current implemented capabilities
- Auth entry flows: guest, email onboarding, optional Supabase-backed GitHub OAuth, and legacy web GitHub OAuth fallback.
  - When Supabase env is configured, app startup hydrates the Supabase session and upgrades `AppState.userId` to the authenticated Supabase user id.
  - When Supabase env is absent, the existing Netlify GitHub OAuth flow remains the active GitHub login path.
  - Netlify GitHub OAuth function still validates method/status responses and applies timeout + safer error payloads.
- Authenticated sync backend now exists in-repo:
  - Netlify function `netlify/functions/sync.js` validates the Supabase bearer token and forwards write batches to Supabase Postgres RPC.
  - Supabase SQL migration `supabase/migrations/20260426_sync_backend.sql` defines server sync tables, tombstones, RLS, and `apply_sync_batch`.
  - The backend currently ACKs both applied and stale lower-version events, so retries do not loop forever on older writes.
- Workout logging flows:
  - Free-text quick log with parse-to-workout or fallback-to-note behavior.
  - Direct set logging from block/exercise workflows and cardio logging.
  - Exercise log bottom sheet now uses more of the viewport height and lets the history panel shrink/scroll before the keypad is pushed off-screen on shorter displays.
  - Exercise labels with metadata now render the parenthesized short code/tag line beneath the main exercise name across the main listing surfaces instead of keeping everything on one line.
  - Block exercise views (`muskelgrupper`, `cardio`, `kroppsvekt`) now use accent-tinted dark surfaces, clearer row hierarchy, and updated action sheets while preserving existing logging/move/delete behavior.
  - Home "Dagens økt" lifecycle with explicit finish action and active/finished session state.
  - New and normalized workout entities include backend-ready sync metadata defaults (`clientId`, `updatedAt`, `version`, `syncStatus`, `deletedAt`).
  - Workout mutations now emit deterministic sync outbox events and tombstones (`AppState.sync`) for create/update/delete/restore flows.
  - App startup now mounts a dedicated sync processor that watches the outbox, batches events to an optional configured endpoint, applies ACKs, retries failures with exponential backoff, and can attach a Supabase bearer token when a session exists.
- Notes flows:
  - Home notes card writes to notes repository.
  - `NotertScreen` is now i18n-key driven for UI copy (`en/nb/es`), keeps note text accents intact, prefixes parsed quick-log note previews with `- ` on first line, and uses kebab note actions (`Edit` / `Delete`) instead of an inline delete pill.
  - Notes repository now persists an envelope (`notes` + `sync`) and emits outbox/tombstone updates on add/edit/delete/restore-compatible replace flows.
  - Notes repository now also exposes sync snapshot/status/ACK helpers plus a local change subscription so note mutations join the same sync runtime as workouts.
- Insights flows:
  - Home-level momentum/volume snapshots.
  - `ProgressScreen`, `AnalysisScreen`, `RepMaxScreen`, and `HistoryScreen` for deeper drill-downs.
  - `ProgressScreen` now adds instant set-level feedback, next-set suggestions, plateau/regression detection, and chart trendline + PR markers for faster technical interpretation.
  - `HistoryScreen` now reuses the same "Tidligere økter" timeline data model as Home (`buildWorkoutTimeline`), supports enlarged newest rows that compress while scrolling, and preserves per-date drilldown to block -> exercise -> set lines with default-collapsed date cards and nested drilldown that reset when leaving the screen, with reduced visual contrast in nested set details for readability.
- Profile/settings flows:
  - Backup export/copy/local save.
  - Unit/language/profile fields and danger-zone destructive actions.

## Home screen status (current)
- Two-column mode is measured by content width (`>= 640`), not device type.
- Right column is currently stacked as:
  - `Cardio`, `Kroppsvekt`, `Forrige okt`, `Notater`.
- Last workout card uses fixed height after measurement.
- Muscle chips inside last workout stay compact in constrained/two-column layouts, while iOS one-column mode uses fluid wrapping and shows full group labels without compact overflow truncation.
- Home color system supports persisted `darkBlue` / `calmLight` theme modes via header toggle.
- Home now applies a fixed typography system (`T0..T6` => `22/20/18/16/15/14/13`) plus dark-theme contrast tiers (`92/85/70/60` white) across key cards and panels.
- Muscle/other block tiles on Home now use larger touch targets and stronger visual depth for better consistency with block-detail screens.
- Home `Analyse` / `Notatbok` teaser cards now keep title/arrow as foreground content and scale the decorative art down on narrower cards, so mobile and desktop preserve the same composition.
- Home wordmark (`Treasy`) is sticky in top-left while scrolling, tap-scrolls back to top, and fades slightly as scroll depth increases.
- "Dagens økt" and "Analyse" cards use iconless compact headers, emphasized metric line, and a consistent `›` chevron.
- `LIVE` appears only when workout session is active; once finished, Home shows workout duration.
- "Dagens økt" primary text is lifecycle-driven: `Start en økt` (idle), `Fullfør økten` (active), `Økt fullført ✓` (finished).
- Previous-session exercise preview now keeps numeric values visually dominant over unit labels (`kg`/`reps`) in compact card mode.
- Home note cards no longer render note-count chips in the header row.
- Home notes card header title is center-aligned.
- `HistoryScreen` ("Previous workouts") now resolves colors from persisted app theme tokens (`darkBlue` / `calmLight`) instead of a hardcoded dark palette.
- `HistoryScreen` drilldown labels (sets/reps/unknown fallback) now resolve through i18n keys for `en`, `nb`, and `es`.
- Home left notes preview card title now uses i18n key `home.notes.previewTitle` (`Notebook` in `en/nb`, `Cuaderno` in `es`).
- Quick Log input card is compacted vertically (smaller typing field + tighter meta/button spacing) so lower sections surface earlier on screen.
- Quick Log muscle-group chips now render as a wrapped two-column grid instead of horizontal scrolling, so all options are visible without side-scrolling.
- Quick Log now renders `Muscle groups` above the free-text quick-log input section.
- Quick Log muscle-group chips now support tap-again deselect: tapping the already selected group clears selection and hides the `Exercises` panel.
- Quick Log `Exercises` header no longer shows right-side helper/search text (`Enter an exercise name` / `Søk`).

## Quality gates
- Typecheck script exists: `npm run typecheck`.
- Architecture verification script exists: `npm run verify:architecture`.
- Combined verification script exists: `npm run verify`.
- CI workflow exists: `.github/workflows/ci.yml` runs `npm run verify` on push/PR.
- Lint script: not present.
- Test script: not present.

## Known technical debt / risks
- No automated lint/tests in package scripts (type/architecture gates exist, but behavior tests are still missing).
- `src/domain/parsing/applyParsedChunks.ts` is unreferenced.
- `src/screens/ExerciseScreen.tsx` is unreferenced by current navigation switch.
- Migration handling is distributed (storage normalization + notes migration) rather than explicit versioned migrations.
- Full product-level conflict resolution semantics for concurrent device edits are still undefined; the backend currently only enforces version-based stale-write protection.
- Global typography patch modifies `Text`/`TextInput` render behavior app-wide; changes there have high blast radius.

## Active docs alignment status
- `PROJECT_CONTEXT.md` is now aligned to current architecture and flows.
- `docs/ARCHITECTURE.md` reflects runtime/data-flow boundaries.
- `docs/DECISIONS.md` tracks implemented architectural choices.
- `docs/ROADMAP.md` tracks code-derived priorities; external priority source remains UNKNOWN.

## UNKNOWN
- Official external backlog ordering (if maintained outside repo) is UNKNOWN.
  Verification path: confirm with maintainers/external tracker.
