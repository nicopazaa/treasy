# Treasy — PROJECT_CONTEXT

## A) Project Summary (≤120 words)
Treasy is a local-first training log built with Expo / React Native (mobile + web). The core UX is “log like Notes”: users type free text (Quick Log / Notes), Treasy always saves the raw text, and it deterministically parses structured sets (exercise + weight/reps + optional RPE) when it can. All data lives on-device in AsyncStorage as a single `AppState` JSON blob (no workout backend / no sync). Optional identity exists (guest/email locally; GitHub OAuth on web via a Netlify Function) but does not store workouts remotely.

## B) Core Product Behavior
- Local-first: app works offline; all workout data is stored in AsyncStorage.
- Onboarding: guest-first; optional email identity; optional GitHub web OAuth identity.
- Quick Log: saves free text to `AppState.logs`; attempts parsing and adds sets/exercises.
- Notes: saves note text and also appends to logs; attempts parsing into structured data.
- Workouts CRUD: blocks → exercises → sets; supports delete + undo flows (screen-dependent).
- Insights: derives simple momentum/volume/timeline from sets (not cardioEntries).
- Backup/export: profile screen can download/copy/save a JSON snapshot (no import UI).

## C) Non-Goals / Out Of Scope
- Cloud sync of workouts / multi-device account sync.
- Server-side storage of `AppState` or workout data.
- LLM-backed “AI”; current “AI” is local heuristic Q&A over workout history.
- Complex training plans/programming engine; Treasy is a log first.
- Guaranteed backwards compatibility beyond current storage normalization (no formal migrations framework yet).

## D) Tech Stack + Versions
- Node.js: `20` (from `.nvmrc`; also `NODE_VERSION=20` in `netlify.toml`)
- Package manager: npm (lockfile: `package-lock.json`)
- Framework/runtime:
  - Expo: `~54.0.31` (`package.json`)
  - React Native: `0.81.5` (`package.json`)
  - React / React DOM: `19.1.0` (`package.json`)
  - TypeScript: `~5.9.2` (`package.json`)
- Key libraries:
  - Storage: `@react-native-async-storage/async-storage`
  - Safe areas: `react-native-safe-area-context`
  - Screens primitives: `react-native-screens`, `react-native-web`
  - Status bar: `expo-status-bar`
  - Navigation: custom stack (`src/app/navigation/useNavStack.ts`); `@react-navigation/native` is present but routing is not React Navigation (verify usage via ripgrep).

## E) How To Run (Step-by-step) + Environment Notes
1) Install deps: `npm install`
2) Start dev server: `npm start`
   - If PowerShell blocks `npm` scripts, use: `npm.cmd start`
3) Run a platform:
   - Web: `npm run web`
   - iOS: `npm run ios` (requires Xcode / simulator)
   - Android: `npm run android` (requires Android Studio / emulator)
4) Web export:
   - `npm run build:web` (runs `expo export --platform web` then `scripts/postexport-web.js`)

Notes:
- Web uses a static export to `dist/` and is configured for Netlify hosting (`netlify.toml`).
- GitHub OAuth identity is web-only (uses `window.location` + Netlify Function).

## F) Testing & Quality Gates
- Typecheck: `npm run typecheck`
- Lint: NONE (no `lint` script in `package.json`)
- Tests: NONE (no `test` script in `package.json`)
- Formatter: NONE configured (no `format` script in `package.json`)

## G) Repo Structure Overview
### Tree (depth 4; excludes `node_modules/`, `dist/`, `build/`, `.expo/`, `.next/`, `coverage/`, `.git/`)
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
      actions/
        useAppActions.ts
      ErrorBoundary.tsx
      navigation/
        BackSwipeContext.tsx
        types.ts
        useNavStack.ts
      state/
        derivedCache.ts
        persist.ts
        useAppStore.ts
        useDerivedCache.ts
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
      analytics/
        insights.ts
      parsing/
        applyParsedChunks.ts
        parsePipeline.ts
      quicklog/
        exerciseLookup.ts
        quickLogService.ts
        types.ts
      workouts/
        nameNormalize.ts
        types.ts
        workoutService.ts
    features/
      analytics/
        data
        index.ts
        model
        ui
      auth/
        data
        index.ts
        model
        ui
      notes/
        index.ts
        model
      parsing
      quicklog/
        data
        index.ts
        model
        ui
      workouts/
        data
        index.ts
        model
        ui
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
      i18n/
        i18n.ts
      index.ts
      systemEntities.ts
      theme/
        blockTone.ts
        tokens.ts
      time.ts
      types/
        index.ts
      ui/
        ExerciseRow.tsx
        LabeledInput.tsx
        PrimaryButton.tsx
        QuickKeypad.tsx
        Surface.tsx
        UndoToast.tsx
      utils/
        dateLabels.ts
        exerciseLabel.ts
        units.ts
  tsconfig.json
  web/
    apple-touch-icon.png
    favicon.png
    icon-192.png
    icon-512.png
    index.html
    manifest.json
