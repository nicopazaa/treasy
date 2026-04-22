import type { AppLanguage, AuthProvider, ThemeMode, SyncState, SyncStatus } from '../../shared/types';
export type { AppLanguage } from '../../shared/types';

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
  clientId?: string;
  text: string;
  createdAt: string; // ISO string
  updatedAt?: string; // ISO string
  deletedAt?: string | null; // ISO string
  syncStatus?: SyncStatus;
  version?: number;
  pinned?: boolean;
}

export type NoteSource = 'home_notes' | 'quicklog' | 'other';

export interface NoteEntry {
  id: string;
  clientId?: string;
  text: string;
  createdAt: string; // ISO string
  updatedAt?: string; // ISO string
  deletedAt?: string | null; // ISO string
  syncStatus?: SyncStatus;
  version?: number;
  source: NoteSource;
}

export interface TrainingBlock {
  id: TrainingBlockId | string;
  name: string;
}

export interface Exercise {
  id: string;
  clientId?: string;
  blockId: string;
  name: string;
  updatedAt?: string; // ISO string
  deletedAt?: string | null; // ISO string
  syncStatus?: SyncStatus;
  version?: number;
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
  clientId?: string;
  exerciseId: string;
  weight: number;
  reps: number;
  createdAt: string; // ISO string
  updatedAt?: string; // ISO string
  deletedAt?: string | null; // ISO string
  syncStatus?: SyncStatus;
  version?: number;
  isBodyweight?: boolean;
  distanceKm?: number | null;
  durationMin?: number | null;
  pauseSec?: number | null;
  setType?: 'weighted' | 'bodyweight' | 'cardio';
}

export interface CardioEntry {
  id: string;
  clientId?: string;
  exerciseId: string;
  distanceKm: number | null;
  durationMin: number | null;
  avgHeartRate?: number | null;
  intensity?: 'easy' | 'moderate' | 'hard' | null;
  note?: string | null;
  silentMode?: boolean | null;
  createdAt: string; // ISO string
  updatedAt?: string; // ISO string
  deletedAt?: string | null; // ISO string
  syncStatus?: SyncStatus;
  version?: number;
}

export interface ActiveWorkoutSession {
  startedAtISO: string;
  finishedAtISO?: string;
}

// IMPORTANT:
// AppState is treated as immutable across the app.
// Never mutate AppState directly; always return new objects/arrays.
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
  theme?: ThemeMode; // persisted theme mode (Home uses darkBlue/calmLight; legacy dark/light allowed on load)
  language?: AppLanguage;
  massUnit?: 'kg' | 'lb';

  // Treningsdata
  blocks: TrainingBlock[];
  exercises: Exercise[];
  sets: SetEntry[];
  cardioEntries: CardioEntry[];
  activeWorkout?: ActiveWorkoutSession | null;
  logs?: LogEntry[];
  notes?: NoteEntry[];
  sync?: SyncState;
}
