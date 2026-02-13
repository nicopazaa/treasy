import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import type { AppState, ExerciseMetadataInput } from '../../features/workouts';
import {
  addCardioEntry,
  addExercise,
  addLogEntry,
  addSet,
  deleteExercise,
  deleteSet,
  mergeExercises,
  renameExercise,
  reorderExercisesInBlock,
  restoreExercise,
  restoreSet,
  setExerciseBlockId,
  updateSet,
  createInitialState,
} from '../../features/workouts';
import { addNote, listNotes, replaceNotes } from '../../features/notes';
import { applyParsedWorkoutAction, parseInputToAction } from '../../domain/quicklog/parseInputToAction';
import { buildNotesMigration } from '../../features/notes/model/notesMigration';
import { t } from '../../shared/i18n/i18n';
import { formatExerciseLabel } from '../../shared/utils/exerciseLabel';
import { normalizeExerciseName } from '../../domain/workouts/nameNormalize';
import { now } from '../../shared/time';
import { SYSTEM_EXERCISE_IDS } from '../../shared/systemEntities';
import type { NavState, ScreenName } from '../navigation/types';
import type { DerivedCache } from '../state/derivedCache';
import type { AppStatePersister } from '../state/persist';

function ensureCardioExercise(state: AppState): { next: AppState; id: string } {
  const existing = state.exercises.find((ex) => ex.blockId === SYSTEM_EXERCISE_IDS.CARDIO);
  if (existing) return { next: state, id: existing.id };

  const newId = `cardio_${Math.random().toString(36).slice(2, 10)}_${now().toString(36)}`;
  const exercise = {
    id: newId,
    blockId: SYSTEM_EXERCISE_IDS.CARDIO,
    name: 'Cardio',
    shortCode: 'CARDIO',
    tags: [],
    isCustom: false,
    aliases: [],
    canonicalName: normalizeExerciseName('Cardio'),
  };

  return {
    next: { ...state, exercises: [...state.exercises, exercise] },
    id: newId,
  };
}

