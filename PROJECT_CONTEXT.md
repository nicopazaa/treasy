# Treasy - PROJECT_CONTEXT

Last updated: 2026-02-10 05:30:14 +01:00 (branch `main`, commit `2a5ebee0`)

Scope: this document describes the codebase as it exists now. For run-specific snapshot details (working tree + verification), see `docs/AI_HANDOFF.md`.

## What Treasy is
Treasy is a local-first workout logging app built with Expo + React Native for mobile and web. Users can log workouts as free text, log sets directly, track cardio, view history/progress/analysis, and keep notes.

## Runtime modes
- Mobile app via Expo (iOS/Android).
- Web in browser (`npm run web`).
- PWA-style exported web build (`npm run build:web` + `scripts/postexport-web.js`).

## Screen map (wired in `App.tsx`)
- Auth/onboarding: `landing`, `login`, `welcome`.
- Main: `home`, `block`, `quickLog`, `history`, `progress`, `analysis`, `repMax`.
- Support: `ai`, `cardio`, `notert`, `profile`, `settings`, `manageExercises`.

## Core architecture
- Composition root: `App.tsx`.
- App wiring: `src/app/*`.
- Domain logic (pure/deterministic): `src/domain/*`.
- Feature modules: `src/features/*`.
- Shared UI/theme/i18n/utils: `src/shared/*`.

## App state and persistence
Source of truth type: `src/domain/workouts/types.ts` (`AppState`).

Primary AsyncStorage key:
- `treasy_app_state_v2` via `src/features/workouts/data/storage.ts`.

Additional AsyncStorage keys:
- Notes repository: `treasy_notes_v1` (`src/features/notes/data/notesRepository.ts`).
- AI chat history: `treasy_ai_chat_v1` (`src/screens/AIScreen.tsx`).
- Profile local backup snapshot: `treasy_backup_export` (`src/screens/ProfileScreen.tsx`).

`AppState` currently includes:
- Identity/settings: `userId`, `onboarded`, `authProvider`, `userEmail`, `nickname`, `heightCm`, `weightKg`, `theme`, `language`, `massUnit`.
- Training data: `blocks`, `exercises`, `sets`, `cardioEntries`, `activeWorkout`, `logs`, `notes`.

Note: notes are now persisted in a dedicated notes repository key. `AppState.notes` remains for legacy migration/compatibility handling.
Theme note: Home persists `darkBlue` / `calmLight`; legacy `dark` / `light` values are normalized on load.

## Data flow
Hydration + store:
- `useAppStore` loads state, normalizes it, and wires persistence (`src/app/state/useAppStore.ts`).
- `createAppStatePersister` supports debounced + immediate saves (`src/app/state/persist.ts`).

Action orchestration:
- `useAppActions` handles domain mutations, persistence mode (`critical` vs `debounced`), auth callbacks, and notes migration (`src/app/actions/useAppActions.ts`).

Derived cache:
- `useDerivedCache` builds lookup maps for exercises and sets (`src/app/state/useDerivedCache.ts`).

## Parsing and logging behavior
Text parsing:
- Parse pipeline: `src/domain/parsing/parsePipeline.ts`.
- Quick log parser/action mapping: `src/domain/quicklog/parseInputToAction.ts`.

Current behavior:
- If input resolves to known exercise entries + valid sets, it is logged as workout data.
- Otherwise, text is persisted as a note via `notesRepository` (source-tagged as `home_notes` or `quicklog`).

## Navigation and gestures
- Navigation uses custom in-memory stack (`src/app/navigation/useNavStack.ts`), not react-navigation routers.
- Swipe back/forward gesture behavior is implemented in `useNavStack`.
- Gesture blockers are provided via `BackSwipeContext` (`src/app/navigation/BackSwipeContext.tsx`).

## Home screen layout behavior
Current wide-layout behavior in `src/screens/HomeScreen.tsx`:
- Two-column mode is width-based: measured container width `>= 640`.
- Right column ordering is a fixed vertical stack: other blocks (`cardio`, `bodyweight`) -> last workout card -> notes card.
- Last workout card height is fixed after initial measurement; only the muscle-chip area inside it can scroll.
- Left column keeps muscle groups list, then `Notert` and `Analyse` nav cards.
- Header has an in-place round theme toggle (tap switches `darkBlue`/`calmLight`; long-press opens shortcuts).
- The `Dagens økt` card and panel use an explicit session lifecycle:
  - Active session (`activeWorkout.startedAtISO` without `finishedAtISO`) shows `LIVE`.
  - Finishing a session sets `activeWorkout.finishedAtISO` and Home shows duration instead of `LIVE`.

## AI behavior
- AI answers are generated locally from app state by rule-based logic (`src/features/analytics/model/aiService.ts`).
- No remote LLM/network call is used for answer generation.

## Auth/network behavior
- Web-only GitHub OAuth starts in `useAppActions` and completes through Netlify function `netlify/functions/github-oauth.js`.
- OAuth session state key: `treasy_github_oauth_state` in `sessionStorage`.
- Outside OAuth, app data is local-first with AsyncStorage.

## Build and scripts
From `package.json`:
- `npm start`, `npm run android`, `npm run ios`, `npm run web`.
- `npm run build:web` (export + postexport patch).
- `npm run typecheck`.

No `lint` or `test` scripts currently exist.

## Verified implementation gaps
- No automated lint/test scripts (`package.json`).
- `src/domain/parsing/applyParsedChunks.ts` exists but is currently unreferenced.
- `src/screens/ExerciseScreen.tsx` exists but is currently not routed from `App.tsx`.
- No formal migration framework; normalization/migration is handled ad hoc in storage/action layers.

## UNKNOWNs
- External roadmap/issue tracker source of truth is UNKNOWN.
  Verification path: confirm with maintainers whether priorities are tracked outside this repository.
