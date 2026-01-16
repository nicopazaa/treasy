import type { AppLanguage } from '../types';
import type { Exercise, SetEntry } from '../../domain/workouts/types';
import { formatExerciseLabel } from './exerciseLabel';
import { formatWeight, type MassUnit } from './units';

export type ProgressiveOverloadSummary = {
  label: string;
  exerciseName?: string;
  deltaKg?: number;
};

type Options = {
  language: AppLanguage;
  massUnit: MassUnit;
  exercises: Exercise[];
  sets: SetEntry[];
  now?: Date;
  windowDays?: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function isWeightedSet(set: SetEntry): boolean {
  if (!set) return false;
  if (set.setType === 'cardio') return false;
  if (set.isBodyweight || set.setType === 'bodyweight' || set.weight === 0) return false;
  return Number.isFinite(set.weight) && set.weight > 0;
}

function parseTimeMs(createdAt: string): number | null {
  if (!createdAt) return null;
  const t = new Date(createdAt).getTime();
  return Number.isFinite(t) ? t : null;
}

function neutralMessage(language: AppLanguage): string {
  if (language === 'es') return 'Aún no hay aumentos — registra algunos entrenos para ver progreso';
  if (language === 'en') return 'No new increases yet — log a few workouts to see progress';
  return 'Ingen nye økninger ennå — logg et par økter for å se fremgang';
}

export function progressiveOverloadSummary({
  language,
  massUnit,
  exercises,
  sets,
  now = new Date(),
  windowDays = 30,
}: Options): ProgressiveOverloadSummary {
  const byExerciseId = new Map(exercises.map((ex) => [ex.id, ex] as const));

  const endRecent = now.getTime();
  const startRecent = endRecent - windowDays * DAY_MS;
  const startPrev = startRecent - windowDays * DAY_MS;

  const bestPrev = new Map<string, number>();
  const bestRecent = new Map<string, number>();

  for (const set of sets) {
    if (!isWeightedSet(set)) continue;

    const timeMs = parseTimeMs(set.createdAt);
    if (timeMs == null) continue;

    const target =
      timeMs >= startRecent && timeMs < endRecent ? bestRecent :
      timeMs >= startPrev && timeMs < startRecent ? bestPrev :
      null;

    if (!target) continue;

    const prev = target.get(set.exerciseId) ?? -Infinity;
    if (set.weight > prev) target.set(set.exerciseId, set.weight);
  }

  let bestExerciseId: string | null = null;
  let bestDeltaKg = 0;

  for (const [exerciseId, recentKg] of bestRecent) {
    const prevKg = bestPrev.get(exerciseId);
    if (prevKg == null) continue;

    const delta = recentKg - prevKg;
    if (!Number.isFinite(delta) || delta <= 0) continue;
    if (delta > bestDeltaKg) {
      bestDeltaKg = delta;
      bestExerciseId = exerciseId;
    }
  }

  if (!bestExerciseId || bestDeltaKg <= 0) {
    return { label: neutralMessage(language) };
  }

  const exercise = byExerciseId.get(bestExerciseId) ?? null;
  const exerciseName = exercise ? formatExerciseLabel(exercise) : language === 'nb' ? 'Ukjent øvelse' : 'Unknown exercise';
  const deltaLabel = `+${formatWeight(bestDeltaKg, massUnit, language)}`;

  const label =
    language === 'es'
      ? `${exerciseName}: ${deltaLabel} (últimos ${windowDays} días)`
      : language === 'en'
        ? `${exerciseName}: ${deltaLabel} (last ${windowDays} days)`
        : `${deltaLabel} på ${exerciseName} (siste ${windowDays} dager)`;

  return { label, exerciseName, deltaKg: bestDeltaKg };
}

