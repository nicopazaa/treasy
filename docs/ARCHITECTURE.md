# Treasy architecture (high-level)

## Layering
- `App.tsx`: composition root (fonts, store, navigation, screen selection).
- `src/app/`: app wiring (state hydration/persistence, navigation, orchestration/actions).
- `src/screens/`: screen components rendered by `App.tsx`.
- `src/domain/`: pure/deterministic logic (workouts, parsing, analytics).
- `src/features/`: feature modules built on domain logic.
- `src/shared/`: cross-cutting primitives (theme tokens, i18n, utilities, UI components).

## AppState model
- Defined in `src/domain/workouts/types.ts`.
- Treated as immutable across the app (copy-on-write updates; no in-place mutation).
- Core entities:
  - `TrainingBlock`, `Exercise`, `SetEntry`, `CardioEntry`, plus `logs`/`notes`.

## State + persistence wiring
- Hydration: `src/app/state/useAppStore.ts` loads state via `loadAppState()` (`src/features/workouts/data/storage.ts`) and applies light normalization.
- Persistence: `src/app/state/persist.ts` provides debounced saves (`scheduleSave`) and immediate saves (`saveNow`); `useAppStore` flushes pending saves on app background/unload.
- Orchestration: `src/app/actions/useAppActions.ts` applies domain mutations and chooses persistence mode per update (critical vs debounced).

## Storage format
- `AppState` is stored as a single JSON blob in AsyncStorage under key `treasy_app_state_v2` (`src/features/workouts/data/storage.ts`).
- There is no standalone migrations framework; `loadAppState()` performs normalization/defaulting on load.

## Parsing pipeline (deterministic)
- Parse: `parseTrainingText` (`src/domain/parsing/parsePipeline.ts`).
- Apply: `applyParsedChunks` (`src/domain/parsing/applyParsedChunks.ts`).
- Matching: exact match, then deterministic fuzzy match (`src/domain/quicklog/exerciseLookup.ts`, threshold in `src/shared/constants.ts`).
- IDs created by parsing use `makeId(prefix, now, seq)`; deterministic for a given `(now, seq)` input.

## Navigation
- Custom in-memory history stack: `src/app/navigation/useNavStack.ts` (`navigate`, `back`, `forward`, `reset`) plus swipe back/forward gestures.
- `App.tsx` renders exactly one screen based on `nav.screen` (`src/app/navigation/types.ts`).
- `@react-navigation/native` is not used for routing; some screens use `NavigationContext`/`useFocusEffect` with fallbacks when the context is absent.

## Local-first constraints
- Core workout data is stored locally; no remote workout storage implementation exists in this repo.
- Web-only GitHub OAuth uses a Netlify Function (`netlify/functions/github-oauth.js`) and a client-side `fetch()` in `src/app/actions/useAppActions.ts`.
