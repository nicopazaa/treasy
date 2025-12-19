import { TrainingBlockId } from '../../workouts/model/types';
import { ParsedSet, QuickLogParseResult } from './types';

const SET_REGEX = /(\d+(?:[.,]\d+)?)\s*(?:kg)?\s*[x*]\s*(\d+)/gi;

const BLOCK_KEYWORDS: Array<{ id: TrainingBlockId; keywords: string[] }> = [
  { id: 'chest', keywords: ['bryst', 'benk', 'pec', 'pushup', 'fly'] },
  { id: 'shoulders', keywords: ['skulder', 'militar', 'overhead'] },
  { id: 'back', keywords: ['rygg', 'markloft', 'roing', 'pullup', 'lat'] },
  { id: 'arms', keywords: ['biceps', 'triceps', 'curl', 'extension'] },
  { id: 'core', keywords: ['mage', 'planke', 'situp', 'crunch'] },
  { id: 'legs', keywords: ['bein', 'kneb', 'squat', 'utfall', 'leg', 'calf', 'tahev', 'tåhev'] },
  { id: 'cardio', keywords: ['cardio', 'lop', 'jogg', 'run', 'sykkel', 'bike'] },
];

function normalizeMatch(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseQuickLog(input: string): QuickLogParseResult | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const matches = Array.from(trimmed.matchAll(SET_REGEX));
  if (matches.length === 0) return null;

  const firstIndex = matches[0].index ?? 0;
  const exercisePart = trimmed.slice(0, firstIndex).trim().replace(/[,;:]+$/, '');
  if (!exercisePart) return null;

  const sets = matches
    .map((match) => {
      const weight = Number(String(match[1]).replace(',', '.'));
      const reps = Number(match[2]);
      if (!Number.isFinite(weight) || !Number.isFinite(reps)) return null;
      if (weight < 0 || reps <= 0) return null;
      return { weight, reps };
    })
    .filter((s): s is ParsedSet => s !== null);

  if (sets.length === 0) return null;

  return {
    exerciseName: exercisePart,
    sets,
  };
}

export function inferBlockIdFromExercise(name: string): TrainingBlockId | null {
  const normalized = normalizeMatch(name);
  if (!normalized) return null;

  for (const rule of BLOCK_KEYWORDS) {
    if (rule.keywords.some((kw) => normalized.includes(kw))) {
      return rule.id;
    }
  }
  return null;
}
