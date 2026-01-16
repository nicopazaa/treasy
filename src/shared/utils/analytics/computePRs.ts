import type { SetEntry } from '../../../domain/workouts/types';

export type PRHit = {
  exerciseId: string;
  weightKg: number;
  createdAt: string;
};

function isWeightedSet(set: SetEntry): boolean {
  if (!set) return false;
  if (set.setType === 'cardio') return false;
  if (set.isBodyweight || set.setType === 'bodyweight') return false;
  if (!Number.isFinite(set.weight) || !Number.isFinite(set.reps)) return false;
  if (set.weight <= 0 || set.reps <= 0) return false;
  return true;
}

export function computePRHits(
  setsByExerciseId: Map<string, SetEntry[]>,
  options?: { limit?: number }
): PRHit[] {
  const hits: PRHit[] = [];

  for (const [exerciseId, sets] of setsByExerciseId.entries()) {
    let bestWeight = -Infinity;
    for (let i = sets.length - 1; i >= 0; i -= 1) {
      const set = sets[i];
      if (!isWeightedSet(set)) continue;
      if (set.weight > bestWeight) {
        bestWeight = set.weight;
        hits.push({ exerciseId, weightKg: set.weight, createdAt: set.createdAt });
      }
    }
  }

  hits.sort((a, b) => {
    if (a.createdAt === b.createdAt) {
      if (a.exerciseId === b.exerciseId) return b.weightKg - a.weightKg;
      return a.exerciseId < b.exerciseId ? -1 : 1;
    }
    return a.createdAt < b.createdAt ? 1 : -1;
  });

  const limit = options?.limit ?? 5;
  return hits.slice(0, Math.max(0, limit));
}

