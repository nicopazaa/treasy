# Treasy — AI Handoff Snapshot

## 1) Snapshot Header
- Timestamp: 2026-01-11 04:59:16 +01:00
- Branch: `main`
- Commit (short): `ed549457`
- Working tree: dirty (16 modified, 3 untracked)

## 2) What This Repo Is (~80 words)
Treasy is a local-first workout log built with Expo / React Native (mobile + web). Users log free text; the app stores the raw text and (when possible) parses structured sets (exercise + weight/reps + optional RPE) deterministically. All workout data is stored locally in AsyncStorage as a single `AppState` JSON blob. Optional identity exists (guest/email locally; GitHub OAuth on web via Netlify Function) but workouts are not stored remotely.

## 3) How To Run + Verify (exact scripts that exist)
Run:
- Install: `npm install`
- Dev server: `npm start` (PowerShell may require `npm.cmd start`)
- Web: `npm run web`
- iOS: `npm run ios`
- Android: `npm run android`
- Web export: `npm run build:web`

Verify:
- Typecheck: `npm run typecheck` (PowerShell: `npm.cmd run -s typecheck`)
- Lint/tests: N/A (no `lint`/`test` scripts in `package.json`)

## 4) Repo Map
### Tree (depth 3; excludes `node_modules/`, `dist/`, `build/`, `.expo/`, `.next/`, `coverage/`, `.git/`)
```
.
  App.tsx
  assets/
  docs/
    AI_HANDOFF.md
    ARCHITECTURE.md
    DECISIONS.md
    INDEX.md
    ROADMAP.md
    STATUS.md
  netlify/
    functions/
      github-oauth.js
  package.json
  package-lock.json
  PROJECT_CONTEXT.md
  scripts/
    postexport-web.js
  src/
    app/
    domain/
    features/
    screens/
    shared/
```

### Important Files Index
- **Composition root**: `App.tsx`
- **Navigation**: `src/app/navigation/types.ts`, `src/app/navigation/useNavStack.ts`
- **State (hydrate/persist)**: `src/app/state/useAppStore.ts`, `src/app/state/persist.ts`
- **Actions/orchestration (mutations + auth + navigation helpers)**: `src/app/actions/useAppActions.ts`
- **Data model**: `src/domain/workouts/types.ts`
- **Workout mutations/queries**: `src/domain/workouts/workoutService.ts`
- **Persistence (AsyncStorage)**: `src/features/workouts/data/storage.ts` (key: `treasy_app_state_v2`)
- **Parsing**: `src/domain/parsing/parsePipeline.ts`, `src/domain/parsing/applyParsedChunks.ts`
- **Fuzzy matching**: `src/domain/quicklog/exerciseLookup.ts` (threshold in `src/shared/constants.ts`)
- **AI**: `src/features/analytics/model/aiService.ts`, UI: `src/screens/AIScreen.tsx`
- **Home UI**: `src/screens/HomeScreen.tsx` (wordmark + nav icon asset)
- **Progressive overload UI/logic**: `src/screens/ProgressScreen.tsx` (insight + control tray + chart)
- **Block screens header (shared)**: `src/shared/ui/BlockScreenHeader.tsx`
- **Block icon mapping (Home + Progress)**: `src/shared/ui/blockIcons.ts` (`BLOCK_ICON_SOURCES`)
- **Exercise row formatting (shared)**: `src/shared/ui/ExerciseRow.tsx`
- **i18n**: `src/shared/i18n/i18n.ts`
- **Theme**: `src/shared/theme/tokens.ts`, `src/shared/theme/blockTone.ts`
- **Fonts**: loaded in `App.tsx` via `useFonts` (`expo-font`); assets in `assets/fonts/*`
- **Netlify OAuth function**: `netlify/functions/github-oauth.js`

