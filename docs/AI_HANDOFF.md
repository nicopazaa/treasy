# Treasy — AI Handoff Snapshot

## 1) Snapshot Header
- Timestamp: 2026-01-10 18:57:25 +01:00
- Branch: `main`
- Commit (short): `e77c8087`
- Working tree: dirty (local changes present; see `git status -sb`)

## 2) What This Repo Is (≤80 words)
Treasy is a local-first workout log built with Expo / React Native (mobile + web). Users log free text; the app always stores the raw text and deterministically parses structured sets (exercise + weight/reps + optional RPE) when possible. All data is stored locally in AsyncStorage as a single `AppState` JSON blob. Optional identity exists (guest/email locally; GitHub OAuth on web via Netlify Function) but workouts are never stored remotely.

## 3) How To Run + Verify (exact commands that exist)
Run:
- Install: `npm install`
- Dev server: `npm start` (PowerShell may require `npm.cmd start`)
- Web: `npm run web`
- iOS: `npm run ios`
- Android: `npm run android`
- Web export: `npm run build:web`

Verify:
- Typecheck: `npm run typecheck` (PowerShell may require `npm.cmd run typecheck`)
- Lint/tests: NONE (no `lint`/`test` scripts in `package.json`)

## 4) Repo Map
### Tree (depth 3; excludes `node_modules/`, `dist/`, `build/`, `.expo/`, `.next/`, `coverage/`, `.git/`)
```
.
  .DS_Store
  .gitattributes
  .gitignore
  .nvmrc
  app.json
  App.tsx
  assets/
    adaptive-icon.png
    favicon.png
    fonts/
      RobotoSlab-SemiBold.ttf
    icon.png
    splash.png
    splash-icon.png
  babel.config.js
  CHANGELOG.md
  Desktop.ini
  docs/
    ARCHITECTURE.md
    STATUS.md
    AI_HANDOFF.md
  netlify/
    functions/
      github-oauth.js
  netlify.toml
  package.json
  package-lock.json
  PROJECT_CONTEXT.md
  README.md
  scripts/
    postexport-web.js
  src/
    app/
      actions
      ErrorBoundary.tsx
      navigation
      state
    assets/
      17533181.png
      arms.png
      back.png
      bodyweight.png
      cardio.png
      chest.png
      compass.png
      core.png
      leggs.png
      shoulder.png
      treasy-logo.png
    domain/
      analytics
      parsing
      quicklog
      workouts
    features/
      analytics
      auth
      notes
      parsing
      quicklog
      workouts
    screens/
      AIScreen.tsx
      AnalysisScreen.tsx
      BlockScreen.tsx
      CardioScreen.tsx
      ExerciseScreen.tsx
      HistoryScreen.tsx
      HomeScreen.tsx
      LandingScreen.tsx
      LoginScreen.tsx
      ManageExercisesScreen.tsx
      ProfileScreen.tsx
      ProgressScreen.tsx
      QuickLogScreen.tsx
      RepMaxScreen.tsx
      SettingsScreen.tsx
      WelcomeScreen.tsx
    shared/
      assert.ts
      constants.ts
      i18n
      index.ts
      systemEntities.ts
      theme
      time.ts
      types
      ui
      utils
  tsconfig.json
  web/
    apple-touch-icon.png
    favicon.png
    icon-192.png
    icon-512.png
    index.html
    manifest.json
```

### Important Files Index
- **UI (screens)**: `src/screens/*Screen.tsx`
- **Navigation**: `src/app/navigation/types.ts`, `src/app/navigation/useNavStack.ts`, `App.tsx`
- **State wiring (hydrate/persist)**: `src/app/state/useAppStore.ts`, `src/app/state/persist.ts`
- **Mutations/orchestration (incl auth)**: `src/app/actions/useAppActions.ts`
- **Data model**: `src/domain/workouts/types.ts`
- **Workout mutations/queries**: `src/domain/workouts/workoutService.ts`
- **Persistence (AsyncStorage)**: `src/features/workouts/data/storage.ts`
- **Parsing**: `src/domain/parsing/parsePipeline.ts`, `src/domain/parsing/applyParsedChunks.ts`
- **Quicklog matching**: `src/domain/quicklog/quickLogService.ts`, `src/domain/quicklog/exerciseLookup.ts`
- **Insights**: `src/domain/analytics/insights.ts`, UI in `src/features/analytics/ui/*`
- **i18n**: `src/shared/i18n/i18n.ts`
- **Theme tokens**: `src/shared/theme/tokens.ts`, `src/shared/theme/blockTone.ts`
- **Netlify OAuth function**: `netlify/functions/github-oauth.js`

