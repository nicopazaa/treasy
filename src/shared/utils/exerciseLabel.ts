import { Exercise } from '../../features/workouts/model/types';

export function getExerciseLabelSegments(exercise: Exercise): string[] {
  const parts: string[] = [];
  if (exercise.shortCode) parts.push(exercise.shortCode);
  if (exercise.tags?.length) parts.push(...exercise.tags);
  return Array.from(new Set(parts.filter(Boolean)));
}

export function formatExerciseLabel(exercise: Exercise): string {
  const parts = getExerciseLabelSegments(exercise);
  if (!parts.length) return exercise.name;
  const suffix = parts.map((p) => `(${p})`).join(' ');
  return `${exercise.name} ${suffix}`.trim();
}
