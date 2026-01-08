# Treasy — PROJECT_CONTEXT (for AI tools)

Use this file as a ready-to-paste context/system prompt when working with this repo. It describes the architecture, entrypoints, data model, and the main user flows so an AI can navigate the codebase quickly and make safe changes.

Primary language: **English** (so most AI tools perform well). App UI strings include **English / Norwegian (nb) / Spanish**.

---

## 1) What this project is

**Treasy** is a **local-first training log** built with **Expo / React Native** targeting **mobile + web**.

Core UX idea:
- Users can log workouts as free text (“Notes-style”).
- The app **always saves the raw text**.
- When possible it **parses structure** (exercise + sets) from that text.

Important constraints:
- There is **no cloud sync for workouts** in this version.
- “AI” in the UI (“Appa”) is **local, rule-based Q&A** over the user’s own log data (no LLM calls).
- Optional GitHub login exists **only for web** (via Netlify Function) and is used as an identity/onboarding feature, not a workout-sync backend.

---

## 2) Tech stack & runtime

- **Expo**: `~54.0.0`
- **React**: `19.1.0`
- **React Native**: `0.81.0`
- **react-native-web**: `^0.21.0`
- **TypeScript**: `~5.9.2`
- **Storage**: `@react-native-async-storage/async-storage`
- **Deploy (web)**: Netlify (`netlify.toml`, `netlify/functions/*`)

Node version:
- Local: `.nvmrc` is `20`
- Netlify build env: `NODE_VERSION = "20"` in `netlify.toml`

---

## 3) How to run / build

From repo root:
- Install: `npm install`
- Start dev server: `npm start`
- Platform:
  - Web: `npm run web`
  - iOS: `npm run ios`
  - Android: `npm run android`

Build/export web:
- `npm run build:web`
  - Runs `expo export --platform web` → outputs to `dist/`
  - Runs `scripts/postexport-web.js` to add PWA files + patch `dist/index.html`

Netlify:
- Build command: `npm run build:web`
- Publish dir: `dist`
- Functions dir: `netlify/functions`

---

## 4) Repository layout (high-level)

Top-level:
- `App.tsx` — single entrypoint; owns app state, storage wiring, custom navigation, OAuth callback handler, and screen routing.
- `src/` — all app code.
- `assets/` — Expo icons/splash assets referenced by `app.json`.
- `web/` — PWA assets copied into `dist/` after export.
- `netlify/functions/` — serverless functions (GitHub OAuth code exchange).
- `scripts/` — build/post-export helpers.
- `dist/` — generated web build output (gitignored).

Directory tree (abridged; excludes `node_modules/`, `.git/`, `dist/`, `.expo/`):
```
.
|-- App.tsx
|-- app.json
|-- package.json
|-- tsconfig.json
|-- netlify.toml
|-- scripts/
|   \-- postexport-web.js
|-- netlify/
|   \-- functions/
|       \-- github-oauth.js
|-- web/
|   |-- index.html
|   |-- manifest.json
|   \-- (icons...)
|-- src/
|   |-- app/navigation/types.ts
|   |-- screens/
|   |-- features/
|   \-- shared/
```

---

## 5) Key entrypoints (where the app “starts”)

**Runtime entry:** `App.tsx`

Major responsibilities inside `App.tsx`:
- Load persisted app state from AsyncStorage at startup (`loadAppState()`).
- Normalize/migrate state (e.g. ensure new default blocks exist).
- Persist state on each change (`saveAppState()`).
- Handle onboarding (guest / email / GitHub web).
- Implement “custom navigation” (a small reducer-based history stack).
- Wire screen components + pass callbacks that mutate state using pure functions.

There is no `expo-router` or multi-file navigation setup; everything routes through `App.tsx`.

---

## 6) Data model (source of truth)

The app stores one serialized object: `AppState`.

Types live in:
- `src/features/workouts/model/types.ts`
- Shared enums live in: `src/shared/types/index.ts`

