import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  AppState,
  CardioEntry,
  Exercise,
  LogEntry,
  NoteEntry,
  SetEntry,
  TrainingBlock,
} from '../../../domain/workouts/types';
import { DEFAULT_BLOCKS, generateUserId, guessDeviceLanguage } from '../model/initialState';
import { normalizeExerciseName } from '../../../domain/workouts/nameNormalize';
import { SYSTEM_EXERCISE_IDS } from '../../../shared/systemEntities';
import { normalizeThemeMode } from '../../../shared/theme/themes';
import { withSyncDefaults } from '../../../shared/utils/syncMeta';
import { normalizeSyncState } from '../../../shared/utils/syncQueue';

const LEGACY_STORAGE_KEY = 'treasy_app_state_v2';
const ENTITY_STORAGE_KEYS = {
  meta: 'treasy_app_meta_v1',
  blocks: 'treasy_app_blocks_v1',
  exercises: 'treasy_app_exercises_v1',
  sets: 'treasy_app_sets_v1',
  cardioEntries: 'treasy_app_cardio_entries_v1',
  logs: 'treasy_app_logs_v1',
  notes: 'treasy_app_notes_v1',
  sync: 'treasy_app_sync_v1',
} as const;

type PersistedMeta = Pick<
  AppState,
  | 'userId'
  | 'onboarded'
  | 'authProvider'
  | 'userEmail'
  | 'nickname'
  | 'heightCm'
  | 'weightKg'
  | 'theme'
  | 'language'
  | 'massUnit'
  | 'activeWorkout'
>;

function isSystemExercise(exercise: Exercise): boolean {
  if (!exercise) return false;
  const blockId = String(exercise.blockId ?? '').toLowerCase();
  if (blockId !== SYSTEM_EXERCISE_IDS.CARDIO) return false;

  const id = String(exercise.id ?? '');
  const name = String(exercise.name ?? '').toLowerCase();
  const shortCode = String(exercise.shortCode ?? '').toUpperCase();

  return id.startsWith('cardio_') || shortCode === 'CARDIO' || name === SYSTEM_EXERCISE_IDS.CARDIO;
}

function parseJson(value: string | null): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function parseArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function parseObject<T extends object>(value: unknown): Partial<T> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Partial<T>;
}

function normalizeExercises(exercises: AppState['exercises'] | undefined): Exercise[] {
  const list = Array.isArray(exercises) ? exercises : [];
  const results: Exercise[] = [];

  for (const ex of list) {
    const isCustom = typeof ex.isCustom === 'boolean' ? ex.isCustom : !isSystemExercise(ex);
    const canonicalName =
      typeof ex.canonicalName === 'string' && ex.canonicalName.trim()
        ? ex.canonicalName
        : normalizeExerciseName(ex.name);
    const aliases = Array.isArray(ex.aliases)
      ? ex.aliases.filter((alias): alias is string => typeof alias === 'string')
      : [];

    const normalized = withSyncDefaults({ ...ex, isCustom, canonicalName, aliases }, 'ex') as Exercise;
    if (normalized.deletedAt) continue;
    results.push(normalized);
  }

  return results;
}

function isNoteSource(value: unknown): value is NoteEntry['source'] {
  return value === 'home_notes' || value === 'quicklog' || value === 'other';
}

function normalizeNotes(notes: AppState['notes'] | undefined): NoteEntry[] {
  const list = Array.isArray(notes) ? notes : [];
  const results: NoteEntry[] = [];

  for (const note of list) {
    const id = typeof note?.id === 'string' ? note.id.trim() : '';
    const text = typeof note?.text === 'string' ? note.text.trim() : '';
    if (!id || !text) continue;

    const createdAt = typeof note?.createdAt === 'string' ? note.createdAt : new Date().toISOString();
    const source = isNoteSource(note?.source) ? note.source : 'other';
    const normalized = withSyncDefaults(
      {
        ...note,
        id,
        text,
        createdAt,
        source,
      },
      'note',
      createdAt
    ) as NoteEntry;
    if (normalized.deletedAt) continue;
    results.push(normalized);
  }

  return results;
}

