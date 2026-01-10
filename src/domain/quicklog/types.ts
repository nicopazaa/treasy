export type ParsedSet = {
  weight: number;
  reps: number;
};

export type QuickLogParseResult = {
  exerciseName: string;
  sets: ParsedSet[];
};

