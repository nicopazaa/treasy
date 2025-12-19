export type TrainingBlockId =
  | 'chest'
  | 'shoulders'
  | 'back'
  | 'arms'
  | 'core'
  | 'legs'
  | 'cardio';

export type ThemeMode = 'light' | 'dark';

export interface TrainingBlock {
  id: TrainingBlockId | string;
  name: string;
}

export interface Exercise {
  id: string;
  blockId: string;
  name: string;
}

export interface SetEntry {
  id: string;
  exerciseId: string;
  weight: number;
  reps: number;
  createdAt: string; // ISO string
}

export interface AppState {
  // "Identitet" for denne enheten
  userEmail: string | null;

  // Profil / settings
  nickname?: string | null;
  heightCm?: number | null;
  weightKg?: number | null;
  theme?: ThemeMode; // lagres, kan brukes til theming senere

  // Treningsdata
  blocks: TrainingBlock[];
  exercises: Exercise[];
  sets: SetEntry[];
}
