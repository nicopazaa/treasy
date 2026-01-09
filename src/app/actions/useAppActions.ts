import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import type { AppState, ExerciseMetadataInput } from '../../features/workouts/model/types';
import {
  addCardioEntry,
  addExercise,
  addExerciseWithSetsResult,
  addLogEntry,
  addNoteEntry,
  addSet,
  addSetsForExercise,
  deleteExercise,
  deleteSet,
  findExerciseByNameOrAlias,
  mergeExercises,
  renameExercise,
  reorderExercisesInBlock,
  restoreExercise,
  restoreSet,
  setExerciseBlockId,
  updateSet,
  createInitialState,
} from '../../features/workouts';
import { findExerciseFuzzy, inferBlockIdFromExercise } from '../../features/quicklog';
import { applyParsedChunks } from '../../features/parsing/applyParsedChunks';
import { parseTrainingText } from '../../features/parsing/parsePipeline';
import { t } from '../../shared/i18n/i18n';
import { formatExerciseLabel } from '../../shared/utils/exerciseLabel';
import { normalizeExerciseName } from '../../features/workouts/model/nameNormalize';
import type { NavState, ScreenName } from '../navigation/types';
import type { DerivedCache } from '../state/derivedCache';
import type { AppStatePersister } from '../state/persist';

function splitNameAndCodes(raw: string): { name: string; metadata: ExerciseMetadataInput } {
  const matches = Array.from(raw.matchAll(/\(([^)]+)\)/g))
    .map((m) => (m[1] ?? '').trim())
    .filter(Boolean);
  const name = raw.replace(/\s*\([^)]+\)\s*/g, ' ').replace(/\s+/g, ' ').trim() || raw.trim();
  const [shortCode, ...tags] = matches;
  return {
    name,
    metadata: {
      shortCode: shortCode ?? null,
      tags,
    },
  };
}

function applyTrainingTextToState(state: AppState, text: string): AppState {
  const language = state.language ?? 'en';
  const defaultUnit = state.massUnit ?? 'kg';
  const chunks = parseTrainingText(text, { language, defaultUnit });
  if (chunks.length === 0) return state;
  const applied = applyParsedChunks(state, chunks, { language });
  return applied.next;
}

function ensureCardioExercise(state: AppState): { next: AppState; id: string } {
  const existing = state.exercises.find((ex) => ex.blockId === 'cardio');
  if (existing) return { next: state, id: existing.id };

  const newId = `cardio_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
  const exercise = {
    id: newId,
    blockId: 'cardio',
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

type UpdateMode = 'critical' | 'debounced' | 'none';

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
  handleAddNote: (text: string) => void;
  handleQuickLogSave: (text: string, options?: { blockId?: string | null }) => {
    newExerciseId?: string;
    newExerciseName?: string;
  };
  handleQuickLogSet: (
    exerciseId: string,
    weight: number,
    reps: number,
    options?: { bodyweight?: boolean; distanceKm?: number | null; durationMin?: number | null }
  ) => void;

  // Screen passthrough updates (behavior-preserving)
  updateProfile: (next: AppState) => void;
  updateSettings: (next: AppState) => void;
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

    const state = `st_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
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

  const handleStartCardio = useCallback(() => {
    const prev = stateRef.current ?? createInitialState();
    const ensured = ensureCardioExercise(prev);
    if (ensured.next !== prev) {
      applyUpdate(() => ensured.next, 'critical');
    }
    navigate('cardio', { selectedExerciseId: ensured.id });
  }, [applyUpdate, navigate]);

  const handleAddNote = useCallback(
    (text: string) => {
      applyUpdate((prev) => {
        let next = addNoteEntry(prev, text);
        next = addLogEntry(next, text);
        next = applyTrainingTextToState(next, text);
        return next;
      }, 'critical');
    },
    [applyUpdate]
  );

  const handleQuickLogSave = useCallback(
    (text: string, options?: { blockId?: string | null }) => {
      let created: { newExerciseId?: string; newExerciseName?: string } = {};

      applyUpdate((prev) => {
        const blockHint = options?.blockId ?? null;
        let next = addLogEntry(prev, text, { pinned: false });
        const language = next.language ?? 'en';
        const defaultUnit = next.massUnit ?? 'kg';
        const chunks = parseTrainingText(text, { language, defaultUnit });
        const first = chunks[0] ?? null;
        if (!first) return next;

        const sets = first.sets.map((s) => ({ weight: s.weight, reps: s.reps }));
        const { name: parsedName, metadata } = splitNameAndCodes(first.rawExerciseName);
        const lookupName = parsedName || first.rawExerciseName;

        const exact =
          findExerciseByNameOrAlias(next, first.rawExerciseName) ??
          (lookupName !== first.rawExerciseName ? findExerciseByNameOrAlias(next, lookupName) : null);

        const existing =
          exact ??
          findExerciseFuzzy(next, first.rawExerciseName) ??
          (lookupName !== first.rawExerciseName ? findExerciseFuzzy(next, lookupName) : null);

        if (existing) {
          const allBodyweight = first.sets.every((s) => s.isBodyweight === true || s.weight === 0);
          next = addSetsForExercise(next, existing.id, sets, allBodyweight ? { isBodyweight: true } : undefined);
          return next;
        }

        const inferredBlock =
          inferBlockIdFromExercise(first.rawExerciseName) ??
          (lookupName !== first.rawExerciseName ? inferBlockIdFromExercise(lookupName) : null);
        const allowedBlocks = new Set(next.blocks.map((b) => b.id));
        const targetBlock =
          (blockHint && allowedBlocks.has(blockHint) ? blockHint : null) ??
          (inferredBlock && allowedBlocks.has(inferredBlock) ? inferredBlock : null) ??
          next.blocks[0]?.id ??
          'chest';

        const createdResult = addExerciseWithSetsResult(next, targetBlock, lookupName, sets, metadata);
        if (createdResult) {
          next = createdResult.nextState;
          const createdExercise = next.exercises.find((ex) => ex.id === createdResult.exerciseId) ?? null;
          const label = createdExercise ? formatExerciseLabel(createdExercise) : lookupName;
          created = { newExerciseId: createdResult.exerciseId, newExerciseName: label };
        }

        return next;
      }, 'critical');

      return created;
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
        return addLogEntry(next, logText);
      }, 'critical');
    },
    [applyUpdate]
  );

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
      applyUpdate((prev) => addSet(prev, exerciseId, weight, reps, meta), 'critical');
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
      applyUpdate((prev) => restoreSet(prev, setEntry), 'critical');
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

    updateProfile,
    updateSettings,
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