function isValidISODate(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function toDateKey(iso: string): string {
  return iso.slice(0, 10);
}

function findEarliestSetISOForDate(state: AppState, dateKey: string): string | null {
  let earliestISO: string | null = null;
  let earliestMs = Number.POSITIVE_INFINITY;

  for (const set of state.sets) {
    const createdAt = set?.createdAt;
    if (!isValidISODate(createdAt)) continue;
    if (toDateKey(createdAt) !== dateKey) continue;
    const ms = Date.parse(createdAt);
    if (!Number.isFinite(ms) || ms >= earliestMs) continue;
    earliestMs = ms;
    earliestISO = createdAt;
  }

  return earliestISO;
}

function findAddedSetCreatedAtISO(prev: AppState, next: AppState): string | null {
  if (next.sets.length <= prev.sets.length) return null;

  const prevIds = new Set(prev.sets.map((set) => set.id));
  let candidateISO: string | null = null;
  let candidateMs = Number.NEGATIVE_INFINITY;

  for (const set of next.sets) {
    if (prevIds.has(set.id)) continue;
    const createdAt = set?.createdAt;
    if (!isValidISODate(createdAt)) continue;
    const ms = Date.parse(createdAt);
    if (!Number.isFinite(ms) || ms < candidateMs) continue;
    candidateMs = ms;
    candidateISO = createdAt;
  }

  if (candidateISO) return candidateISO;

  const fallbackCreatedAt = next.sets[next.sets.length - 1]?.createdAt;
  return isValidISODate(fallbackCreatedAt) ? fallbackCreatedAt : null;
}

function withStartedWorkoutSession(state: AppState, startedAtISO: string): AppState {
  if (!isValidISODate(startedAtISO)) return state;

  const startedDateKey = toDateKey(startedAtISO);
  const todayDateKey = new Date().toISOString().slice(0, 10);
  if (startedDateKey !== todayDateKey) return state;

  const current = state.activeWorkout;
  const currentStartedAtISO = current?.startedAtISO;
  const currentFinishedAtISO = current?.finishedAtISO;
  const currentDateKey = isValidISODate(currentStartedAtISO) ? toDateKey(currentStartedAtISO) : null;

  if (!currentStartedAtISO || currentDateKey !== startedDateKey) {
    return { ...state, activeWorkout: { startedAtISO } };
  }

  // If a session was finished and a new set is logged on the same day, start a new active session.
  if (isValidISODate(currentFinishedAtISO)) {
    return { ...state, activeWorkout: { startedAtISO } };
  }

  const currentStartedMs = Date.parse(currentStartedAtISO);
  const startedMs = Date.parse(startedAtISO);
  if (!Number.isFinite(currentStartedMs) || !Number.isFinite(startedMs)) {
    return state;
  }

  if (startedMs >= currentStartedMs) {
    return state;
  }

  return { ...state, activeWorkout: { startedAtISO } };
}

type UpdateMode = 'critical' | 'debounced' | 'none';

type ParsedInputResult = { kind: 'note' } | { kind: 'workout' };
type QuickLogSaveResult = ParsedInputResult & {
  newExerciseId?: string;
  newExerciseName?: string;
};

export function useAppActions(opts: {
  appState: AppState;
  setAppState: React.Dispatch<React.SetStateAction<AppState>>;
  loading: boolean;
  persister: AppStatePersister;
  derivedCache: DerivedCache;
  navigate: (screen: ScreenName, params?: Partial<NavState>) => void;
}): {
  authBusy: boolean;
  loginError: string | null;
  historyInitialDateKey: string | null;
  clearLoginError: () => void;

  // Navigation helpers used by screens
  openHistory: () => void;
  openHistoryForDate: (dateKey: string) => void;

  // Onboarding / auth
  handleContinueWithoutLogin: () => void;
  handleWelcomeComplete: (email: string) => void;
  startGithubLogin: () => void;

  // Orchestration / mutations
  handleStartCardio: () => void;
  handleAddNote: (text: string) => Promise<ParsedInputResult>;
  handleQuickLogSave: (text: string, options?: { blockId?: string | null }) => Promise<QuickLogSaveResult>;
  handleQuickLogSet: (
    exerciseId: string,
    weight: number,
    reps: number,
    options?: { bodyweight?: boolean; distanceKm?: number | null; durationMin?: number | null }
  ) => void;
  finishWorkoutSession: () => void;

  // Screen passthrough updates (behavior-preserving)
  updateProfile: (next: AppState) => void;
  updateSettings: (next: AppState) => void;
  setThemeMode: (theme: AppState['theme']) => void;
  reorderExercises: (blockId: string, orderedExerciseIds: string[]) => void;
  moveExercise: (exerciseId: string, blockId: string) => void;
  addExerciseToBlock: (blockId: string, name: string, metadata?: ExerciseMetadataInput) => void;
  renameExerciseById: (exerciseId: string, name: string, metadata?: ExerciseMetadataInput) => void;
  deleteExerciseById: (exerciseId: string) => void;
  restoreExerciseEntry: (
    exercise: Parameters<typeof restoreExercise>[1],
    sets: Parameters<typeof restoreExercise>[2],
    index?: Parameters<typeof restoreExercise>[3]
  ) => void;
  addSetToExercise: (
    exerciseId: string,
    weight: number,
    reps: number,
    meta?: Parameters<typeof addSet>[4]
  ) => void;
  updateSetById: (
    setId: string,
    weight: number,
    reps: number,
    meta?: Parameters<typeof updateSet>[4]
  ) => void;
  deleteSetById: (setId: string) => void;
  restoreSetEntry: (setEntry: Parameters<typeof restoreSet>[1]) => void;
  categorizeExercise: (exerciseId: string, blockId: string) => void;
  saveCardio: (data: {
    exerciseId?: string | null;
    durationMin: number | null;
    avgHeartRate?: number | null;
    intensity?: 'easy' | 'moderate' | 'hard' | null;
    note?: string | null;
    silentMode?: boolean | null;
  }) => void;
  mergeExercisesById: (fromExerciseId: string, intoExerciseId: string) => void;
} {
  const { loading, persister, setAppState, navigate } = opts;

  const [authBusy, setAuthBusy] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [historyInitialDateKey, setHistoryInitialDateKey] = useState<string | null>(null);
  const githubHandledRef = useRef(false);
  const notesMigrationRef = useRef(false);

  // Imperative "latest state" mirror: lets actions compute `nextState` synchronously,
  // update React state, and trigger persistence with the exact state that was set.
  const stateRef = useRef<AppState>(opts.appState);
  useEffect(() => {
    stateRef.current = opts.appState;
  }, [opts.appState]);

  const applyUpdate = useCallback(
    (updater: (prev: AppState) => AppState, mode: UpdateMode) => {
      const prev = stateRef.current ?? createInitialState();
      const next = updater(prev);
      if (next === prev) return prev;

      stateRef.current = next;
      setAppState(next);

      if (mode === 'critical') {
        void persister.saveNow(next);
      } else if (mode === 'debounced') {
        persister.scheduleSave(next);
      }

      return next;
    },
    [persister, setAppState]
  );

  const clearLoginError = useCallback(() => {
    setLoginError(null);
  }, []);

  const openHistory = useCallback(() => {
    setHistoryInitialDateKey(null);
    navigate('history');
  }, [navigate]);

  const openHistoryForDate = useCallback(
    (dateKey: string) => {
      setHistoryInitialDateKey(dateKey);
      navigate('history');
    },
    [navigate]
  );

  const handleContinueWithoutLogin = useCallback(() => {
    setLoginError(null);
    applyUpdate(
      (prev) => ({
        ...prev,
        onboarded: true,
        authProvider: prev.authProvider ?? 'guest',
      }),
      'critical'
    );
    navigate('quickLog', { showLocalOnlyNotice: true });
  }, [applyUpdate, navigate]);

  const handleWelcomeComplete = useCallback(
    (email: string) => {
      const trimmed = email.trim().toLowerCase();
      setLoginError(null);
      applyUpdate((prev) => {
        const current = prev ?? createInitialState();
        const derivedNickname =
          current.nickname && current.nickname.trim()
            ? current.nickname
            : trimmed.includes('@')
              ? trimmed.split('@')[0]
              : null;
        return {
          ...current,
          onboarded: true,
          authProvider: 'email',
          userEmail: trimmed,
          nickname: derivedNickname,
        };
      }, 'critical');
      navigate('quickLog');
    },
    [applyUpdate, navigate]
  );

  const startGithubLogin = useCallback(() => {
    setLoginError(null);

    const language = stateRef.current?.language ?? 'en';
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      setLoginError(t(language, 'githubWebOnly'));
      return;
    }

    const clientId = process.env.EXPO_PUBLIC_GITHUB_CLIENT_ID;
    if (!clientId) {
      setLoginError(t(language, 'githubNotConfigured'));
      return;
    }

    const state = `st_${Math.random().toString(36).slice(2, 10)}_${now().toString(36)}`;
    window.sessionStorage?.setItem('treasy_github_oauth_state', state);

    const redirectUri = `${window.location.origin}/auth/github`;
    const params = new URLSearchParams();
    params.set('client_id', clientId);
    params.set('redirect_uri', redirectUri);
    params.set('scope', 'read:user user:email');
    params.set('state', state);

    window.location.assign(`https://github.com/login/oauth/authorize?${params.toString()}`);
  }, []);

  // GitHub OAuth callback handling (web-only) – kept behavior-identical.
  useEffect(() => {
    if (loading) return;
    if (githubHandledRef.current) return;
    if (Platform.OS !== 'web') return;
    if (typeof window === 'undefined') return;

    const url = new URL(window.location.href);
    if (url.pathname !== '/auth/github') return;

    const code = url.searchParams.get('code');
    const returnedState = url.searchParams.get('state');
    if (!code) return;

    githubHandledRef.current = true;
    setAuthBusy(true);

    const storedState = window.sessionStorage?.getItem('treasy_github_oauth_state') ?? null;
    const language = stateRef.current?.language ?? 'en';
    if (!returnedState || !storedState || returnedState !== storedState) {
      setLoginError(t(language, 'githubFailed'));
      window.history.replaceState({}, '', '/');
      setAuthBusy(false);
      navigate('login');
      return;
    }

    (async () => {
      try {
        const res = await fetch(`/.netlify/functions/github-oauth?code=${encodeURIComponent(code)}`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error ?? 'GitHub OAuth failed');
        }

        applyUpdate(
          (prev) => ({
            ...prev,
            onboarded: true,
            authProvider: 'github',
            userEmail: data?.email ?? prev.userEmail,
            nickname: prev.nickname ?? data?.login ?? prev.nickname,
          }),
          'critical'
        );

        setLoginError(null);
        navigate('quickLog');
      } catch (e) {
        console.warn('GitHub auth failed', e);
        setLoginError(t(language, 'githubFailed'));
        navigate('login');
      } finally {
        window.sessionStorage?.removeItem('treasy_github_oauth_state');
        window.history.replaceState({}, '', '/');
        setAuthBusy(false);
      }
    })();
  }, [applyUpdate, loading, navigate]);

  useEffect(() => {
    if (loading) return;
    if (notesMigrationRef.current) return;
    notesMigrationRef.current = true;

    void (async () => {
      try {
        const current = stateRef.current ?? createInitialState();
        const existingNotes = await listNotes();
        const migration = buildNotesMigration({ appState: current, existingNotes });
        const notesChanged = migration.nextNotes.length !== existingNotes.length;

        if (notesChanged) {
          await replaceNotes(migration.nextNotes);
        }

        if (migration.logIdsToRemove.length > 0 || migration.shouldClearLegacyNotes) {
          const removeIds = new Set(migration.logIdsToRemove);
          applyUpdate((prev) => {
            const prevLogs = prev.logs ?? [];
            const nextLogs =
              removeIds.size > 0 ? prevLogs.filter((log) => !removeIds.has(log.id)) : prevLogs;
            const shouldClearNotes = migration.shouldClearLegacyNotes && (prev.notes?.length ?? 0) > 0;
            const nextNotes = shouldClearNotes ? [] : prev.notes ?? [];

            const logsChanged = nextLogs.length !== prevLogs.length;
            if (!logsChanged && !shouldClearNotes) return prev;
            return { ...prev, logs: nextLogs, notes: nextNotes };
          }, 'critical');
        }
      } catch (e) {
        console.warn('Failed to migrate notes', e);
      }
    })();
  }, [applyUpdate, loading]);

  const handleStartCardio = useCallback(() => {
    const prev = stateRef.current ?? createInitialState();
    const ensured = ensureCardioExercise(prev);
    if (ensured.next !== prev) {
      applyUpdate(() => ensured.next, 'critical');
    }
    navigate('cardio', { selectedExerciseId: ensured.id });
  }, [applyUpdate, navigate]);

  const handleAddNote = useCallback(
    async (text: string): Promise<ParsedInputResult> => {
      const trimmed = text.trim();
      if (!trimmed) return { kind: 'note' };

      const current = stateRef.current ?? createInitialState();
      const parsed = parseInputToAction(trimmed, { appState: current });

      if (parsed.kind === 'workout') {
        applyUpdate((prev) => {
          let next = addLogEntry(prev, trimmed);
          next = applyParsedWorkoutAction(next, parsed.payload);
          const startedAtISO = findAddedSetCreatedAtISO(prev, next);
          if (startedAtISO) {
            next = withStartedWorkoutSession(next, startedAtISO);
          }
          return next;
        }, 'critical');
        return { kind: 'workout' };
      }

      await addNote(trimmed, 'home_notes');
      return { kind: 'note' };
    },
    [applyUpdate]
  );

  const handleQuickLogSave = useCallback(
    async (text: string, _options?: { blockId?: string | null }): Promise<QuickLogSaveResult> => {
      const trimmed = text.trim();
      if (!trimmed) return { kind: 'note' };

      const current = stateRef.current ?? createInitialState();
      const parsed = parseInputToAction(trimmed, { appState: current });

      if (parsed.kind === 'workout') {
        applyUpdate((prev) => {
          let next = addLogEntry(prev, trimmed, { pinned: false });
          next = applyParsedWorkoutAction(next, parsed.payload);
          const startedAtISO = findAddedSetCreatedAtISO(prev, next);
          if (startedAtISO) {
            next = withStartedWorkoutSession(next, startedAtISO);
          }
          return next;
        }, 'critical');
        return { kind: 'workout' };
      }

      await addNote(trimmed, 'quicklog');
      return { kind: 'note' };
    },
    [applyUpdate]
  );

  const handleQuickLogSet = useCallback(
    (
      exerciseId: string,
      weight: number,
      reps: number,
      options?: { bodyweight?: boolean; distanceKm?: number | null; durationMin?: number | null }
    ) => {
      applyUpdate((prev) => {
        const exercise = prev.exercises.find((ex) => ex.id === exerciseId);
        const language = prev.language ?? 'en';
        const weightText = language === 'nb' ? String(weight).replace('.', ',') : String(weight);
        const exerciseLabel = exercise ? formatExerciseLabel(exercise) : null;

        let logText: string;
        if (options?.distanceKm != null || options?.durationMin != null) {
          const parts: string[] = [];
          if (options.distanceKm != null) parts.push(`${options.distanceKm} km`);
          if (options.durationMin != null) parts.push(`${options.durationMin} min`);
          logText = exerciseLabel ? `${exerciseLabel} ${parts.join(' / ')}` : parts.join(' / ');
        } else if (options?.bodyweight) {
          logText = exerciseLabel ? `${exerciseLabel} BW x ${reps}` : `BW x ${reps}`;
        } else {
          logText = exerciseLabel ? `${exerciseLabel} ${weightText}x${reps}` : `${weightText}x${reps}`;
        }

        if (options?.distanceKm != null || options?.durationMin != null) {
          const next = addCardioEntry(prev, exerciseId, options.distanceKm ?? null, options.durationMin ?? null);
          return addLogEntry(next, logText);
        }

        const next = addSet(prev, exerciseId, weight, reps, {
          isBodyweight: options?.bodyweight,
        });
        const startedAtISO = findAddedSetCreatedAtISO(prev, next);
        const withSession = startedAtISO ? withStartedWorkoutSession(next, startedAtISO) : next;
        return addLogEntry(withSession, logText);
      }, 'critical');
    },
    [applyUpdate]
  );

  const finishWorkoutSession = useCallback(() => {
    applyUpdate((prev) => {
      const nowISO = new Date().toISOString();
      const todayDateKey = toDateKey(nowISO);
      const current = prev.activeWorkout;

      const currentStartedAtISO = isValidISODate(current?.startedAtISO) ? current.startedAtISO : null;
      const currentStartedDateKey = currentStartedAtISO ? toDateKey(currentStartedAtISO) : null;
      const inferredStartedAtISO = findEarliestSetISOForDate(prev, todayDateKey);
      const startedAtISO =
        currentStartedDateKey === todayDateKey ? currentStartedAtISO : inferredStartedAtISO;
      if (!startedAtISO) return prev;

      const startedAtMs = Date.parse(startedAtISO);
      if (!Number.isFinite(startedAtMs)) return prev;

      const currentFinishedAtISO =
        currentStartedDateKey === todayDateKey && isValidISODate(current?.finishedAtISO)
          ? current.finishedAtISO
          : null;
      const nowMs = Date.now();
      const safeFinishedMs = Math.max(startedAtMs, nowMs);

      if (currentFinishedAtISO) {
        const existingFinishedMs = Date.parse(currentFinishedAtISO);
        if (Number.isFinite(existingFinishedMs) && existingFinishedMs >= safeFinishedMs) {
          return prev;
        }
      }

      return {
        ...prev,
        activeWorkout: {
          startedAtISO,
          finishedAtISO: new Date(safeFinishedMs).toISOString(),
        },
      };
    }, 'critical');
  }, [applyUpdate]);

  const updateProfile = useCallback(
    (next: AppState) => {
      applyUpdate(() => next, 'critical');
    },
    [applyUpdate]
  );

  const updateSettings = useCallback(
    (next: AppState) => {
      applyUpdate(() => next, 'critical');
    },
    [applyUpdate]
  );

  const setThemeMode = useCallback(
    (theme: AppState['theme']) => {
      if (!theme) return;
      applyUpdate((prev) => {
        if (prev.theme === theme) return prev;
        return { ...prev, theme };
      }, 'critical');
    },
    [applyUpdate]
  );

  const reorderExercises = useCallback(
    (blockId: string, orderedExerciseIds: string[]) => {
      applyUpdate((prev) => reorderExercisesInBlock(prev, blockId, orderedExerciseIds), 'debounced');
    },
    [applyUpdate]
  );

  const moveExercise = useCallback(
    (exerciseId: string, blockId: string) => {
      applyUpdate((prev) => setExerciseBlockId(prev, exerciseId, blockId), 'critical');
    },
    [applyUpdate]
  );

  const addExerciseToBlock = useCallback(
    (blockId: string, name: string, metadata?: ExerciseMetadataInput) => {
      applyUpdate((prev) => addExercise(prev, blockId, name, metadata), 'critical');
    },
    [applyUpdate]
  );

  const renameExerciseById = useCallback(
    (exerciseId: string, name: string, metadata?: ExerciseMetadataInput) => {
      applyUpdate((prev) => renameExercise(prev, exerciseId, name, metadata), 'critical');
    },
    [applyUpdate]
  );

  const deleteExerciseById = useCallback(
    (exerciseId: string) => {
      applyUpdate((prev) => deleteExercise(prev, exerciseId), 'critical');
    },
    [applyUpdate]
  );

  const restoreExerciseEntry = useCallback(
    (exercise: Parameters<typeof restoreExercise>[1], sets: Parameters<typeof restoreExercise>[2], index?: number) => {
      applyUpdate((prev) => restoreExercise(prev, exercise, sets, index), 'critical');
    },
    [applyUpdate]
  );

  const addSetToExercise = useCallback(
    (exerciseId: string, weight: number, reps: number, meta?: Parameters<typeof addSet>[4]) => {
      applyUpdate((prev) => {
        const next = addSet(prev, exerciseId, weight, reps, meta);
        const startedAtISO = findAddedSetCreatedAtISO(prev, next);
        return startedAtISO ? withStartedWorkoutSession(next, startedAtISO) : next;
      }, 'critical');
    },
    [applyUpdate]
  );

  const updateSetById = useCallback(
    (setId: string, weight: number, reps: number, meta?: Parameters<typeof updateSet>[4]) => {
      applyUpdate((prev) => updateSet(prev, setId, weight, reps, meta), 'critical');
    },
    [applyUpdate]
  );

  const deleteSetById = useCallback(
    (setId: string) => {
      applyUpdate((prev) => deleteSet(prev, setId), 'critical');
    },
    [applyUpdate]
  );

  const restoreSetEntry = useCallback(
    (setEntry: Parameters<typeof restoreSet>[1]) => {
      applyUpdate((prev) => {
        const next = restoreSet(prev, setEntry);
        const startedAtISO = findAddedSetCreatedAtISO(prev, next);
        return startedAtISO ? withStartedWorkoutSession(next, startedAtISO) : next;
      }, 'critical');
    },
    [applyUpdate]
  );

  const categorizeExercise = useCallback(
    (exerciseId: string, blockId: string) => {
      applyUpdate((prev) => setExerciseBlockId(prev, exerciseId, blockId), 'critical');
    },
    [applyUpdate]
  );

  const mergeExercisesById = useCallback(
    (fromExerciseId: string, intoExerciseId: string) => {
      applyUpdate((prev) => mergeExercises(prev, fromExerciseId, intoExerciseId), 'critical');
    },
    [applyUpdate]
  );

  const saveCardio = useCallback(
    (data: {
      exerciseId?: string | null;
      durationMin: number | null;
      avgHeartRate?: number | null;
      intensity?: 'easy' | 'moderate' | 'hard' | null;
      note?: string | null;
      silentMode?: boolean | null;
    }) => {
      const prev = stateRef.current ?? createInitialState();
      const ensured = ensureCardioExercise(prev);
      const exerciseId = data.exerciseId ?? ensured.id;
      const withExercise = ensured.next;

      applyUpdate(
        () =>
          addCardioEntry(withExercise, exerciseId, null, data.durationMin, {
            avgHeartRate: data.avgHeartRate ?? null,
            intensity: data.intensity ?? null,
            note: data.note ?? null,
            silentMode: data.silentMode ?? null,
          }),
        'critical'
      );
    },
    [applyUpdate]
  );

  return {
    authBusy,
    loginError,
    historyInitialDateKey,
    clearLoginError,

    openHistory,
    openHistoryForDate,

    handleContinueWithoutLogin,
    handleWelcomeComplete,
    startGithubLogin,

    handleStartCardio,
    handleAddNote,
    handleQuickLogSave,
    handleQuickLogSet,
    finishWorkoutSession,

    updateProfile,
    updateSettings,
    setThemeMode,
    reorderExercises,
    moveExercise,
    addExerciseToBlock,
    renameExerciseById,
    deleteExerciseById,
    restoreExerciseEntry,
    addSetToExercise,
    updateSetById,
    deleteSetById,
    restoreSetEntry,
    categorizeExercise,
    saveCardio,
    mergeExercisesById,
  };
}
