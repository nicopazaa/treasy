import { AppState, Exercise } from '../../workouts/model/types';

function normalizeMatch(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeName(value: string): string {
  return normalizeMatch(value).replace(/\s+/g, '');
}

export function findExerciseByName(appState: AppState, name: string): Exercise | null {
  const target = normalizeName(name);
  if (!target) return null;
  return appState.exercises.find((ex) => normalizeName(ex.name) === target) ?? null;
}

export function findExerciseFuzzy(appState: AppState, name: string): Exercise | null {
  const target = normalizeName(name);
  if (!target) return null;

  let best: { ex: Exercise; score: number } | null = null;

  for (const ex of appState.exercises) {
    const exNorm = normalizeName(ex.name);
    if (!exNorm) continue;
    if (exNorm === target) return ex;

    let score = 0;
    if (exNorm.includes(target) || target.includes(exNorm)) {
      const minLen = Math.min(exNorm.length, target.length);
      const maxLen = Math.max(exNorm.length, target.length);
      score = minLen / maxLen;
    }

    if (!best || score > best.score) {
      best = { ex, score };
    }
  }

  if (best && best.score >= 0.6) {
    return best.ex;
  }

  return null;
}
