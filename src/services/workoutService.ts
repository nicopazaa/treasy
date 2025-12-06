import { AppState, Exercise, SetEntry } from '../types';

function generateId(prefix: string = 'id'): string {
  return `${prefix}_${Math.random().toString(36).substring(2, 10)}_${Date.now().toString(36)}`;
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

export function addSet(state: AppState, exerciseId: string, weight: number, reps: number): AppState {
  if (!Number.isFinite(weight) || !Number.isFinite(reps) || weight <= 0 || reps <= 0) {
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

export function getSetsForExercise(state: AppState, exerciseId: string): SetEntry[] {
  return state.sets
    .filter((s) => s.exerciseId === exerciseId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)); // newest first
}

export function getLastSetForExercise(state: AppState, exerciseId: string): SetEntry | null {
  const sets = getSetsForExercise(state, exerciseId);
  return sets.length > 0 ? sets[0] : null;
}

/**
 * ---- Daglig økt-oversikt ----
 */

function toDateKey(iso: string): string {
  // Bruk bare YYYY-MM-DD fra ISO-datoen
  return iso.slice(0, 10);
}

/** Liste over alle datoer der brukeren har logget noe (nyeste først) */
export function getWorkoutDates(state: AppState): string[] {
  const keys = new Set<string>();
  for (const s of state.sets) {
    keys.add(toDateKey(s.createdAt));
  }
  return Array.from(keys).sort((a, b) => (a < b ? 1 : -1)); // nyeste først
}

export interface DailySetView {
  id: string;
  exerciseName: string;
  blockName?: string;
  weight: number;
  reps: number;
  time: string; // f.eks. 21:20
}

/** Alle sett som ble tatt på en gitt dag (uansett muskelgruppe) */
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
      weight: s.weight,
      reps: s.reps,
      time,
    });
  }

  // sorter eldste først innen dagen (så du ser rekkefølgen på økta)
  results.sort((a, b) => (a.time > b.time ? 1 : -1));
  return results;
}
