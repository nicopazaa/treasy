import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppState, Exercise, TrainingBlock } from '../model/types';
import { DEFAULT_BLOCKS, generateUserId, guessDeviceLanguage } from '../model/initialState';
import { normalizeExerciseName } from '../model/nameNormalize';

const STORAGE_KEY = 'treasy_app_state_v2';

function isSystemExercise(exercise: Exercise): boolean {
  if (!exercise) return false;
  const blockId = String(exercise.blockId ?? '').toLowerCase();
  if (blockId !== 'cardio') return false;

  const id = String(exercise.id ?? '');
  const name = String(exercise.name ?? '').toLowerCase();
  const shortCode = String(exercise.shortCode ?? '').toUpperCase();

  return id.startsWith('cardio_') || shortCode === 'CARDIO' || name === 'cardio';
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
      logs: parsed.logs ?? [],
      notes: parsed.notes ?? [],
      theme: parsed.theme ?? 'dark',
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
