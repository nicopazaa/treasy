import type { AppLanguage } from '../../shared/types';
import { toKg, type MassUnit } from '../../shared/utils/units';

export type ParsedSet = {
  weight: number; // stored as kg (0 for BW)
  reps: number;
  rpe?: number;
  isBodyweight?: boolean;
};

export type ParsedExerciseChunk = {
  rawExerciseName: string;
  sets: ParsedSet[];
};

const SET_REGEX =
  /(bw|\d+(?:[.,]\d+)?)\s*(kg|lb)?\s*[x*]\s*(\d+)(?:\s*(?:@|rpe)\s*(\d+(?:[.,]\d+)?))?/gi;

function parseNumberToken(raw: string): number {
  return Number(String(raw ?? '').trim().replace(',', '.'));
}

function parseRpeToken(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const value = parseNumberToken(raw);
  if (!Number.isFinite(value)) return undefined;
  if (value < 1 || value > 10) return undefined;
  return value;
}

function parseWeightToken(
  rawWeight: string,
  rawUnit: string | undefined,
  defaultUnit: MassUnit
): { weightKg: number; isBodyweight: boolean } | null {
  const token = String(rawWeight ?? '').trim().toLowerCase();
  if (!token) return null;

  if (token === 'bw') {
    return { weightKg: 0, isBodyweight: true };
  }

  const value = parseNumberToken(token);
  if (!Number.isFinite(value) || value < 0) return null;

  const unitToken = String(rawUnit ?? '').trim().toLowerCase();
  const unit: MassUnit = unitToken === 'lb' ? 'lb' : unitToken === 'kg' ? 'kg' : defaultUnit;
  const weightKg = toKg(value, unit);
  if (!Number.isFinite(weightKg) || weightKg < 0) return null;

  // In Treasy, weight=0 is treated as bodyweight.
  const isBodyweight = weightKg === 0;
  return { weightKg, isBodyweight };
}

function parseSegment(
  segment: string,
  opts: { language: AppLanguage; defaultUnit: MassUnit }
): ParsedExerciseChunk | null {
  const trimmed = segment.trim();
  if (!trimmed) return null;

  const matches = Array.from(trimmed.matchAll(SET_REGEX));
  if (matches.length === 0) return null;

  const firstIndex = matches[0]?.index ?? 0;
  const rawExerciseName = trimmed.slice(0, firstIndex).trim().replace(/[,;:]+$/, '');
  if (!rawExerciseName) return null;

  const sets: ParsedSet[] = [];
  for (const match of matches) {
    const weightToken = String(match[1] ?? '');
    const unitToken = match[2] ? String(match[2]) : undefined;
    const reps = Number(match[3]);
    const rpe = parseRpeToken(match[4] ? String(match[4]) : undefined);

    if (!Number.isFinite(reps) || reps <= 0) continue;

    // If an RPE token was present but invalid, skip this set (deterministic safety).
    if (match[4] && typeof rpe === 'undefined') continue;

    const parsedWeight = parseWeightToken(weightToken, unitToken, opts.defaultUnit);
    if (!parsedWeight) continue;

    sets.push({
      weight: parsedWeight.weightKg,
      reps,
      rpe,
      isBodyweight: parsedWeight.isBodyweight,
    });
  }

  if (sets.length === 0) return null;

  return { rawExerciseName, sets };
}

export function parseTrainingText(
  input: string,
  opts: {
    language: AppLanguage;
    defaultUnit: 'kg' | 'lb';
  }
): ParsedExerciseChunk[] {
  const trimmed = input.trim();
  if (!trimmed) return [];

  // Multiple exercises can be separated by newline or ';' (deterministic splitting).
  const segments = trimmed
    .split(/[\n;]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const results: ParsedExerciseChunk[] = [];
  for (const segment of segments.length > 0 ? segments : [trimmed]) {
    const parsed = parseSegment(segment, { language: opts.language, defaultUnit: opts.defaultUnit });
    if (parsed) results.push(parsed);
  }
  return results;
}