## 5) Current Product State (verified by code)
- Local-first workout data stored in AsyncStorage (`treasy_app_state_v2`).
- Quick Log saves raw text to `AppState.logs` and parses sets into exercises/sets when possible.
- Blocks/exercises/sets CRUD flows across Home/Block/Exercise screens.
- History, Progress (progressive overload), Rep Max, and Analysis screens compute derived views from logged sets.
- Backup export from Profile: download (web), copy to clipboard (web), save snapshot to AsyncStorage (`treasy_backup_export`).
- “AI” answers are computed locally from app state and workout history (no remote LLM calls in `src/features/analytics/model/aiService.ts`).

## 6) Roadmap / Priorities
- `docs/ROADMAP.md` exists but is currently a template; priorities are UNKNOWN (verify with maintainers).

## 7) Known Bugs / Sharp Edges (verified)
Note: initial UI render is gated on custom font readiness (`fontsLoaded || fontsError`) in `App.tsx`.
1) Encoding artifacts exist in some i18n strings (see `src/shared/i18n/i18n.ts`).
2) No lint script configured (`package.json`) → style regressions can slip in.
3) No test script configured (`package.json`) → domain changes are easy to break.
4) `src/domain/analytics/insights.ts` operates on `appState.sets` only (does not incorporate `cardioEntries`).
5) Persistence is whole-state JSON; large states may impact performance (`src/features/workouts/data/storage.ts`).
6) GitHub OAuth is web-only and depends on env vars + Netlify Function availability (`src/app/actions/useAppActions.ts`, `netlify/functions/github-oauth.js`).
7) `src/features/auth/index.ts` exports nothing and is unreferenced (as of this snapshot).
8) Error boundary fallback is minimal (`src/app/ErrorBoundary.tsx`).

## 8) Guardrails (do not break)
- Keep `AppState` immutable semantics: never mutate objects/arrays in-place.
- Keep custom fonts registered in `App.tsx` (`useFonts`) and reference them by exact `fontFamily` strings (e.g. `RobotoSlab-SemiBold`).
- Do not rename the nav icon asset `src/assets/compass.png` (used by `src/screens/HomeScreen.tsx`).
- Do not change AsyncStorage main key (`treasy_app_state_v2`) without a migration plan.
- Parsing modules must remain deterministic and side-effect free (`src/domain/parsing/*`).
- Keep exercise matching order stable (exact by canonical/alias/name before fuzzy).
- GitHub OAuth flow must preserve `state` validation + callback cleanup behavior (`src/app/actions/useAppActions.ts`).

## 9) Where To Make Common Changes (recipes)
### Add a new screen
1) Add a new screen component in `src/screens/<NewScreen>.tsx`.
2) Add the screen name to `src/app/navigation/types.ts` (`ScreenName` + `NavState` params if needed).
3) Wire the screen into the `switch(nav.screen)` in `App.tsx` and pass required props/actions.

### Edit theme/colors
1) Update tokens in `src/shared/theme/tokens.ts`.
2) For muscle accents, update `src/shared/theme/blockTone.ts`.
3) Sanity check key screens: `src/screens/HomeScreen.tsx`, `src/screens/QuickLogScreen.tsx`, `src/screens/ProgressScreen.tsx`.

### Change parsing rules
1) Update parsing regex/logic in `src/domain/parsing/parsePipeline.ts`.
2) Update application/matching behavior in `src/domain/parsing/applyParsedChunks.ts`.
3) Verify Quick Log + Notes flows in `src/app/actions/useAppActions.ts` (they call the parsing pipeline).

### Add a new data field + migration (or explain none)
- There is no formal migrations framework.
1) Add field to `src/domain/workouts/types.ts`.
2) Add default in `src/features/workouts/model/initialState.ts`.
3) Add normalization/defaulting in `src/features/workouts/data/storage.ts` (`loadAppState()`).
4) Keep changes idempotent.

## 10) Verification Status (THIS run)
- `typecheck`: PASS (`npm.cmd run -s typecheck`)
- `lint`: N/A (no script)
- `tests`: N/A (no script)
