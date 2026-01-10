import { AppState, Exercise, ExerciseMetadataInput, LogEntry, SetEntry, CardioEntry, NoteEntry } from './types';
import { formatExerciseLabel } from '../../shared/utils/exerciseLabel';
import { MAX_EXERCISE_ALIASES, MAX_MERGED_EXERCISE_ALIASES } from '../../shared/constants';
import { normalizeExerciseName } from './nameNormalize';
import { now } from '../../shared/time';

// IMPORTANT:
// This module must remain pure and deterministic.
// Never mutate AppState directly; always return new objects/arrays.
function generateId(prefix: string = 'id'): string {
  return `${prefix}_${Math.random().toString(36).substring(2, 10)}_${now().toString(36)}`;
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
  pauseSec?: number | null;
  setType?: 'weighted' | 'bodyweight' | 'cardio';
};

function resolveSetMeta(weight: number, meta?: SetMeta): SetMeta {
  const isCardio =
    Number.isFinite(meta?.distanceKm) ||
    Number.isFinite(meta?.durationMin) ||
    Number.isFinite(meta?.pauseSec);
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
      pauseSec: null,
    };
  }
  return {
    ...meta,
    isBodyweight: false,
    setType: 'weighted',
    distanceKm: null,
    durationMin: null,
    pauseSec: null,
  };
}

export function addLogEntry(state: AppState, text: string, options?: { pinned?: boolean }): AppState {
  const trimmed = text.trim();
  if (!trimmed) return state;

  const entry: LogEntry = {
    id: generateId('log'),
    text: trimmed,
    createdAt: new Date().toISOString(),
    pinned: options?.pinned === true,
  };

  return {
    ...state,
    logs: [...(state.logs ?? []), entry],
  };
}

export function addNoteEntry(state: AppState, text: string): AppState {
  const trimmed = text.trim();
  if (!trimmed) return state;

  const entry: NoteEntry = {
    id: generateId('note'),
    text: trimmed,
    createdAt: new Date().toISOString(),
  };

  return {
    ...state,
    notes: [...(state.notes ?? []), entry],
  };
}

export function addCardioEntry(
  state: AppState,
  exerciseId: string,
  distanceKm: number | null,
  durationMin: number | null,
  extras?: {
    avgHeartRate?: number | null;
    intensity?: 'easy' | 'moderate' | 'hard' | null;
    note?: string | null;
    silentMode?: boolean | null;
  }
): AppState {
  const dist = distanceKm != null && Number.isFinite(distanceKm) && distanceKm > 0 ? distanceKm : null;
  const dur = durationMin != null && Number.isFinite(durationMin) && durationMin > 0 ? durationMin : null;
  if (dist == null && dur == null) return state;

  const entry: CardioEntry = {
    id: generateId('cardio'),
    exerciseId,
    distanceKm: dist,
    durationMin: dur,
    avgHeartRate: extras?.avgHeartRate ?? null,
    intensity: extras?.intensity ?? null,
    note: extras?.note ?? null,
    silentMode: extras?.silentMode ?? null,
    createdAt: new Date().toISOString(),
  };

  return {
    ...state,
    cardioEntries: [...(state.cardioEntries ?? []), entry],
  };
}

export function getCardioEntries(state: AppState, exerciseId?: string): CardioEntry[] {
  const all = state.cardioEntries ?? [];
  if (!exerciseId) return all;
  return all.filter((c) => c.exerciseId === exerciseId);
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
    isCustom: true,
    aliases: [],
    canonicalName: normalizeExerciseName(trimmed),
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
    isCustom: true,
    aliases: [],
    canonicalName: normalizeExerciseName(trimmed),
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
      const next: Exercise = {
        ...ex,
        name: trimmed,
        canonicalName: normalizeExerciseName(trimmed),
        aliases: Array.isArray(ex.aliases) ? ex.aliases : [],
      };
      if (metaProvided) {
        next.shortCode = meta.shortCode ?? undefined;
        next.tags = meta.tags;
      }
      return next;
    }),
  };
}

export function addExerciseAlias(state: AppState, exerciseId: string, aliasName: string): AppState {
  const raw = String(aliasName ?? '').trim();
  const normalized = normalizeExerciseName(raw);
  if (!normalized) return state;

  return {
    ...state,
    exercises: state.exercises.map((ex) => {
      if (ex.id !== exerciseId) return ex;

      const existingAliases = Array.isArray(ex.aliases) ? ex.aliases : [];
      if (existingAliases.length >= MAX_EXERCISE_ALIASES) return ex;

      const canonical = normalizeExerciseName(ex.canonicalName ?? ex.name);
      const nameNorm = normalizeExerciseName(ex.name);
      const existingNorm = new Set<string>([canonical, nameNorm, ...existingAliases.map(normalizeExerciseName)]);
      if (existingNorm.has(normalized)) return ex;

      return {
        ...ex,
        aliases: [...existingAliases, raw],
        canonicalName: typeof ex.canonicalName === 'string' && ex.canonicalName ? ex.canonicalName : canonical,
      };
    }),
  };
}

