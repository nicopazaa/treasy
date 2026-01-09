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

function exerciseTokens(ex: Exercise): string[] {
  const tokens = [
    ex.name,
    ex.canonicalName ?? '',
    ...(ex.aliases ?? []),
    ex.shortCode ?? '',
    ...(ex.tags ?? []),
  ];
  return tokens.map(normalizeName).filter(Boolean);
}

export function findExerciseByName(appState: AppState, name: string): Exercise | null {
  const target = normalizeName(name);
  if (!target) return null;
  return (
    appState.exercises.find((ex) => {
      const tokens = exerciseTokens(ex);
      return tokens.includes(target);
    }) ?? null
  );
}

export function findExerciseFuzzy(appState: AppState, name: string): Exercise | null {
  const target = normalizeName(name);
  if (!target) return null;

  let best: { ex: Exercise; score: number } | null = null;

  for (const ex of appState.exercises) {
    const tokens = exerciseTokens(ex);
    for (const token of tokens) {
      if (token === target) return ex;

      let score = 0;
      if (token.includes(target) || target.includes(token)) {
        const minLen = Math.min(token.length, target.length);
        const maxLen = Math.max(token.length, target.length);
        score = minLen / maxLen;
      }

      if (!best || score > best.score) {
        best = { ex, score };
      }
    }
  }

  if (best && best.score >= 0.6) {
    return best.ex;
  }

  return null;
}
