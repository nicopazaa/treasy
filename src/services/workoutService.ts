import { AppState, Exercise, LogEntry, SetEntry } from '../types';

function generateId(prefix: string = 'id'): string {
  return `${prefix}_${Math.random().toString(36).substring(2, 10)}_${Date.now().toString(36)}`;
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

export function addExercise(state: AppState, blockId: string, name: string): AppState {
  const trimmed = name.trim();
  if (!trimmed) return state;

  const newExercise: Exercise = {
    id: generateId('ex'),
    blockId,
    name: trimmed,
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
  sets: Array<{ weight: number; reps: number }>
): AppState {
  const res = addExerciseWithSetsResult(state, blockId, name, sets);
  return res ? res.nextState : state;
}

export function addExerciseWithSetsResult(
  state: AppState,
  blockId: string,
  name: string,
  sets: Array<{ weight: number; reps: number }>
): { nextState: AppState; exerciseId: string } | null {
  const trimmed = name.trim();
  if (!trimmed) return null;
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

export function renameExercise(state: AppState, exerciseId: string, name: string): AppState {
  const trimmed = name.trim();
  if (!trimmed) return state;
  return {
    ...state,
    exercises: state.exercises.map((ex) =>
      ex.id === exerciseId ? { ...ex, name: trimmed } : ex
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

export function setExerciseBlockId(state: AppState, exerciseId: string, blockId: string): AppState {
  return {
    ...state,
    exercises: state.exercises.map((ex) =>
      ex.id === exerciseId ? { ...ex, blockId } : ex
    ),
  };
}

export function addSet(state: AppState, exerciseId: string, weight: number, reps: number): AppState {
  if (!Number.isFinite(weight) || !Number.isFinite(reps) || weight < 0 || reps <= 0) {
    return state;
  }

  const newSet: SetEntry = {
    id: generateId('set'),
    exerciseId,
    weight,
    reps,
    createdAt: new Date().toISOString(),
  };

  return {
    ...state,
    sets: [...state.sets, newSet],
  };
}

export function addSetsForExercise(
  state: AppState,
  exerciseId: string,
  sets: Array<{ weight: number; reps: number }>
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
  const newSets: SetEntry[] = validSets.map((s) => ({
    id: generateId('set'),
    exerciseId,
    weight: s.weight,
    reps: s.reps,
    createdAt,
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
  blockName?: string;
  blockId?: string;
  weight: number;
  reps: number;
  time: string;
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
      blockName: block?.name,
      blockId: block?.id,
      weight: s.weight,
      reps: s.reps,
      time,
    });
  }

  results.sort((a, b) => (a.time > b.time ? 1 : -1));
  return results;
}

export interface GroupedDailySetView {
  id: string;
  exerciseName: string;
  blockName?: string;
  blockId?: string;
  time: string;
  sets: Array<{ weight: number; reps: number }>;
}

export function groupDailySets(sets: DailySetView[]): GroupedDailySetView[] {
  const map = new Map<string, GroupedDailySetView>();

  for (const set of sets) {
    const key = `${set.exerciseName}__${set.blockId ?? set.blockName ?? ''}`;
    const existing = map.get(key);

    if (!existing) {
      map.set(key, {
        id: set.id,
        exerciseName: set.exerciseName,
        blockName: set.blockName,
        blockId: set.blockId,
        time: set.time,
        sets: [{ weight: set.weight, reps: set.reps }],
      });
      continue;
    }

    existing.sets.push({ weight: set.weight, reps: set.reps });
    existing.time = set.time;
  }

  return Array.from(map.values());
}

