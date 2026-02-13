# Status Report

Last updated: 2026-02-10 (branch `main`, commit `2a5ebee0`)

## Project snapshot (verified)
- Stack: Expo 54, React Native 0.81, React 19, TypeScript 5.9 (`package.json`).
- Routing: custom stack in `src/app/navigation/useNavStack.ts`, screen switch in `App.tsx`.
- State: in-memory React state + AsyncStorage hydration in `src/app/state/useAppStore.ts`.
- Persistence: debounced/critical persister in `src/app/state/persist.ts`.
- Main storage: `treasy_app_state_v2` (`src/features/workouts/data/storage.ts`).
- Notes storage: `treasy_notes_v1` (`src/features/notes/data/notesRepository.ts`).
- AI answers: local rule engine (`src/features/analytics/model/aiService.ts`).

## Current implemented capabilities
- Auth entry flows: guest, email onboarding, and web GitHub OAuth callback handling.
- Workout logging flows:
  - Free-text quick log with parse-to-workout or fallback-to-note behavior.
  - Direct set logging from block/exercise workflows and cardio logging.
  - Home "Dagens økt" lifecycle with explicit finish action and active/finished session state.
- Notes flows:
  - Home notes card writes to notes repository.
  - `NotertScreen` reads grouped notes by date and supports per-note deletion via in-app confirm modal + undo toast.
- Insights flows:
  - Home-level momentum/volume snapshots.
  - `ProgressScreen`, `AnalysisScreen`, `RepMaxScreen`, and `HistoryScreen` for deeper drill-downs.
- Profile/settings flows:
  - Backup export/copy/local save.
  - Unit/language/profile fields and danger-zone destructive actions.

## Home screen status (current)
- Two-column mode is measured by content width (`>= 640`), not device type.
- Right column is currently stacked as:
  - `Cardio`, `Kroppsvekt`, `Forrige okt`, `Notater`.
- Last workout card uses fixed height after measurement.
- Muscle chips inside last workout use internal scroll with constrained chip area.
- Home color system supports persisted `darkBlue` / `calmLight` theme modes via header toggle.
- "Dagens økt" and "Analyse" cards use iconless compact headers, emphasized metric line, and a consistent `›` chevron.
- `LIVE` appears only when workout session is active; once finished, Home shows workout duration.
- "Dagens økt" primary text is lifecycle-driven: `Start en økt` (idle), `Fullfør økten` (active), `Økt fullført ✓` (finished).

## Quality gates
- Typecheck script exists: `npm run typecheck`.
- Lint script: not present.
- Test script: not present.

## Known technical debt / risks
- No automated lint/tests in package scripts.
- `src/domain/parsing/applyParsedChunks.ts` is unreferenced.
- `src/screens/ExerciseScreen.tsx` is unreferenced by current navigation switch.
- Migration handling is distributed (storage normalization + notes migration) rather than explicit versioned migrations.
- Global typography patch modifies `Text`/`TextInput` render behavior app-wide; changes there have high blast radius.

## Active docs alignment status
- `PROJECT_CONTEXT.md` is now aligned to current architecture and flows.
- `docs/ARCHITECTURE.md` reflects runtime/data-flow boundaries.
- `docs/DECISIONS.md` tracks implemented architectural choices.
- `docs/ROADMAP.md` tracks code-derived priorities; external priority source remains UNKNOWN.

## UNKNOWN
- Official external backlog ordering (if maintained outside repo) is UNKNOWN.
  Verification path: confirm with maintainers/external tracker.
