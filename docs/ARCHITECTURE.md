# Treasy architecture (high-level)

## Layers
- `src/app/`: composition root (state wiring, navigation, orchestration).
- `src/domain/`: pure, deterministic business logic (no UI, no storage).
- `src/features/`: feature modules (UI + integration around domain logic).
- `src/shared/`: cross-cutting utilities and primitives.

## AppState invariants
- `AppState` is treated as immutable: never mutate in place; always return new objects/arrays.
- Entity references are ID-based:
  - `SetEntry.exerciseId` and `CardioEntry.exerciseId` reference `Exercise.id`.
  - `Exercise.blockId` references `TrainingBlock.id` (string).
- Timestamps:
  - `createdAt` fields are stored as ISO strings.
  - “day keys” used for grouping are derived deterministically from timestamps.

## Persistence guarantees
- Local-first: the full `AppState` is persisted to `AsyncStorage` under a stable key (`treasy_app_state_v2`).
- Loading is defensive and normalizing:
  - Missing/defaulted fields are filled deterministically (e.g. blocks, `userId`, `language`, `massUnit`).
  - Exercises are normalized (aliases default, canonical name computed, system/custom inference preserved).
- Saving is best-effort:
  - Debounced saves reduce write frequency; critical updates may flush immediately.
  - No persistence format changes are allowed without an explicit migration.

## Parsing guarantees
- Parsing is deterministic and side-effect free:
  - `parseTrainingText` splits input into segments (newline/`;`) and extracts sets via a stable regex.
  - `applyParsedChunks` applies parsed data without mutating the input state.
- Matching/categorization:
  - Exact match prefers canonical name, then aliases, then normalized `name`.
  - Fuzzy matching and block inference are deterministic and threshold-based.
- IDs created by parsing are deterministic for a given `(timestamp, sequence)` input.

## Navigation model
- `NavState` is a small, serializable discriminator (`screen`) plus optional parameters.
- `useNavStack` maintains an in-memory history stack with:
  - `navigate`/`reset`
  - `back`/`forward`
  - swipe back/forward gestures (platform-tuned thresholds)
- `App.tsx` renders exactly one screen for the active `NavState.screen`.

## Local-first constraints
- Core functionality does not depend on network availability.
- “AI” answers are derived from local workout history and app state (no remote calls).
- Auth flows (e.g. GitHub web OAuth) are optional wiring around local persistence.

