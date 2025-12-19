export type TrainingBlockId =
  | 'chest'
  | 'shoulders'
  | 'back'
  | 'arms'
  | 'core'
  | 'legs'
  | 'cardio';

export type ThemeMode = 'light' | 'dark';

export type AuthProvider = 'guest' | 'email' | 'github';

export type AppLanguage = 'en' | 'nb' | 'es';

export interface LogEntry {
  id: string;
  text: string;
  createdAt: string; // ISO string
}

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
  // Intern identitet (alltid lokalt tilgjengelig)
  userId?: string;
  onboarded?: boolean;
  authProvider?: AuthProvider;

  // "Identitet" for denne enheten
  userEmail: string | null;

  // Profil / settings
  nickname?: string | null;
  heightCm?: number | null;
  weightKg?: number | null;
  theme?: ThemeMode; // lagres, kan brukes til theming senere
  language?: AppLanguage;

  // Treningsdata
  blocks: TrainingBlock[];
  exercises: Exercise[];
  sets: SetEntry[];
  logs?: LogEntry[];
}
