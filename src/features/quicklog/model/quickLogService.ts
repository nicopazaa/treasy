import type { AppLanguage } from '../../../shared/types';
import { TrainingBlockId } from '../../workouts/model/types';
import { parseTrainingText } from '../../parsing/parsePipeline';
import { ParsedSet, QuickLogParseResult } from './types';

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
  return parseQuickLogWithOptions(input);
}

// Backwards-compatible wrapper that uses the shared parse pipeline.
export function parseQuickLogWithOptions(
  input: string,
  opts?: { language?: AppLanguage; defaultUnit?: 'kg' | 'lb' }
): QuickLogParseResult | null {
  const language = opts?.language ?? 'en';
  const defaultUnit = opts?.defaultUnit ?? 'kg';
  const chunks = parseTrainingText(input, { language, defaultUnit });
  const first = chunks[0] ?? null;
  if (!first) return null;

  const sets: ParsedSet[] = first.sets
    .map((s) => ({ weight: s.weight, reps: s.reps }))
    .filter((s) => Number.isFinite(s.weight) && Number.isFinite(s.reps) && s.weight >= 0 && s.reps > 0);
  if (sets.length === 0) return null;

  return { exerciseName: first.rawExerciseName, sets };
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
