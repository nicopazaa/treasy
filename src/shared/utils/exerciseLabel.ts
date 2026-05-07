import type { Exercise } from '../../domain/workouts/types';

export type ExerciseLabelParts = {
  main: string;
  parentheses: string | null;
};

export function getExerciseLabelSegments(exercise: Exercise): string[] {
  const parts: string[] = [];
  if (exercise.shortCode) parts.push(exercise.shortCode);
  if (exercise.tags?.length) parts.push(...exercise.tags);
  return Array.from(new Set(parts.filter(Boolean)));
}

export function splitExerciseLabelParentheses(label: string): ExerciseLabelParts {
  const idx = label.indexOf('(');
  if (idx <= 0) return { main: label, parentheses: null };
  const main = label.slice(0, idx).trimEnd();
  const parentheses = label.slice(idx).trim();
  return parentheses.startsWith('(') && parentheses.length > 0 ? { main, parentheses } : { main: label, parentheses: null };
}

export function formatExerciseLabel(exercise: Exercise): string {
  const parts = getExerciseLabelSegments(exercise);
  if (!parts.length) return exercise.name;
  const suffix = parts.map((p) => `(${p})`).join(' ');
  return `${exercise.name} ${suffix}`.trim();
}
