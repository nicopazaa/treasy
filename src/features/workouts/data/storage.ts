import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppState, Exercise, TrainingBlock, NoteEntry } from '../../../domain/workouts/types';
import { DEFAULT_BLOCKS, generateUserId, guessDeviceLanguage } from '../model/initialState';
import { normalizeExerciseName } from '../../../domain/workouts/nameNormalize';
import { SYSTEM_EXERCISE_IDS } from '../../../shared/systemEntities';
import { normalizeThemeMode } from '../../../shared/theme/themes';

const STORAGE_KEY = 'treasy_app_state_v2';

function isSystemExercise(exercise: Exercise): boolean {
  if (!exercise) return false;
  const blockId = String(exercise.blockId ?? '').toLowerCase();
  if (blockId !== SYSTEM_EXERCISE_IDS.CARDIO) return false;

  const id = String(exercise.id ?? '');
  const name = String(exercise.name ?? '').toLowerCase();
  const shortCode = String(exercise.shortCode ?? '').toUpperCase();

  return id.startsWith('cardio_') || shortCode === 'CARDIO' || name === SYSTEM_EXERCISE_IDS.CARDIO;
}

function normalizeExercises(exercises: AppState['exercises'] | undefined): Exercise[] {
  const list = Array.isArray(exercises) ? exercises : [];
  return list.map((ex) => {
    const isCustom = typeof ex.isCustom === 'boolean' ? ex.isCustom : !isSystemExercise(ex);

    // Migration / normalization (deterministic + idempotent):
    // - `canonicalName`: computed from the current `name` if missing.
    // - `aliases`: default to empty array if missing.
    const canonicalName =
      typeof ex.canonicalName === 'string' && ex.canonicalName.trim()
        ? ex.canonicalName
        : normalizeExerciseName(ex.name);

    const aliases = Array.isArray(ex.aliases) ? ex.aliases.filter((a): a is string => typeof a === 'string') : [];

    return { ...ex, isCustom, canonicalName, aliases };
  });
}

function isNoteSource(value: unknown): value is NoteEntry['source'] {
  return value === 'home_notes' || value === 'quicklog' || value === 'other';
}

function normalizeNotes(notes: AppState['notes'] | undefined): NoteEntry[] {
  const list = Array.isArray(notes) ? notes : [];
  return list
    .map((note) => {
      const id = typeof note?.id === 'string' ? note.id.trim() : '';
      const text = typeof note?.text === 'string' ? note.text.trim() : '';
      if (!id || !text) return null;

      const createdAt = typeof note?.createdAt === 'string' ? note.createdAt : new Date().toISOString();
      const source = isNoteSource(note?.source) ? note.source : 'other';

      return { id, text, createdAt, source };
    })
    .filter((note): note is NoteEntry => Boolean(note));
}

function normalizeISO(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const ms = Date.parse(trimmed);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}

function normalizeActiveWorkout(
  activeWorkout: AppState['activeWorkout'] | undefined
): AppState['activeWorkout'] {
  if (!activeWorkout || typeof activeWorkout !== 'object') return null;
  const startedAtISO = normalizeISO((activeWorkout as { startedAtISO?: unknown }).startedAtISO);
  if (!startedAtISO) return null;

  const finishedAtISO = normalizeISO((activeWorkout as { finishedAtISO?: unknown }).finishedAtISO);
  if (!finishedAtISO) {
    return { startedAtISO };
  }

  const startedAtMs = Date.parse(startedAtISO);
  const finishedAtMs = Date.parse(finishedAtISO);
  if (!Number.isFinite(startedAtMs) || !Number.isFinite(finishedAtMs) || finishedAtMs < startedAtMs) {
    return { startedAtISO };
  }

  return { startedAtISO, finishedAtISO };
}

export async function loadAppState(): Promise<AppState | null> {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEY);
    if (!json) {
      return null;
    }

    const parsed = JSON.parse(json) as AppState;

    // SA,rg for at nye standardblokker (Armer/Core) legges til
    const baseBlocks = Array.isArray(parsed.blocks) && parsed.blocks.length > 0 ? parsed.blocks : DEFAULT_BLOCKS;
    const existingIds = new Set(baseBlocks.map((b) => b.id));
    const mergedBlocks: TrainingBlock[] = [
      ...baseBlocks,
      ...DEFAULT_BLOCKS.filter((b) => !existingIds.has(b.id)),
    ];

    return {
      ...parsed,
      userId: parsed.userId ?? generateUserId(),
      onboarded:
        parsed.onboarded ??
        Boolean(parsed.userEmail || parsed.exercises?.length || parsed.sets?.length),
      authProvider: parsed.authProvider ?? (parsed.userEmail ? 'email' : 'guest'),
      language: parsed.language ?? guessDeviceLanguage(),
      massUnit: parsed.massUnit ?? 'kg',
      blocks: mergedBlocks,
      exercises: normalizeExercises(parsed.exercises),
      sets: Array.isArray(parsed.sets) ? parsed.sets : [],
      cardioEntries: Array.isArray(parsed.cardioEntries) ? parsed.cardioEntries : [],
      activeWorkout: normalizeActiveWorkout(parsed.activeWorkout),
      logs: parsed.logs ?? [],
      notes: normalizeNotes(parsed.notes),
      theme: normalizeThemeMode(parsed.theme),
    };
  } catch (e) {
    console.warn('Failed to load app state', e);
    return null;
  }
}

export async function saveAppState(state: AppState): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Failed to save app state', e);
  }
}
