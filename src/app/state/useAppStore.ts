import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState as NativeAppState, Platform } from 'react-native';
import type { AppState } from '../../features/workouts';
import { createInitialState, loadAppState } from '../../features/workouts';
import { inferBlockIdFromExercise } from '../../features/quicklog';
import { SAVE_DEBOUNCE_MS } from '../../shared/constants';
import { createAppStatePersister, type AppStatePersister } from './persist';

function normalizeExerciseBlocks(state: AppState): AppState {
  const validBlocks = new Set(state.blocks.map((b) => b.id));
  let changed = false;
  const exercises = state.exercises.map((ex) => {
    if (validBlocks.has(ex.blockId)) return ex;
    const inferred = inferBlockIdFromExercise(ex.name);
    const fallback = inferred && validBlocks.has(inferred) ? inferred : state.blocks[0]?.id ?? ex.blockId;
    if (!fallback || fallback === ex.blockId) return ex;
    changed = true;
    return { ...ex, blockId: fallback };
  });
  if (!changed) return state;
  return { ...state, exercises };
}

export function useAppStore(): {
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
  loading: boolean;
  error: string | null;
  persister: AppStatePersister;
} {
  const persister = useMemo(() => createAppStatePersister({ debounceMs: SAVE_DEBOUNCE_MS }), []);

  const [appState, setAppStateInner] = useState<AppState>(() => createInitialState());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Keep an up-to-date reference for lifecycle flush events.
  const stateRef = useRef<AppState>(appState);
  useEffect(() => {
    stateRef.current = appState;
  }, [appState]);

  // Custom setter that keeps `stateRef` in sync with the most recently computed state.
  const setAppState: React.Dispatch<React.SetStateAction<AppState>> = useCallback((update) => {
    const prev = stateRef.current;
    const next =
      typeof update === 'function'
        ? (update as (prevState: AppState) => AppState)(prev)
        : update;

    stateRef.current = next;
    setAppStateInner(next);
  }, []);

  useEffect(() => {
    let alive = true;

    const init = async () => {
      try {
        const stored = await loadAppState();
        const base = stored ?? createInitialState();
        const next = normalizeExerciseBlocks(base);
        if (!alive) return;
        stateRef.current = next;
        setAppStateInner(next);

        // Behavior-preserving boot save:
        // - The old App.tsx persisted on *every* state change, including initial hydration.
        // - Persisting once on boot keeps derived/defaulted fields (like `userId`) stable across restarts,
        //   while still keeping ongoing saves "smarter" via debouncing/critical saves in actions.
        if (!stored) {
          void persister.saveNow(next);
        } else {
          persister.scheduleSave(next);
        }
      } catch (e) {
        console.warn('Failed to bootstrap app state', e);
        if (alive) {
          setError('Failed to load app state');
          const fallback = createInitialState();
          stateRef.current = fallback;
          setAppStateInner(fallback);
          void persister.saveNow(fallback);
        }
      } finally {
        if (alive) setLoading(false);
      }
    };

    init();

    return () => {
      alive = false;
    };
  }, []);

  // Flush pending debounced saves when the app is backgrounded/unloaded.
  useEffect(() => {
    const flush = () => {
      void persister.flushPending(stateRef.current);
    };

    const subscription = NativeAppState.addEventListener('change', (nextState) => {
      if (nextState === 'background' || nextState === 'inactive') {
        flush();
      }
    });

    const handleBeforeUnload = () => {
      flush();
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.addEventListener('beforeunload', handleBeforeUnload);
    }

    return () => {
      subscription.remove();

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.removeEventListener('beforeunload', handleBeforeUnload);
      }

      // Best-effort: persist any pending debounced change before teardown.
      flush();
      persister.cancelPending();
    };
  }, [persister]);

  return {
    appState,
    setAppState,
    loading,
    error,
    persister,
  };
}
