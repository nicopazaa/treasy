import type { AppState } from '../../domain/workouts/types';
import { SAVE_DEBOUNCE_MS } from '../../shared/constants';
import { saveAppState } from '../../features/workouts/data/storage';

export type AppStatePersister = {
  // Debounced persistence: caller may call frequently (typing, drag reordering, etc).
  // Only the latest state provided during the debounce window is saved.
  scheduleSave: (state: AppState) => void;
  // Immediate persistence: cancels any pending debounced save and saves the given state now.
  saveNow: (state: AppState) => Promise<void>;
  // Persists if (and only if) a debounced save is currently pending.
  // Uses the latest state scheduled during the debounce window.
  flushPending: (state: AppState) => Promise<void>;
  // Cancels any pending debounced save.
  cancelPending: () => void;
};

export function createAppStatePersister(opts: { debounceMs?: number }): AppStatePersister {
  const debounceMs = opts.debounceMs ?? SAVE_DEBOUNCE_MS;

  let timer: ReturnType<typeof setTimeout> | null = null;
  let latestState: AppState | null = null;

  const cancelPending = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };

  const persist = async (state: AppState) => {
    try {
      await saveAppState(state);
    } catch (e) {
      console.warn('Failed to persist app state', e);
    }
  };

  const scheduleSave = (state: AppState) => {
    latestState = state;

    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      const toSave = latestState;
      latestState = null;
      if (!toSave) return;
      void persist(toSave);
    }, debounceMs);
  };

  const saveNow = async (state: AppState) => {
    latestState = state;
    cancelPending();
    await persist(state);
  };

  const flushPending = async (state: AppState) => {
    if (!timer) return;
    cancelPending();
    const toSave = latestState ?? state;
    latestState = null;
    await persist(toSave);
  };

  return {
    scheduleSave,
    saveNow,
    flushPending,
    cancelPending,
  };
}
