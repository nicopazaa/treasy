import type { AppLanguage, AuthProvider, ThemeMode } from '../../../shared/types';
export type { AppLanguage } from '../../../shared/types';

export type TrainingBlockId =
  | 'chest'
  | 'shoulders'
  | 'back'
  | 'arms'
  | 'core'
  | 'legs'
  | 'cardio'
  | 'bodyweight';

export interface LogEntry {
  id: string;
  text: string;
  createdAt: string; // ISO string
  pinned?: boolean;
}

export interface NoteEntry {
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
  shortCode?: string | null;
  tags?: string[];
  isCustom?: boolean;
  // Optional for backwards compatibility (older saved states won't have this).
  aliases?: string[];
  // Optional normalized name for deterministic matching (lower/trimmed/diacritics removed).
  canonicalName?: string;
}

export interface ExerciseMetadataInput {
  shortCode?: string | null;
  tags?: string[];
}

export interface SetEntry {
  id: string;
  exerciseId: string;
  weight: number;
  reps: number;
  createdAt: string; // ISO string
  isBodyweight?: boolean;
  distanceKm?: number | null;
  durationMin?: number | null;
  pauseSec?: number | null;
  setType?: 'weighted' | 'bodyweight' | 'cardio';
}

export interface CardioEntry {
  id: string;
  exerciseId: string;
  distanceKm: number | null;
  durationMin: number | null;
  avgHeartRate?: number | null;
  intensity?: 'easy' | 'moderate' | 'hard' | null;
  note?: string | null;
  silentMode?: boolean | null;
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
  massUnit?: 'kg' | 'lb';

  // Treningsdata
  blocks: TrainingBlock[];
  exercises: Exercise[];
  sets: SetEntry[];
  cardioEntries: CardioEntry[];
  logs?: LogEntry[];
  notes?: NoteEntry[];
}
