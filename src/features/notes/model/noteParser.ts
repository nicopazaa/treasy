import type { AppLanguage } from '../../../shared/types';
import { parseTrainingText } from '../../parsing/parsePipeline';

export type ParsedNoteSet = {
  weight: number;
  reps: number;
  isBodyweight: boolean;
};

export type ParsedNoteExercise = {
  exerciseName: string;
  sets: ParsedNoteSet[];
};

// Backwards-compatible wrapper that uses the shared parse pipeline.
export function parseNoteText(
  input: string,
  opts?: { language?: AppLanguage; defaultUnit?: 'kg' | 'lb' }
): ParsedNoteExercise[] {
  const language = opts?.language ?? 'en';
  const defaultUnit = opts?.defaultUnit ?? 'kg';

  const chunks = parseTrainingText(input, { language, defaultUnit });
  return chunks.map((chunk) => ({
    exerciseName: chunk.rawExerciseName,
    sets: chunk.sets.map((s) => ({
      weight: s.weight,
      reps: s.reps,
      isBodyweight: s.isBodyweight === true || s.weight === 0,
    })),
  }));
}