```

### Where To Find X (map)
- App entry / composition root: `App.tsx`
- Screens: `src/screens/*Screen.tsx`
- Navigation model: `src/app/navigation/types.ts`, `src/app/navigation/useNavStack.ts`
- App state wiring (hydrate/persist): `src/app/state/useAppStore.ts`, `src/app/state/persist.ts`
- Orchestration (mutations + auth + routing helpers): `src/app/actions/useAppActions.ts`
- Domain types: `src/domain/workouts/types.ts`
- Domain mutations/queries: `src/domain/workouts/workoutService.ts`
- Persistence (AsyncStorage): `src/features/workouts/data/storage.ts`
- Parsing pipeline: `src/domain/parsing/parsePipeline.ts`, `src/domain/parsing/applyParsedChunks.ts`
- Quicklog matching/inference: `src/domain/quicklog/*`
- Insights: `src/domain/analytics/insights.ts`, UI in `src/features/analytics/ui/*`
- i18n strings: `src/shared/i18n/i18n.ts`
- Theme tokens: `src/shared/theme/tokens.ts`, `src/shared/theme/blockTone.ts`
- Shared UI primitives: `src/shared/ui/*`
- App icons / splash: `assets/*`, in-app images: `src/assets/*`

## H) Architecture & Data Flow
- UI layer: screen components in `src/screens/*`.
- Composition root: `App.tsx` owns current nav state and renders exactly one screen.
- Navigation: `useNavStack` is an in-memory history stack with back/forward + swipe gestures.
- State:
  - `useAppStore` loads and normalizes `AppState` via `loadAppState()`; creates a debounced persister.
  - `useAppActions` applies pure mutations (domain functions), triggers persistence, and navigates screens.
- Domain rules (pure):
  - Workout mutations/queries in `src/domain/workouts/workoutService.ts` (immutable updates).
  - Parsing is deterministic (`parseTrainingText` → `applyParsedChunks`).
- Persistence:
  - `saveAppState()` writes the entire `AppState` blob to AsyncStorage.

## I) Data Model & Persistence
### Entities (source of truth: `src/domain/workouts/types.ts`)
- `AppState`: profile/settings + `blocks`, `exercises`, `sets`, `cardioEntries`, `logs`, `notes`.
- `TrainingBlock`: muscle group (default blocks are created in `src/features/workouts/model/initialState.ts`).
- `Exercise`: belongs to `blockId`; may include `shortCode`, `tags`, `aliases`, `canonicalName` (normalization).
- `SetEntry`: strength/bodyweight/cardio-like set metadata (weight/reps + optional distance/duration/pause).
- `CardioEntry`: cardio events (distance/duration/HR/intensity).
- `LogEntry` / `NoteEntry`: raw text entries.

### Storage
- Main state key: `treasy_app_state_v2` (`src/features/workouts/data/storage.ts`)
- Backup snapshot key: `treasy_backup_export` (`src/screens/ProfileScreen.tsx`)
- “Migrations”: there is no explicit migrations framework; `loadAppState()` performs normalization/defaulting (verify in `src/features/workouts/data/storage.ts`).

How to safely add a new `AppState` field:
- Add field to `src/domain/workouts/types.ts`
- Add default in `createInitialState()` (`src/features/workouts/model/initialState.ts`)
- Add normalization/defaulting in `loadAppState()` (`src/features/workouts/data/storage.ts`)

## J) Parsing / Domain Logic
Entry points:
- Parse: `parseTrainingText(input, { language, defaultUnit })` in `src/domain/parsing/parsePipeline.ts`
- Apply: `applyParsedChunks(state, chunks, { language })` in `src/domain/parsing/applyParsedChunks.ts`

Behavior (verified by code):
- Splits input by newline or `;` into exercise segments.
- Extracts sets by regex requiring `weight x reps` (supports `bw`, `kg`, `lb`, `*`).
- Converts units to kg; treats 0 weight as bodyweight.
- Matching order: exact by canonical/alias/name, then fuzzy match (`FUZZY_MATCH_THRESHOLD` in `src/shared/constants.ts`).

Known limits (verify in code):
- Parsing currently only covers weight/reps (+ optional RPE token in pipeline); anything else is ignored.
- Cardio entries are a separate stream (`cardioEntries`) and are not used by insights in `src/domain/analytics/insights.ts`.

## K) UI/UX Rules
- Layout:
  - Common horizontal padding: `SCREEN_PADDING` from `src/shared/theme/tokens.ts`
  - Web screens commonly clamp to `maxWidth: 720` (per-screen `Platform.select({ web: ... })`)
- Theme:
  - Dark background baseline: `#020617` (common across screens)
  - Primary action/link blue comes from theme tokens (`src/shared/theme/tokens.ts`)
  - Muscle-group accents via `src/shared/theme/blockTone.ts`
- Patterns:
  - Prefer shared primitives in `src/shared/ui/*` for consistent touch targets.
  - Use `hitSlop` on small touch targets (varies by screen).

## L) Config & Deployment
- Expo config: `app.json` (name/slug/icon/splash/web bundler)
- Web/PWA assets: `web/*`
- Web build/export:
  - `npm run build:web` → `expo export --platform web` → `scripts/postexport-web.js` patches `dist/index.html` and copies PWA assets
- Hosting:
  - Netlify: `netlify.toml`, function at `netlify/functions/github-oauth.js`
- Env vars (web OAuth):
  - Client (build-time): `EXPO_PUBLIC_GITHUB_CLIENT_ID` (used in `src/app/actions/useAppActions.ts`)
  - Server (Netlify Function): `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` (see `netlify/functions/github-oauth.js`)
- CI: none detected (no `.github/` directory in repo root as of this run).

## M) Known Issues / TODO
### Known Issues (top 10; verified in repo)
1) Mojibake/encoding artifacts are present in strings and UI glyphs (e.g. `src/shared/i18n/i18n.ts`, `src/screens/QuickLogScreen.tsx`).
2) No lint script configured (`package.json`).
3) No automated tests configured (`package.json`).
4) `docs/STATUS.md` appears inconsistent with current code layout (verify paths mentioned vs `src/` tree).
5) Insights use `appState.sets` and ignore `cardioEntries` (verify in `src/domain/analytics/insights.ts`).
6) Auth is web-only for GitHub and depends on Netlify Functions + env vars (failure modes are user-facing).
7) Persistence is whole-state JSON blob; large states may impact performance (design choice; verify in `src/features/workouts/data/storage.ts`).
8) `src/features/auth/*` exists but its `index.ts` exports nothing (possible dead code; verify references).
9) Error boundary UI is minimal (“Something went wrong.”) with no recovery path (verify `src/app/ErrorBoundary.tsx`).
10) Mixed domain/feature layering exists (some “features” folders are placeholders) (verify `src/features/*` contents).

### TODO / Improvements (top 10; no explicit roadmap found — verify with maintainers)
1) Establish a UTF-8 cleanup pass to remove mojibake and ensure consistent localization text.
2) Add `lint` script + ESLint config; enforce in CI.
3) Add unit tests for deterministic domain logic (parsing + workoutService).
4) Add a formal schema version + migration strategy for `AppState`.
5) Add backup import/restore UX (currently export-only).
6) Decide whether to integrate `cardioEntries` into insights (or map cardio to `SetEntry`).
7) Clarify/remove unused `src/features/auth` scaffolding (or implement it).
8) Document navigation/deep-link strategy (custom nav vs React Navigation).
9) Add performance guardrails for large `AppState` (chunking/indexing beyond `DerivedCache`).
10) Add a release checklist + CI pipeline for web export / Netlify deploy.

## N) Recent Changes (from THIS working tree)
- `git status -sb`: `main` has local changes:
  - `M App.tsx`
  - `M PROJECT_CONTEXT.md`
  - `M src/screens/HomeScreen.tsx`
  - `?? assets/fonts/`
  - `?? docs/AI_HANDOFF.md`
  - `?? docs/DECISIONS.md`
  - `?? docs/ROADMAP.md`
- `git log --oneline -10` (most recent first):
  - `e77c8087 chore: best-practices hardening (no behavior change)`
  - `2d55611c Refactor App state + add exercise aliases/merge + parsing pipeline`
  - `a980bdef Improve progress chart metrics and swipe back`
  - `c1a90a25 Redesign progress muscle groups grid`
  - `4ac3d417 Refine progress tiles and hide other block`
  - `de0197ba Refine history filters and repmax hierarchy`
  - `a95295ab feat: history filters`
  - `b8ef2c42 feat: precise progressive overload chart`
  - `afa679f6 feat: spice up progressive overload`
  - `9ab6eae9 feat: settings and unit preferences`

## O) Safe Change Zones vs High-risk Areas
- Safe-ish:
  - Pure domain modules: `src/domain/*` (keep deterministic + immutable semantics)
  - UI-only changes: `src/screens/*`, `src/shared/ui/*`
  - Theme tokens: `src/shared/theme/*` (watch for ripple effects)
- High-risk:
  - Persistence + normalization: `src/features/workouts/data/storage.ts`
  - `AppState` schema: `src/domain/workouts/types.ts`, `createInitialState()` defaults
  - Navigation + routing: `App.tsx`, `src/app/navigation/*`
  - Auth/OAuth: `src/app/actions/useAppActions.ts`, `netlify/functions/github-oauth.js`

## P) Quick Start For A New AI Collaborator (10–15 lines)
1) Read `src/domain/workouts/types.ts` to understand `AppState`.
2) Read `src/features/workouts/data/storage.ts` to understand persistence + normalization.
3) Read `src/app/state/useAppStore.ts` for hydration + debounced saving behavior.
4) Read `src/app/actions/useAppActions.ts` for mutations, auth flow, and navigation triggers.
5) Read `App.tsx` to see screen routing and prop wiring.
6) For parsing changes: `src/domain/parsing/parsePipeline.ts` and `src/domain/parsing/applyParsedChunks.ts`.
7) For workout mutations: `src/domain/workouts/workoutService.ts`.
8) For i18n: `src/shared/i18n/i18n.ts` (watch for encoding artifacts).
9) For theme: `src/shared/theme/tokens.ts` and `src/shared/theme/blockTone.ts`.
10) Run `npm.cmd run typecheck` before/after changes.