export function findExerciseByNameOrAlias(state: AppState, name: string): Exercise | null {
  const target = normalizeExerciseName(name);
  if (!target) return null;

  // Deterministic ranking:
  // 0) canonicalName match
  // 1) alias match
  // 2) normalized exercise.name match (fallback for older/partial data)
  let best: { ex: Exercise; rank: 0 | 1 | 2 } | null = null;

  for (const ex of state.exercises) {
    const canonical = normalizeExerciseName(ex.canonicalName ?? ex.name);
    if (canonical && canonical === target) {
      const candidate = { ex, rank: 0 as const };
      if (!best || candidate.rank < best.rank || (candidate.rank === best.rank && ex.id < best.ex.id)) {
        best = candidate;
      }
      continue;
    }

    const aliases = Array.isArray(ex.aliases) ? ex.aliases : [];
    const aliasMatch = aliases.some((a) => normalizeExerciseName(a) === target);
    if (aliasMatch) {
      const candidate = { ex, rank: 1 as const };
      if (!best || candidate.rank < best.rank || (candidate.rank === best.rank && ex.id < best.ex.id)) {
        best = candidate;
      }
      continue;
    }

    const nameNorm = normalizeExerciseName(ex.name);
    if (nameNorm && nameNorm === target) {
      const candidate = { ex, rank: 2 as const };
      if (!best || candidate.rank < best.rank || (candidate.rank === best.rank && ex.id < best.ex.id)) {
        best = candidate;
      }
    }
  }

  return best?.ex ?? null;
}

function mergeAliasesStable(base: string[], additions: string[], max: number): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  const push = (raw: string) => {
    const trimmed = String(raw ?? '').trim();
    if (!trimmed) return;
    const norm = normalizeExerciseName(trimmed);
    if (!norm || seen.has(norm)) return;
    seen.add(norm);
    result.push(trimmed);
  };

  for (const a of base) push(a);
  for (const a of additions) push(a);

  return result.slice(0, max);
}

export function mergeExercises(state: AppState, fromExerciseId: string, intoExerciseId: string): AppState {
  if (!fromExerciseId || !intoExerciseId) return state;
  if (fromExerciseId === intoExerciseId) return state;

  const from = state.exercises.find((ex) => ex.id === fromExerciseId);
  const into = state.exercises.find((ex) => ex.id === intoExerciseId);
  if (!from || !into) return state;

  const intoAliases = Array.isArray(into.aliases) ? into.aliases : [];
  const fromAliases = Array.isArray(from.aliases) ? from.aliases : [];
  const mergedAliases = mergeAliasesStable(intoAliases, [from.name, ...fromAliases], MAX_MERGED_EXERCISE_ALIASES);

  const updatedInto: Exercise = {
    ...into,
    aliases: mergedAliases,
    canonicalName: typeof into.canonicalName === 'string' && into.canonicalName.trim()
      ? into.canonicalName
      : normalizeExerciseName(into.name),
  };

  return {
    ...state,
    exercises: state.exercises
      .filter((ex) => ex.id !== fromExerciseId)
      .map((ex) => (ex.id === intoExerciseId ? updatedInto : ex)),
    sets: state.sets.map((s) => (s.exerciseId === fromExerciseId ? { ...s, exerciseId: intoExerciseId } : s)),
    cardioEntries: (state.cardioEntries ?? []).map((c) =>
      c.exerciseId === fromExerciseId ? { ...c, exerciseId: intoExerciseId } : c
    ),
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
    pauseSec: resolvedMeta.pauseSec ?? null,
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
      pauseSec: resolvedMeta.pauseSec ?? null,
      setType: resolvedMeta.setType,
    }));

  return {
    ...state,
    sets: [...state.sets, ...newSets],
  };
}

export function updateSet(
  state: AppState,
  setId: string,
  weight: number,
  reps: number,
  meta?: SetMeta
): AppState {
  if (!Number.isFinite(weight) || !Number.isFinite(reps) || weight < 0 || reps <= 0) {
    return state;
  }

  return {
    ...state,
    sets: state.sets.map((s) =>
      s.id === setId
        ? (() => {
            if (!meta) return { ...s, weight, reps };
            const resolvedMeta = resolveSetMeta(weight, meta);
            return {
              ...s,
              weight,
              reps,
              isBodyweight: resolvedMeta.isBodyweight,
              distanceKm: resolvedMeta.distanceKm ?? null,
              durationMin: resolvedMeta.durationMin ?? null,
              pauseSec: resolvedMeta.pauseSec ?? null,
              setType: resolvedMeta.setType,
            };
          })()
        : s
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
  pauseSec?: number | null;
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
      pauseSec: s.pauseSec ?? null,
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
    pauseSec?: number | null;
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
          pauseSec: set.pauseSec,
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
      pauseSec: set.pauseSec,
      setType: set.setType,
    });
    existing.time = set.time;
  }

  return Array.from(map.values());
}

export function deleteAllLoggedSets(state: AppState): AppState {
  if (!state.sets.length) return state;
  return { ...state, sets: [] };
}

export function deleteAllCustomExercises(state: AppState): AppState {
  const customExerciseIds = new Set(
    state.exercises.filter((ex) => ex.isCustom !== false).map((ex) => ex.id)
  );
  if (customExerciseIds.size === 0) return state;

  return {
    ...state,
    exercises: state.exercises.filter((ex) => !customExerciseIds.has(ex.id)),
    sets: state.sets.filter((s) => !customExerciseIds.has(s.exerciseId)),
  };
}
