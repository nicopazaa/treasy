import { AppState, Exercise, ExerciseMetadataInput, LogEntry, SetEntry } from './types';
import { formatExerciseLabel } from '../../../shared/utils/exerciseLabel';

function generateId(prefix: string = 'id'): string {
  return `${prefix}_${Math.random().toString(36).substring(2, 10)}_${Date.now().toString(36)}`;
}

function sanitizeLabel(label?: string | null): string | null {
  if (!label) return null;
  const trimmed = label.replace(/[()]/g, '').trim();
  if (!trimmed) return null;
  return trimmed.toUpperCase();
}

function sanitizeMetadata(metadata?: ExerciseMetadataInput): { shortCode: string | null; tags: string[] } {
  const shortCode = sanitizeLabel(metadata?.shortCode);
  const tags = Array.from(
    new Set(
      (metadata?.tags ?? [])
        .map((tag) => sanitizeLabel(tag))
        .filter((tag): tag is string => Boolean(tag))
    )
  );

  return {
    shortCode,
    tags,
  };
}

type SetMeta = {
  isBodyweight?: boolean;
  distanceKm?: number | null;
  durationMin?: number | null;
  setType?: 'weighted' | 'bodyweight' | 'cardio';
};

function resolveSetMeta(weight: number, meta?: SetMeta): SetMeta {
  const isCardio = Number.isFinite(meta?.distanceKm) || Number.isFinite(meta?.durationMin);
  const isBw = meta?.isBodyweight || (!isCardio && weight === 0);
  if (isCardio) {
    return {
      ...meta,
      isBodyweight: false,
      setType: 'cardio',
    };
  }
  if (isBw) {
    return {
      ...meta,
      isBodyweight: true,
      setType: 'bodyweight',
      distanceKm: null,
      durationMin: null,
    };
  }
  return {
    ...meta,
    isBodyweight: false,
    setType: 'weighted',
    distanceKm: null,
    durationMin: null,
  };
}

export function addLogEntry(state: AppState, text: string): AppState {
  const trimmed = text.trim();
  if (!trimmed) return state;

  const entry: LogEntry = {
    id: generateId('log'),
    text: trimmed,
    createdAt: new Date().toISOString(),
  };

  return {
    ...state,
    logs: [...(state.logs ?? []), entry],
  };
}

export function addExercise(
  state: AppState,
  blockId: string,
  name: string,
  metadata?: ExerciseMetadataInput
): AppState {
  const trimmed = name.trim();
  if (!trimmed) return state;
  const meta = sanitizeMetadata(metadata);

  const newExercise: Exercise = {
    id: generateId('ex'),
    blockId,
    name: trimmed,
    shortCode: meta.shortCode ?? undefined,
    tags: meta.tags,
  };

  return {
    ...state,
    exercises: [...state.exercises, newExercise],
  };
}

export function addExerciseWithSets(
  state: AppState,
  blockId: string,
  name: string,
  sets: Array<{ weight: number; reps: number }>,
  metadata?: ExerciseMetadataInput
): AppState {
  const res = addExerciseWithSetsResult(state, blockId, name, sets, metadata);
  return res ? res.nextState : state;
}

export function addExerciseWithSetsResult(
  state: AppState,
  blockId: string,
  name: string,
  sets: Array<{ weight: number; reps: number }>,
  metadata?: ExerciseMetadataInput
): { nextState: AppState; exerciseId: string } | null {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const meta = sanitizeMetadata(metadata);
  const validSets = sets.filter(
    (s) =>
      Number.isFinite(s.weight) &&
      Number.isFinite(s.reps) &&
      s.weight >= 0 &&
      s.reps > 0
  );
  if (validSets.length === 0) return null;

  const exercise: Exercise = {
    id: generateId('ex'),
    blockId,
    name: trimmed,
    shortCode: meta.shortCode ?? undefined,
    tags: meta.tags,
  };
  const createdAt = new Date().toISOString();
  const newSets: SetEntry[] = validSets.map((s) => ({
    id: generateId('set'),
    exerciseId: exercise.id,
    weight: s.weight,
    reps: s.reps,
    createdAt,
  }));

  return {
    nextState: {
      ...state,
      exercises: [...state.exercises, exercise],
      sets: [...state.sets, ...newSets],
    },
    exerciseId: exercise.id,
  };
}

export function renameExercise(
  state: AppState,
  exerciseId: string,
  name: string,
  metadata?: ExerciseMetadataInput
): AppState {
  const trimmed = name.trim();
  if (!trimmed) return state;
  const metaProvided = typeof metadata !== 'undefined';
  const meta = sanitizeMetadata(metadata);

  return {
    ...state,
    exercises: state.exercises.map((ex) => {
      if (ex.id !== exerciseId) return ex;
      const next: Exercise = { ...ex, name: trimmed };
      if (metaProvided) {
        next.shortCode = meta.shortCode ?? undefined;
        next.tags = meta.tags;
      }
      return next;
    }),
  };
}