## 5) Current Product State (what works now)
- Guest-first onboarding; optional email identity; optional GitHub OAuth on web.
- Quick Log saves raw text (`logs`) and parses sets into exercises/sets when possible.
- Blocks/exercises/sets CRUD flows across Home/Block/Exercise screens.
- History/Progress/Rep Max/Analysis screens compute derived insights from logged sets.
- Backup export from Profile: download (web), copy to clipboard (web), save snapshot to AsyncStorage.

## 6) Active Work / Next Priorities (top 10)
No explicit roadmap or issue tracker is present in-repo. Priorities are **UNKNOWN** — verify via maintainers and recent commits.
1) UNKNOWN — confirm product goals (ask maintainer).
2) UNKNOWN — confirm near-term UX targets (ask maintainer).
3) UNKNOWN — confirm parsing scope expansion (ask maintainer).
4) UNKNOWN — confirm data model changes planned (ask maintainer).
5) UNKNOWN — confirm testing/linting expectations (ask maintainer).
6) UNKNOWN — confirm web deploy/CI expectations (ask maintainer).
7) UNKNOWN — confirm cardio analytics integration goals (ask maintainer).
8) UNKNOWN — confirm localization cleanup goals (ask maintainer).
9) UNKNOWN — confirm navigation strategy (custom vs React Navigation) (ask maintainer).
10) UNKNOWN — confirm backup/restore/import requirements (ask maintainer).

## 7) Known Bugs / Sharp Edges (top 10)
1) Mojibake/encoding artifacts exist in strings/UI glyphs (e.g. `src/shared/i18n/i18n.ts`, `src/screens/QuickLogScreen.tsx`).
2) No lint script configured (`package.json`) → style regressions can slip in.
3) No test script configured (`package.json`) → domain changes are easy to break.
4) Insights ignore `cardioEntries` and use `appState.sets` only (`src/domain/analytics/insights.ts`).
5) Persistence is whole-state JSON; large states may affect performance (`src/features/workouts/data/storage.ts`).
6) GitHub OAuth is web-only and depends on env vars + Netlify Function availability (`src/app/actions/useAppActions.ts`, `netlify/functions/github-oauth.js`).
7) `src/features/auth/index.ts` exports nothing (potential dead scaffolding; verify references).
8) Error boundary fallback is minimal with no recovery action (`src/app/ErrorBoundary.tsx`).
9) `docs/STATUS.md` contains statements that don’t match current code layout (treat as historical notes).
10) Mixed “features” vs “domain” layering (some feature folders are placeholders) (see `src/features/*`).

## 8) Guardrails (“do not break” constraints)
- Keep `AppState` immutable semantics: never mutate objects/arrays in-place.
- Do not change AsyncStorage main key (`treasy_app_state_v2`) without a migration plan.
- Parsing modules must remain deterministic and side-effect free (`src/domain/parsing/*`).
- Keep exercise matching order stable (exact by canonical/alias/name before fuzzy).
- Web GitHub OAuth flow must preserve `state` validation + callback cleanup behavior.

## 9) Where To Make Common Changes (recipes)
### Add a new screen
1) Add a new screen component in `src/screens/<NewScreen>.tsx`.
2) Add the screen name to `src/app/navigation/types.ts` (`ScreenName` + `NavState` params if needed).
3) Wire the screen into the `switch(nav.screen)` in `App.tsx` and pass required props/actions.

### Edit theme/colors
1) Update tokens in `src/shared/theme/tokens.ts` (primary blues, palette, spacing/text sizes).
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
4) Keep changes idempotent (loading the same state twice should not keep rewriting fields).

## 10) Verification Status (THIS run)
- `typecheck`: PASS (`npm.cmd run -s typecheck`)
- `lint`: N/A (no script)
- `tests`: N/A (no script)
