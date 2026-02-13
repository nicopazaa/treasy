# Treasy - AI Handoff Snapshot

## 1) Snapshot header
- Timestamp: 2026-02-10 05:33:35 +01:00
- Branch: `main`
- Commit (short): `2a5ebee0`
- Working tree: dirty (`modified=21`, `deleted=2`, `untracked=9`)

## 2) What this repo is
Treasy is a local-first workout and notes app built with Expo/React Native (mobile + web). The app stores workout state in AsyncStorage, supports free-text quick logging with deterministic parsing, keeps notes in a dedicated notes repository key, and provides history/progress/analysis/rep-max views. AI responses are local rule-based answers over the stored workout state.

## 3) How to run + verify
Run (from `package.json`):
- Install: `npm install`
- Dev server: `npm start`
- Web: `npm run web`
- iOS: `npm run ios`
- Android: `npm run android`
- Export web/PWA assets: `npm run build:web`

Verify:
- Typecheck: `npm run typecheck`
- Lint/tests: not configured in scripts

## 4) Repo map
Top-level:
- `App.tsx`
- `PROJECT_CONTEXT.md`
- `docs/*`
- `src/app/*`
- `src/domain/*`
- `src/features/*`
- `src/screens/*`
- `src/shared/*`
- `netlify/functions/github-oauth.js`

Important implementation files:
- Navigation: `src/app/navigation/types.ts`, `src/app/navigation/useNavStack.ts`
- Store/persist: `src/app/state/useAppStore.ts`, `src/app/state/persist.ts`
- Actions: `src/app/actions/useAppActions.ts`
- Data model: `src/domain/workouts/types.ts`
- Workout ops: `src/domain/workouts/workoutService.ts`
- Parsing: `src/domain/parsing/parsePipeline.ts`, `src/domain/quicklog/parseInputToAction.ts`
- Notes repo/migration: `src/features/notes/data/notesRepository.ts`, `src/features/notes/model/notesMigration.ts`
- Home layout: `src/screens/HomeScreen.tsx`
- AI logic: `src/features/analytics/model/aiService.ts`

## 5) Current product state (code-verified)
- Custom stack navigation with swipe back/forward gestures.
- Home supports width-based two-column mode (`>= 640`), with fixed right-column order (`cardio/bodyweight -> last workout -> notes`).
- Home supports persisted token-based theme switching (`darkBlue` / `calmLight`) from an in-header round toggle.
- Last workout card height is fixed after measurement; chip list inside it is internally scrollable.
- Home "Dagens økt" now has an explicit finish flow backed by persisted `activeWorkout` session timestamps.
- `LIVE` is shown only while the current session is active; finished sessions show duration.
- Quick Log parses known exercise text to workout entries; unknown text is saved as note.
- Notes are persisted under `treasy_notes_v1` and surfaced in `NotertScreen`.
- Main app state persists under `treasy_app_state_v2`.
- AI chat answers are generated locally; chat history is persisted under `treasy_ai_chat_v1`.

## 6) Working tree notes
The repository is not clean and includes non-doc source changes outside this handoff update. Existing modified/untracked source files were preserved.

## 7) Known sharp edges (verified)
- No lint script and no test script in `package.json`.
- `src/domain/parsing/applyParsedChunks.ts` currently appears unreferenced.
- `src/screens/ExerciseScreen.tsx` currently appears unreferenced by navigation.
- Migration strategy is ad hoc (normalization + migration code), not explicit versioned migration steps.

## 8) Guardrails
- Keep `AppState` update paths immutable.
- Preserve storage keys unless a migration is added.
- Keep parsing deterministic and side-effect free in domain parsing modules.
- Keep right-column order/spacing behavior in Home stable in two-column mode.
- Keep GitHub OAuth state validation + cleanup behavior unchanged.

## 9) Common change entrypoints
- Add screen: `src/screens/*` + `src/app/navigation/types.ts` + `App.tsx` switch.
- Change persistence/model: `src/domain/workouts/types.ts`, `src/features/workouts/model/initialState.ts`, `src/features/workouts/data/storage.ts`.
- Change parsing: `src/domain/parsing/parsePipeline.ts`, `src/domain/quicklog/parseInputToAction.ts`.
- Change notes behavior: `src/features/notes/data/notesRepository.ts`, `src/features/notes/model/notesMigration.ts`, `src/app/actions/useAppActions.ts`.

## 10) Verification status (this run)
- `npm.cmd run -s typecheck`: PASS
- Lint/tests: not runnable (scripts not present)