export function deleteExercise(state: AppState, exerciseId: string): AppState {
  return {
    ...state,
    exercises: state.exercises.filter((ex) => ex.id !== exerciseId),
    sets: state.sets.filter((s) => s.exerciseId !== exerciseId),
  };
}

export function restoreExercise(
  state: AppState,
  exercise: Exercise,
  sets: SetEntry[],
  index?: number
): AppState {
  if (!exercise?.id) return state;
  const withoutExercise = state.exercises.filter((ex) => ex.id !== exercise.id);
  const blockPositions = withoutExercise
    .map((ex, idx) => (ex.blockId === exercise.blockId ? idx : -1))
    .filter((idx) => idx >= 0);
  const baseIndex = blockPositions.length > 0 ? blockPositions[0] : withoutExercise.length;
  const withinBlock =
    typeof index === 'number' && index >= 0 ? Math.min(index, blockPositions.length) : blockPositions.length;
  const insertIndex = baseIndex + withinBlock;
  const nextExercises = withoutExercise.slice();
  nextExercises.splice(insertIndex, 0, exercise);

  const filteredSets = state.sets.filter((s) => s.exerciseId !== exercise.id);
  const validSets = sets.filter((s) => s && s.exerciseId === exercise.id);

  return {
    ...state,
    exercises: nextExercises,
    sets: [...filteredSets, ...validSets],
  };
}

export function reorderExercisesInBlock(
  state: AppState,
  blockId: string,
  orderedExerciseIds: string[]
): AppState {
  const blockExercises = state.exercises.filter((ex) => ex.blockId === blockId);
  if (blockExercises.length === 0) return state;

  const byId = new Map(blockExercises.map((ex) => [ex.id, ex] as const));
  const seen = new Set<string>();

  const normalizedIds: string[] = [];
  for (const id of orderedExerciseIds) {
    if (!byId.has(id)) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    normalizedIds.push(id);
  }

  // Ensure we keep any missing exercises (e.g. stale UI list) in their current order.
  for (const ex of blockExercises) {
    if (!seen.has(ex.id)) normalizedIds.push(ex.id);
  }

  const orderedBlock = normalizedIds.map((id) => byId.get(id)).filter((v): v is Exercise => Boolean(v));
  if (orderedBlock.length !== blockExercises.length) return state;

  let inserted = false;
  const nextExercises: Exercise[] = [];
  for (const ex of state.exercises) {
    if (ex.blockId !== blockId) {
      nextExercises.push(ex);
      continue;
    }

    if (!inserted) {
      nextExercises.push(...orderedBlock);
      inserted = true;
    }
  }

  if (!inserted) {
    nextExercises.push(...orderedBlock);
  }

  return { ...state, exercises: nextExercises };
}

export function setExerciseBlockId(state: AppState, exerciseId: string, blockId: string): AppState {
  return {
    ...state,
    exercises: state.exercises.map((ex) =>
      ex.id === exerciseId ? { ...ex, blockId } : ex
    ),
  };
}

export function addSet(
  state: AppState,
  exerciseId: string,
  weight: number,
  reps: number,
  meta?: SetMeta
): AppState {
  if (!Number.isFinite(weight) || !Number.isFinite(reps) || reps <= 0) {
    return state;
  }

  const resolvedMeta = resolveSetMeta(weight, meta);

  const newSet: SetEntry = {
    id: generateId('set'),
    exerciseId,
    weight,
    reps,
    createdAt: new Date().toISOString(),
    isBodyweight: resolvedMeta.isBodyweight,
    distanceKm: resolvedMeta.distanceKm ?? null,
    durationMin: resolvedMeta.durationMin ?? null,
    setType: resolvedMeta.setType,
  };

  return {
    ...state,
    sets: [...state.sets, newSet],
  };
}

export function addSetsForExercise(
  state: AppState,
  exerciseId: string,
  sets: Array<{ weight: number; reps: number }>,
  meta?: SetMeta
): AppState {
  const validSets = sets.filter(
    (s) =>
      Number.isFinite(s.weight) &&
      Number.isFinite(s.reps) &&
      s.weight >= 0 &&
      s.reps > 0
  );
  if (validSets.length === 0) return state;

  const createdAt = new Date().toISOString();
  const resolvedMeta = resolveSetMeta(validSets[0].weight, meta);
  const newSets: SetEntry[] = validSets.map((s) => ({
    id: generateId('set'),
    exerciseId,
    weight: s.weight,
    reps: s.reps,
    createdAt,
    isBodyweight: resolvedMeta.isBodyweight,
    distanceKm: resolvedMeta.distanceKm ?? null,
    durationMin: resolvedMeta.durationMin ?? null,
    setType: resolvedMeta.setType,
  }));

  return {
    ...state,
    sets: [...state.sets, ...newSets],
  };
}

