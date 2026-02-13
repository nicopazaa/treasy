import type { AppLanguage } from '../../shared/types';
import type { AppState } from '../workouts/types';
import { parseTrainingText, type ParsedSet } from '../parsing/parsePipeline';
import { addSetsForExercise, findExerciseByNameOrAlias } from '../workouts/workoutService';
import { findExerciseFuzzy } from './exerciseLookup';

export type ParsedWorkoutEntry = {
  exerciseId: string;
  exerciseName: string;
  sets: ParsedSet[];
};

export type ParsedWorkoutAction = {
  entries: ParsedWorkoutEntry[];
};

export type ParsedInputAction =
  | { kind: 'workout'; payload: ParsedWorkoutAction }
  | { kind: 'note'; payload: { text: string } };

type ParseOptions = {
  appState: AppState;
  language?: AppLanguage;
  defaultUnit?: 'kg' | 'lb';
};

function splitNameAndCodes(raw: string): { name: string } {
  const name = raw.replace(/\s*\([^)]+\)\s*/g, ' ').replace(/\s+/g, ' ').trim() || raw.trim();
  return { name };
}

function sanitizeSets(sets: ParsedSet[]): ParsedSet[] {
  return sets.filter(
    (set) =>
      Number.isFinite(set.weight) &&
      Number.isFinite(set.reps) &&
      set.weight >= 0 &&
      set.reps > 0
  );
}

export function parseInputToAction(input: string, opts: ParseOptions): ParsedInputAction {
  const trimmed = input.trim();
  if (!trimmed) return { kind: 'note', payload: { text: '' } };

  const language = opts.language ?? opts.appState.language ?? 'en';
  const defaultUnit = opts.defaultUnit ?? opts.appState.massUnit ?? 'kg';

  const segments = trimmed
    .split(/[\n;]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (segments.length === 0) {
    return { kind: 'note', payload: { text: trimmed } };
  }

  const entries: ParsedWorkoutEntry[] = [];
  for (const segment of segments) {
    const chunks = parseTrainingText(segment, { language, defaultUnit });
    if (chunks.length !== 1) {
      return { kind: 'note', payload: { text: trimmed } };
    }

    const chunk = chunks[0];
    if (!chunk) {
      return { kind: 'note', payload: { text: trimmed } };
    }

    const rawName = String(chunk.rawExerciseName ?? '').trim();
    if (!rawName) {
      return { kind: 'note', payload: { text: trimmed } };
    }

    const { name: parsedName } = splitNameAndCodes(rawName);
    const lookupName = parsedName || rawName;

    const exact =
      findExerciseByNameOrAlias(opts.appState, rawName) ??
      (lookupName !== rawName ? findExerciseByNameOrAlias(opts.appState, lookupName) : null);
    const matched =
      exact ??
      findExerciseFuzzy(opts.appState, rawName) ??
      (lookupName !== rawName ? findExerciseFuzzy(opts.appState, lookupName) : null);

    if (!matched) {
      return { kind: 'note', payload: { text: trimmed } };
    }

    const sets = sanitizeSets(chunk.sets ?? []);
    if (sets.length === 0) {
      return { kind: 'note', payload: { text: trimmed } };
    }

    entries.push({
      exerciseId: matched.id,
      exerciseName: matched.name,
      sets,
    });
  }

  if (entries.length === 0) {
    return { kind: 'note', payload: { text: trimmed } };
  }

  return { kind: 'workout', payload: { entries } };
}

export function applyParsedWorkoutAction(state: AppState, action: ParsedWorkoutAction): AppState {
  let next = state;
  const existingIds = new Set(next.exercises.map((ex) => ex.id));

  for (const entry of action.entries) {
    if (!existingIds.has(entry.exerciseId)) continue;
    const sets = entry.sets.map((set) => ({ weight: set.weight, reps: set.reps }));
    if (sets.length === 0) continue;
    next = addSetsForExercise(next, entry.exerciseId, sets);
  }

  return next;
}