function normalizeLogs(logs: AppState['logs'] | undefined): LogEntry[] {
  const list = Array.isArray(logs) ? logs : [];
  const results: LogEntry[] = [];

  for (const entry of list) {
    const id = typeof entry?.id === 'string' ? entry.id.trim() : '';
    const text = typeof entry?.text === 'string' ? entry.text.trim() : '';
    if (!id || !text) continue;

    const createdAt = typeof entry?.createdAt === 'string' ? entry.createdAt : new Date().toISOString();
    const normalized = withSyncDefaults(
      {
        ...entry,
        id,
        text,
        createdAt,
        pinned: entry?.pinned === true ? true : undefined,
      },
      'log',
      createdAt
    ) as LogEntry;
    if (normalized.deletedAt) continue;
    results.push(normalized);
  }

  return results;
}

function normalizeSets(sets: AppState['sets'] | undefined): SetEntry[] {
  const list = Array.isArray(sets) ? sets : [];
  const results: SetEntry[] = [];

  for (const set of list) {
    const id = typeof set?.id === 'string' ? set.id.trim() : '';
    const exerciseId = typeof set?.exerciseId === 'string' ? set.exerciseId.trim() : '';
    if (!id || !exerciseId) continue;

    const weight = Number(set?.weight);
    const reps = Number(set?.reps);
    if (!Number.isFinite(weight) || !Number.isFinite(reps) || reps <= 0) continue;

    const createdAt = typeof set?.createdAt === 'string' ? set.createdAt : new Date().toISOString();
    const normalized = withSyncDefaults(
      {
        ...set,
        id,
        exerciseId,
        weight,
        reps,
        createdAt,
        distanceKm: set?.distanceKm ?? null,
        durationMin: set?.durationMin ?? null,
        pauseSec: set?.pauseSec ?? null,
      },
      'set',
      createdAt
    ) as SetEntry;
    if (normalized.deletedAt) continue;
    results.push(normalized);
  }

  return results;
}