export function updateSet(state: AppState, setId: string, weight: number, reps: number): AppState {
  if (!Number.isFinite(weight) || !Number.isFinite(reps) || weight < 0 || reps <= 0) {
    return state;
  }

  return {
    ...state,
    sets: state.sets.map((s) =>
      s.id === setId ? { ...s, weight, reps } : s
    ),
  };
}

export function deleteSet(state: AppState, setId: string): AppState {
  return {
    ...state,
    sets: state.sets.filter((s) => s.id !== setId),
  };
}

export function restoreSet(state: AppState, set: SetEntry): AppState {
  if (!set?.id) return state;
  const nextSets = state.sets.filter((s) => s.id !== set.id);
  nextSets.push(set);
  return { ...state, sets: nextSets };
}

export function getSetsForExercise(state: AppState, exerciseId: string): SetEntry[] {
  return state.sets
    .filter((s) => s.exerciseId === exerciseId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function getLastSetForExercise(state: AppState, exerciseId: string): SetEntry | null {
  const sets = getSetsForExercise(state, exerciseId);
  return sets.length > 0 ? sets[0] : null;
}

function toDateKey(iso: string): string {
  return iso.slice(0, 10);
}

export function getWorkoutDates(state: AppState): string[] {
  const keys = new Set<string>();
  for (const s of state.sets) {
    keys.add(toDateKey(s.createdAt));
  }
  return Array.from(keys).sort((a, b) => (a < b ? 1 : -1));
}

export interface DailySetView {
  id: string;
  exerciseName: string;
  exerciseLabel: string;
  blockName?: string;
  blockId?: string;
  weight: number;
  reps: number;
  time: string;
  isBodyweight?: boolean;
  distanceKm?: number | null;
  durationMin?: number | null;
  setType?: 'weighted' | 'bodyweight' | 'cardio';
}

export function getDailyWorkout(state: AppState, dateKey: string): DailySetView[] {
  const results: DailySetView[] = [];

  for (const s of state.sets) {
    if (toDateKey(s.createdAt) !== dateKey) continue;

    const exercise = state.exercises.find((e) => e.id === s.exerciseId);
    const block = exercise ? state.blocks.find((b) => b.id === exercise.blockId) : undefined;

    const dt = new Date(s.createdAt);
    const time = dt.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' });

    results.push({
      id: s.id,
      exerciseName: exercise ? exercise.name : 'Ukjent øvelse',
      exerciseLabel: exercise ? formatExerciseLabel(exercise) : 'Ukjent øvelse',
      blockName: block?.name,
      blockId: block?.id,
      weight: s.weight,
      reps: s.reps,
      time,
      isBodyweight: s.isBodyweight,
      distanceKm: s.distanceKm ?? null,
      durationMin: s.durationMin ?? null,
      setType: s.setType,
    });
  }

  results.sort((a, b) => (a.time > b.time ? 1 : -1));
  return results;
}

export interface GroupedDailySetView {
  id: string;
  exerciseName: string;
  exerciseLabel: string;
  blockName?: string;
  blockId?: string;
  time: string;
  sets: Array<{
    weight: number;
    reps: number;
    isBodyweight?: boolean;
    distanceKm?: number | null;
    durationMin?: number | null;
    setType?: 'weighted' | 'bodyweight' | 'cardio';
  }>;
}

export function groupDailySets(sets: DailySetView[]): GroupedDailySetView[] {
  const map = new Map<string, GroupedDailySetView>();

  for (const set of sets) {
    const key = `${set.exerciseLabel}__${set.blockId ?? set.blockName ?? ''}`;
    const existing = map.get(key);

    if (!existing) {
      map.set(key, {
        id: set.id,
        exerciseName: set.exerciseName,
        exerciseLabel: set.exerciseLabel,
      blockName: set.blockName,
      blockId: set.blockId,
      time: set.time,
      sets: [
        {
          weight: set.weight,
          reps: set.reps,
          isBodyweight: set.isBodyweight,
          distanceKm: set.distanceKm,
          durationMin: set.durationMin,
          setType: set.setType,
        },
      ],
    });
    continue;
  }

    existing.sets.push({
      weight: set.weight,
      reps: set.reps,
      isBodyweight: set.isBodyweight,
      distanceKm: set.distanceKm,
      durationMin: set.durationMin,
      setType: set.setType,
    });
    existing.time = set.time;
  }

  return Array.from(map.values());
}
