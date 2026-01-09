import type { AppState, Exercise, SetEntry } from '../../features/workouts/model/types';

export type DerivedCache = {
  exerciseById: Map<string, Exercise>;
  exercisesByBlockId: Map<string, Exercise[]>;
  // Sorted newest-first (descending by `createdAt`).
  setsByExerciseId: Map<string, SetEntry[]>;
  // dayKey = YYYY-MM-DD in *local time*.
  // Sorted newest-first (descending by `createdAt`).
  setsByDayKey: Map<string, SetEntry[]>;
};

function toLocalDayKey(iso: string): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) {
    // Defensive fallback: keep a stable key even if the date string is unexpected.
    return String(iso ?? '').slice(0, 10);
  }
  const yyyy = String(dt.getFullYear());
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function sortByCreatedAtDesc(a: { createdAt: string }, b: { createdAt: string }): number {
  // Keep behavior consistent with existing call sites that use:
  // `sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))`
  return a.createdAt < b.createdAt ? 1 : -1;
}

// Pure, deterministic, in-memory indexes for fast lookups.
export function buildDerivedCache(state: AppState): DerivedCache {
  const exerciseById = new Map<string, Exercise>();
  const exercisesByBlockId = new Map<string, Exercise[]>();
  const setsByExerciseId = new Map<string, SetEntry[]>();
  const setsByDayKey = new Map<string, SetEntry[]>();

  const exercises = Array.isArray(state.exercises) ? state.exercises : [];
  for (const exercise of exercises) {
    if (!exercise?.id) continue;
    exerciseById.set(exercise.id, exercise);

    const blockId = String(exercise.blockId ?? '');
    const list = exercisesByBlockId.get(blockId);
    if (list) {
      list.push(exercise);
    } else {
      exercisesByBlockId.set(blockId, [exercise]);
    }
  }

  const sets = Array.isArray(state.sets) ? state.sets : [];
  for (const set of sets) {
    if (!set?.id) continue;

    const exId = String(set.exerciseId ?? '');
    const byEx = setsByExerciseId.get(exId);
    if (byEx) {
      byEx.push(set);
    } else {
      setsByExerciseId.set(exId, [set]);
    }

    const dayKey = toLocalDayKey(set.createdAt);
    const byDay = setsByDayKey.get(dayKey);
    if (byDay) {
      byDay.push(set);
    } else {
      setsByDayKey.set(dayKey, [set]);
    }
  }

  // Keep ordering consistent and documented: newest-first everywhere.
  for (const list of setsByExerciseId.values()) {
    list.sort(sortByCreatedAtDesc);
  }
  for (const list of setsByDayKey.values()) {
    list.sort(sortByCreatedAtDesc);
  }

  return {
    exerciseById,
    exercisesByBlockId,
    setsByExerciseId,
    setsByDayKey,
  };
}
