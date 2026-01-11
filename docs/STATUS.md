# Status Report

Last updated: 2026-01-11 04:52:07 +01:00 (branch `main`, commit `ed549457`)

## Project mapping (verified)
- Stack: Expo 54 / React Native 0.81 / React 19 / TypeScript 5.9 (`package.json`).
- Routing: custom screen switch in `App.tsx` driven by `useNavStack` (`src/app/navigation/useNavStack.ts`).
- State: React state managed in `src/app/state/useAppStore.ts`; actions/orchestration in `src/app/actions/useAppActions.ts`.
- Storage: AsyncStorage single-blob `AppState` under `treasy_app_state_v2` (`src/features/workouts/data/storage.ts`).
- AI: local Q&A (`src/features/analytics/model/aiService.ts`), no network calls in that module.
- Backend/sync: none in repo; the only `fetch()` call in app code is optional GitHub OAuth on web (`src/app/actions/useAppActions.ts`), backed by `netlify/functions/github-oauth.js`.

## Current screens (verified by `App.tsx`)
- Onboarding/auth: `LandingScreen`, `LoginScreen`, `WelcomeScreen`.
- Core: `HomeScreen`, `BlockScreen`, `ExerciseScreen`, `QuickLogScreen`, `HistoryScreen`.
- Insights: `ProgressScreen` (progressive overload), `AnalysisScreen`, `RepMaxScreen`.
- Other: `AIScreen`, `CardioScreen`, `ProfileScreen`, `SettingsScreen`, `ManageExercisesScreen`.

## Quality gates
- Typecheck: `npm run typecheck` (script exists).
- Lint/tests: NONE (no scripts in `package.json`).

## Known bugs / tech debt (verified)
- Encoding artifacts exist in some i18n strings (`src/shared/i18n/i18n.ts`).
- No automated tests or lint scripts are configured (`package.json`).
- Analytics insights (`src/domain/analytics/insights.ts`) operate on `appState.sets` only (do not incorporate `cardioEntries`).
- `src/features/auth/index.ts` is empty (`export {}`) and unreferenced (as of this snapshot).

## Roadmap / priorities
- `docs/ROADMAP.md` exists but is currently a template; priorities are UNKNOWN (verify with maintainers).