`AppState` includes:
- Identity/onboarding:
  - `userId?`, `onboarded?`, `authProvider?` (`guest | email | github`)
  - `userEmail: string | null`
- Profile/settings:
  - `nickname?`, `heightCm?`, `weightKg?`
  - `theme?` (`light | dark`) — stored but not heavily used
  - `language?` (`en | nb | es`)
- Training data:
  - `blocks: TrainingBlock[]` (muscle groups)
  - `exercises: Exercise[]` (belongs to a block, has optional `shortCode` and `tags`)
  - `sets: SetEntry[]` (strength/bodyweight/cardio-style set metadata)
  - `cardioEntries: CardioEntry[]` (separate cardio log stream)
  - `logs?: LogEntry[]` (free text log; always append)
  - `notes?: NoteEntry[]` (free text notes)

Storage keys:
- Main state: `treasy_app_state_v2` (AsyncStorage)
- Backup export: `treasy_backup_export` (AsyncStorage)

Default blocks (always present) are defined in:
- `src/features/workouts/model/initialState.ts`

State mutations are implemented as **pure functions** returning a new state:
- `src/features/workouts/model/workoutService.ts`
  - Examples: `addLogEntry`, `addExercise`, `addSet`, `deleteExercise`, `reorderExercisesInBlock`, etc.

---

## 7) Custom navigation (important for edits)

Navigation types:
- `src/app/navigation/types.ts` (`ScreenName`, `NavState`)

Implementation:
- `App.tsx` maintains a `navHistory` stack with actions:
  - `reset`, `navigate`, `back`, `forward`
- On web/mobile, edge-swipe gestures can move back/forward via `PanResponder`.

This means:
- To add a new screen, you generally:
  1) Add the screen name to `ScreenName` union.
  2) Add optional nav params in `NavState` (if needed).
  3) Import + render the screen conditionally in `App.tsx`.
  4) Route to it using `navigate('yourScreen', { ...params })`.

---

## 8) Main user flows (where to look)

### 8.1 Startup + onboarding

Startup:
- `loadAppState()` → if none, `createInitialState()`
- Route to:
  - `landing` if not onboarded
  - `home` if onboarded

Guest onboarding:
- `LandingScreen` → “Continue without login”
- Sets `onboarded=true`, `authProvider='guest'` (if not already)
- Navigates to `quickLog` with a local-only notice

Email onboarding (local-only identity):
- `LoginScreen` → choose email
- `WelcomeScreen` collects email → `authProvider='email'`, sets `userEmail` and derives nickname

GitHub onboarding (web-only):
- Starts OAuth in `App.tsx` using `EXPO_PUBLIC_GITHUB_CLIENT_ID`
- Callback is handled at path `/auth/github`
- Exchanges `code` via Netlify Function `/.netlify/functions/github-oauth`
- On success: `authProvider='github'`, sets email/login, navigates to `quickLog`

### 8.2 Quick Log (core UX)

Quick Log screen:
- `src/screens/QuickLogScreen.tsx`

Core behavior (wired in `App.tsx`):
- Always save entered text to `logs` first (`addLogEntry`).
- If the text parses like sets (`parseQuickLog()`):
  - If exercise already exists (fuzzy match): append sets to it
  - Else: create exercise + sets and optionally prompt for muscle group

Parsing & matching:
- `src/features/quicklog/model/quickLogService.ts` — parses e.g. `80x2` patterns; infers block by keywords
- `src/features/quicklog/model/exerciseLookup.ts` — fuzzy lookup using name + shortCode + tags

### 8.3 Notes → auto log/import

Home can add a “note”:
- Adds note entry
- Adds the same text to logs
- Tries to parse and write structured exercises/sets from the note

Parsing:
- `src/features/notes/model/noteParser.ts` (supports `bw x reps` and regular sets)

### 8.4 Workouts CRUD

Muscle block screen:
- `src/screens/BlockScreen.tsx`
- Lists exercises within a block
- Supports:
  - add/rename exercise (incl. metadata)
  - delete exercise with undo (restores exercise + sets)
  - reorder within a block (long-press to start move; tap target to place)
  - move exercise to a different block