function normalizeCardioEntries(entries: AppState['cardioEntries'] | undefined): CardioEntry[] {
  const list = Array.isArray(entries) ? entries : [];
  const results: CardioEntry[] = [];

  for (const entry of list) {
    const id = typeof entry?.id === 'string' ? entry.id.trim() : '';
    const exerciseId = typeof entry?.exerciseId === 'string' ? entry.exerciseId.trim() : '';
    if (!id || !exerciseId) continue;

    const distanceKm = Number.isFinite(entry?.distanceKm) ? entry.distanceKm : null;
    const durationMin = Number.isFinite(entry?.durationMin) ? entry.durationMin : null;
    if (distanceKm == null && durationMin == null) continue;

    const createdAt = typeof entry?.createdAt === 'string' ? entry.createdAt : new Date().toISOString();
    const normalized = withSyncDefaults(
      {
        ...entry,
        id,
        exerciseId,
        distanceKm,
        durationMin,
        createdAt,
      },
      'cardio',
      createdAt
    ) as CardioEntry;
    if (normalized.deletedAt) continue;
    results.push(normalized);
  }

  return results;
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

function normalizeLoadedState(raw: AppState): AppState {
  const baseBlocks = Array.isArray(raw.blocks) && raw.blocks.length > 0 ? raw.blocks : DEFAULT_BLOCKS;
  const existingIds = new Set(baseBlocks.map((block) => block.id));
  const mergedBlocks: TrainingBlock[] = [
    ...baseBlocks,
    ...DEFAULT_BLOCKS.filter((block) => !existingIds.has(block.id)),
  ];

  return {
    ...raw,
    userId: raw.userId ?? generateUserId(),
    onboarded: raw.onboarded ?? Boolean(raw.userEmail || raw.exercises?.length || raw.sets?.length),
    authProvider: raw.authProvider ?? (raw.userEmail ? 'email' : 'guest'),
    userEmail: raw.userEmail ?? null,
    language: raw.language ?? guessDeviceLanguage(),
    massUnit: raw.massUnit ?? 'kg',
    blocks: mergedBlocks,
    exercises: normalizeExercises(raw.exercises),
    sets: normalizeSets(raw.sets),
    cardioEntries: normalizeCardioEntries(raw.cardioEntries),
    activeWorkout: normalizeActiveWorkout(raw.activeWorkout),
    logs: normalizeLogs(raw.logs),
    notes: normalizeNotes(raw.notes),
    sync: normalizeSyncState(raw.sync),
    theme: normalizeThemeMode(raw.theme),
  };
}

async function loadEntityState(): Promise<AppState | null> {
  const allKeys = Object.values(ENTITY_STORAGE_KEYS);
  const pairs = await AsyncStorage.multiGet(allKeys);
  const byKey = new Map<string, string | null>(pairs);
  const hasAnyPayload = pairs.some(([, value]) => value != null);
  if (!hasAnyPayload) return null;

  const meta = parseObject<PersistedMeta>(parseJson(byKey.get(ENTITY_STORAGE_KEYS.meta) ?? null));
  const blocks = parseArray<TrainingBlock>(parseJson(byKey.get(ENTITY_STORAGE_KEYS.blocks) ?? null));
  const exercises = parseArray<Exercise>(parseJson(byKey.get(ENTITY_STORAGE_KEYS.exercises) ?? null));
  const sets = parseArray<SetEntry>(parseJson(byKey.get(ENTITY_STORAGE_KEYS.sets) ?? null));
  const cardioEntries = parseArray<CardioEntry>(parseJson(byKey.get(ENTITY_STORAGE_KEYS.cardioEntries) ?? null));
  const logs = parseArray<LogEntry>(parseJson(byKey.get(ENTITY_STORAGE_KEYS.logs) ?? null));
  const notes = parseArray<NoteEntry>(parseJson(byKey.get(ENTITY_STORAGE_KEYS.notes) ?? null));
  const sync = parseJson(byKey.get(ENTITY_STORAGE_KEYS.sync) ?? null);

  return {
    userId: meta.userId,
    onboarded: meta.onboarded,
    authProvider: meta.authProvider,
    userEmail: meta.userEmail ?? null,
    nickname: meta.nickname,
    heightCm: meta.heightCm,
    weightKg: meta.weightKg,
    theme: meta.theme,
    language: meta.language,
    massUnit: meta.massUnit,
    activeWorkout: meta.activeWorkout,
    blocks,
    exercises,
    sets,
    cardioEntries,
    logs,
    notes,
    sync: normalizeSyncState(sync),
  };
}

async function loadLegacyState(): Promise<AppState | null> {
  const json = await AsyncStorage.getItem(LEGACY_STORAGE_KEY);
  if (!json) return null;
  return JSON.parse(json) as AppState;
}

function toPersistedMeta(state: AppState): PersistedMeta {
  return {
    userId: state.userId,
    onboarded: state.onboarded,
    authProvider: state.authProvider,
    userEmail: state.userEmail,
    nickname: state.nickname,
    heightCm: state.heightCm,
    weightKg: state.weightKg,
    theme: state.theme,
    language: state.language,
    massUnit: state.massUnit,
    activeWorkout: state.activeWorkout,
  };
}

export async function loadAppState(): Promise<AppState | null> {
  try {
    const entityState = await loadEntityState();
    if (entityState) {
      return normalizeLoadedState(entityState);
    }

    const legacyState = await loadLegacyState();
    if (!legacyState) {
      return null;
    }

    const normalized = normalizeLoadedState(legacyState);
    await saveAppState(normalized);
    return normalized;
  } catch (e) {
    console.warn('Failed to load app state', e);
    return null;
  }
}

export async function saveAppState(state: AppState): Promise<void> {
  try {
    const normalized = normalizeLoadedState(state);
    await AsyncStorage.multiSet([
      [ENTITY_STORAGE_KEYS.meta, JSON.stringify(toPersistedMeta(normalized))],
      [ENTITY_STORAGE_KEYS.blocks, JSON.stringify(normalized.blocks)],
      [ENTITY_STORAGE_KEYS.exercises, JSON.stringify(normalized.exercises)],
      [ENTITY_STORAGE_KEYS.sets, JSON.stringify(normalized.sets)],
      [ENTITY_STORAGE_KEYS.cardioEntries, JSON.stringify(normalized.cardioEntries)],
      [ENTITY_STORAGE_KEYS.logs, JSON.stringify(normalized.logs ?? [])],
      [ENTITY_STORAGE_KEYS.notes, JSON.stringify(normalized.notes ?? [])],
      [ENTITY_STORAGE_KEYS.sync, JSON.stringify(normalized.sync ?? normalizeSyncState(undefined))],
    ]);
  } catch (e) {
    console.warn('Failed to save app state', e);
  }
}
