# Treasy — PROJECT_CONTEXT

Last updated: 2026-01-11 04:52:07 +01:00 (branch `main`, commit `ed549457`)

Scope: this document describes the current codebase. For a per-run snapshot (git status + verification), see `docs/AI_HANDOFF.md`.

## What Treasy is
Treasy is a local-first workout log built with Expo / React Native (mobile + web). Users can log workouts as free text; the app stores the raw text and (when possible) parses structured sets deterministically.

## Core behavior (verified in code)
- Local-first persistence: the full `AppState` is stored in AsyncStorage under `treasy_app_state_v2` (`src/features/workouts/data/storage.ts`).
- Quick Log parsing: free text is parsed by `parseTrainingText` and applied by `applyParsedChunks` (`src/domain/parsing/*`), creating/updating exercises + sets in `AppState`.
- Notes + logs: `AppState` includes `logs` and `notes` arrays (`src/domain/workouts/types.ts`).
- Backup export: Profile exports a JSON snapshot (download/copy/save locally) (`src/screens/ProfileScreen.tsx`).
- Progressive overload: `src/screens/ProgressScreen.tsx` renders per-exercise progress (charts + “Based on your workouts” insight) using i18n keys under `progress.*` (`src/shared/i18n/i18n.ts`).

## Network behavior (verified)
- In app code, the only `fetch()` call is the optional GitHub OAuth exchange on web (`src/app/actions/useAppActions.ts`).
- Workouts are persisted via AsyncStorage (no remote workout storage implementation in this repo).

## Tech stack (from repo files)
- Node.js: `20` (`.nvmrc`, `netlify.toml`)
- Package manager: npm (`package-lock.json`)
- Expo: `~54.0.31` (`package.json`)
- React Native: `0.81.5` (`package.json`)
- React: `19.1.0` (`package.json`)
- TypeScript: `~5.9.2` (`package.json`)

## Repo scripts (from `package.json`)
- Dev server: `npm start`
- Platforms: `npm run ios`, `npm run android`, `npm run web`
- Web export: `npm run build:web`
- Typecheck: `npm run typecheck`

No `lint` or `test` scripts exist in `package.json`.

## Architecture overview (high-level)
- Composition root: `App.tsx` wires fonts, store, derived cache, navigation, and renders the current screen via `switch (nav.screen)`.
- State management: `src/app/state/useAppStore.ts` keeps `AppState` in React state, hydrates via `loadAppState()`, and flushes pending saves on background/unload.
- Persistence: debounced + critical saves via `src/app/state/persist.ts`, triggered from `src/app/actions/useAppActions.ts`.
- Domain logic: deterministic/pure modules under `src/domain/*` (parsing, workout mutations/queries, analytics).

## Data model & persistence
Source of truth: `src/domain/workouts/types.ts`
- `AppState` includes: `blocks`, `exercises`, `sets`, `cardioEntries`, plus profile/settings and `logs`/`notes`.
- Main persistence key: `treasy_app_state_v2` (`src/features/workouts/data/storage.ts`)
- Backup export key: `treasy_backup_export` (`src/screens/ProfileScreen.tsx`)
- Migrations: there is no standalone migrations framework; `loadAppState()` performs normalization/defaulting (`src/features/workouts/data/storage.ts`, `src/features/workouts/model/initialState.ts`).

## Navigation
- Custom in-memory stack with back/forward + swipe gestures: `src/app/navigation/useNavStack.ts`.
- Screen params/types: `src/app/navigation/types.ts`.
- `@react-navigation/native` is present but not used for routing; it is used for `NavigationContext` / `useFocusEffect` in a few screens (e.g. `src/screens/HomeScreen.tsx`, `src/screens/HistoryScreen.tsx`, `src/screens/RepMaxScreen.tsx`).

## Parsing
- Parse: `src/domain/parsing/parsePipeline.ts` (`parseTrainingText`)
- Apply: `src/domain/parsing/applyParsedChunks.ts` (`applyParsedChunks`)
- Matching uses exact match first, then fuzzy match with `FUZZY_MATCH_THRESHOLD` (`src/domain/quicklog/exerciseLookup.ts`, `src/shared/constants.ts`).

## AI
- UI: `src/screens/AIScreen.tsx`
- Implementation: `src/features/analytics/model/aiService.ts`
- Behavior: local Q&A over `AppState` and workout history (no network calls in this module).

## i18n
- Strings live in `src/shared/i18n/i18n.ts`.
- Translator: `t(language, key, params?)` where `language` is `AppLanguage` (`en`, `nb`, `es`).

## Theme & fonts
- Theme tokens: `src/shared/theme/tokens.ts` and per-block accents `src/shared/theme/blockTone.ts`.
- Custom font: `RobotoSlab-SemiBold` is loaded in `App.tsx` via `expo-font` and used in `src/screens/HomeScreen.tsx`.
- Block icons mapping: `src/shared/ui/blockIcons.ts` (`BLOCK_ICON_SOURCES`).

## Deployment / web OAuth
- Web hosting: Netlify (`netlify.toml`)
- Netlify Function: `netlify/functions/github-oauth.js`
- OAuth env vars:
  - Client: `EXPO_PUBLIC_GITHUB_CLIENT_ID` (used in `src/app/actions/useAppActions.ts`)
  - Server: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` (used in `netlify/functions/github-oauth.js`)

## Known issues (verified)
- Some i18n strings contain encoding artifacts (see `src/shared/i18n/i18n.ts`).
- No automated tests or lint scripts are configured (`package.json`).
- `src/domain/analytics/insights.ts` operates on `appState.sets` only (does not use `cardioEntries`).
- `src/features/auth/index.ts` is empty (`export {}`) and has no references (as of this snapshot).