Exercise screen:
- `src/screens/ExerciseScreen.tsx`
- Add/update/delete/restore sets
- Cardio-like input path exists when exercise is in `cardio` block

### 8.5 History / Progress / Rep Max

History:
- `src/screens/HistoryScreen.tsx`
- Data helpers:
  - `getWorkoutDates`, `getDailyWorkout`, `groupDailySets` in `src/features/workouts/model/workoutService.ts`

Progress:
- `src/screens/ProgressScreen.tsx`
- Simple chart/table; computes 1RM estimate per set locally.

Rep Max:
- `src/screens/RepMaxScreen.tsx`
- Picks best set per exercise and groups by block.

### 8.6 Insights + “Appa” Q&A

Home insights cards:
- `src/features/analytics/model/insights.ts`
- UI:
  - `src/features/analytics/ui/MomentumCard.tsx`
  - `src/features/analytics/ui/VolumeCard.tsx`
  - `src/features/analytics/ui/PreviousWorkoutsTimeline.tsx`

“AI” screen (Appa):
- UI: `src/screens/AIScreen.tsx`
- Logic: `src/features/analytics/model/aiService.ts`
  - Pure, rule-based responses over `appState.sets`
  - No network/LLM usage

### 8.7 Cardio

Cardio screen:
- `src/screens/CardioScreen.tsx`

Storage:
- Saves to `appState.cardioEntries` via `addCardioEntry()`.

Important note:
- Many “history/insights” views primarily use `appState.sets`. Cardio entries saved only as `cardioEntries` may not show up in those computations unless explicitly integrated.

---

## 9) i18n / strings

Strings and language options:
- `src/shared/i18n/i18n.ts`

Use:
- `t(language, 'key', params)` for UI strings
- `blockLabel(blockId, language)` for muscle group labels

Languages supported:
- `en`, `nb`, `es`

---

## 10) Netlify / OAuth integration

Netlify function:
- `netlify/functions/github-oauth.js`

Flow:
1) Client redirects user to GitHub authorize endpoint.
2) GitHub redirects back to `/auth/github?code=...&state=...`.
3) `App.tsx` verifies `state` from `sessionStorage`.
4) `App.tsx` calls `/.netlify/functions/github-oauth?code=...`.
5) Function exchanges code for access token and fetches user profile + email.

Env vars:
- `EXPO_PUBLIC_GITHUB_CLIENT_ID` (needed client-side for authorize URL)
- `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` (needed server-side for token exchange)

Security note:
- This is an OAuth identity flow; there is no backend storage for workouts.

---

## 11) PWA (web) build behavior

After `expo export --platform web`, `scripts/postexport-web.js`:
- Copies from `web/` into `dist/`:
  - `manifest.json`
  - `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`
- Patches `dist/index.html` to ensure:
  - Correct viewport meta
  - iOS standalone meta tags
  - theme-color + manifest link

---

## 12) Conventions / editing guidelines (to avoid breaking the app)

- Prefer editing **pure state functions** in `src/features/workouts/model/workoutService.ts` instead of mutating state in screens.
- If you add fields to `AppState`, update:
  - `createInitialState()` in `src/features/workouts/model/initialState.ts`
  - `loadAppState()` normalization/migration in `src/features/workouts/data/storage.ts`
- If you add a new screen:
  - Update `src/app/navigation/types.ts`
  - Wire it into `App.tsx` routing
  - Add translations in `src/shared/i18n/i18n.ts` if needed
- Be careful about **encoding/mojibake artifacts** in some strings (seen in several UI texts). When editing, ensure files remain UTF-8 and check rendered output on web.

---

## 13) Known “truth sources” vs outdated docs

Source of truth:
- Actual code under `App.tsx` + `src/`

May be outdated:
- `docs/STATUS.md` appears to mention older file paths and should not be relied on without verifying current code.

