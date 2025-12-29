export type ParsedNoteSet = {
  weight: number;
  reps: number;
  isBodyweight: boolean;
};

export type ParsedNoteExercise = {
  exerciseName: string;
  sets: ParsedNoteSet[];
};

const SET_REGEX = /(\d+(?:[.,]\d+)?|bw)\s*(?:kg)?\s*[x*]\s*(\d+)/gi;

function parseSegment(segment: string): ParsedNoteExercise | null {
  const trimmed = segment.trim();
  if (!trimmed) return null;

  const matches = Array.from(trimmed.matchAll(SET_REGEX));
  if (matches.length === 0) return null;

  const firstIndex = matches[0].index ?? 0;
  const exercisePart = trimmed.slice(0, firstIndex).trim().replace(/[,;:]+$/, '');
  if (!exercisePart) return null;

  const sets = matches
    .map((match) => {
      const weightToken = String(match[1] ?? '').trim().toLowerCase();
      const reps = Number(match[2]);
      const isBw = weightToken === 'bw';
      const weight = isBw ? 0 : Number(weightToken.replace(',', '.'));

      if (!Number.isFinite(reps) || reps <= 0) return null;
      if (!Number.isFinite(weight) || weight < 0) return null;

      return { weight, reps, isBodyweight: isBw };
    })
    .filter((s): s is ParsedNoteSet => Boolean(s));

  if (sets.length === 0) return null;

  return {
    exerciseName: exercisePart,
    sets,
  };
}

export function parseNoteText(input: string): ParsedNoteExercise[] {
  const trimmed = input.trim();
  if (!trimmed) return [];

  const parts = trimmed.split(/[\n;]+/).map((part) => part.trim()).filter(Boolean);
  const segments = parts.length > 0 ? parts : [trimmed];

  const results: ParsedNoteExercise[] = [];
  for (const segment of segments) {
    const parsed = parseSegment(segment);
    if (parsed) results.push(parsed);
  }

  return results;
}
