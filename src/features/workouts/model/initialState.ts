import type { AppLanguage, AuthProvider } from '../../../shared/types';
import type { AppState, TrainingBlock } from '../../../domain/workouts/types';
import { now } from '../../../shared/time';
import { createStableId } from '../../../shared/utils/id';
import { createEmptySyncState } from '../../../shared/utils/syncQueue';

// Standard muskelgrupper som alltid skal finnes
export const DEFAULT_BLOCKS: TrainingBlock[] = [
  { id: 'chest',     name: 'Bryst' },
  { id: 'shoulders', name: 'Skuldre' },
  { id: 'back',      name: 'Rygg' },
  { id: 'arms',      name: 'Armer' },
  { id: 'core',      name: 'Core' },
  { id: 'legs',      name: 'Bein' },
  { id: 'cardio',    name: 'Cardio' },
  { id: 'bodyweight', name: 'Kroppsvekt' },
];

export function generateUserId(): string {
  return createStableId('user', now());
}

export function guessDeviceLanguage(): AppLanguage {
  try {
    const locale =
      (typeof navigator !== 'undefined' && navigator.language) ||
      Intl.DateTimeFormat().resolvedOptions().locale ||
      'en';

    const lower = locale.toLowerCase();
    if (lower.startsWith('nb') || lower.startsWith('no') || lower.startsWith('nn')) {
      return 'nb';
    }
    if (lower.startsWith('es')) {
      return 'es';
    }
    return 'en';
  } catch {
    return 'en';
  }
}

export function createInitialState(options?: {
  userEmail?: string | null;
  onboarded?: boolean;
  authProvider?: AuthProvider;
  language?: AppLanguage;
}): AppState {
  const userEmail = options?.userEmail ?? null;
  const onboarded = options?.onboarded ?? false;
  const authProvider: AuthProvider = options?.authProvider ?? (userEmail ? 'email' : 'guest');
  const language = options?.language ?? guessDeviceLanguage();

  return {
    userId: generateUserId(),
    onboarded,
    authProvider,
    userEmail,
    nickname: null,
    heightCm: null,
    weightKg: null,
    theme: 'darkBlue',
    language,
    massUnit: 'kg',
    blocks: DEFAULT_BLOCKS,
    exercises: [],
    sets: [],
    cardioEntries: [],
    activeWorkout: null,
    logs: [],
    notes: [],
    sync: createEmptySyncState(),
  };
}
