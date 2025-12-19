import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, TrainingBlock, AuthProvider, AppLanguage } from '../types';

const STORAGE_KEY = 'treasy_app_state_v2';

// Standard muskelgrupper som alltid skal finnes
const DEFAULT_BLOCKS: TrainingBlock[] = [
  { id: 'chest',     name: 'Bryst' },
  { id: 'shoulders', name: 'Skuldre' },
  { id: 'back',      name: 'Rygg' },
  { id: 'arms',      name: 'Armer' },
  { id: 'core',      name: 'Core' },
  { id: 'cardio',    name: 'Cardio' },
  { id: 'legs',      name: 'Bein' },
];

function generateUserId(): string {
  return `user_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

function guessDeviceLanguage(): AppLanguage {
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
    theme: 'dark',
    language,
    blocks: DEFAULT_BLOCKS,
    exercises: [],
    sets: [],
    logs: [],
  };
}

export async function loadAppState(): Promise<AppState | null> {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEY);
    if (!json) {
      return null;
    }

    const parsed = JSON.parse(json) as AppState;

    // Sørg for at nye standardblokker (Armer/Core) legges til
    const existingIds = new Set(parsed.blocks.map((b) => b.id));
    const mergedBlocks: TrainingBlock[] = [
      ...parsed.blocks,
      ...DEFAULT_BLOCKS.filter((b) => !existingIds.has(b.id)),
    ];

    return {
      ...parsed,
      userId: parsed.userId ?? generateUserId(),
      onboarded:
        parsed.onboarded ??
        Boolean(parsed.userEmail || parsed.exercises?.length || parsed.sets?.length),
      authProvider: parsed.authProvider ?? (parsed.userEmail ? 'email' : 'guest'),
      language: parsed.language ?? guessDeviceLanguage(),
      blocks: mergedBlocks,
      logs: parsed.logs ?? [],
      theme: parsed.theme ?? 'dark',
    };
  } catch (e) {
    console.warn('Failed to load app state', e);
    return null;
  }
}

export async function saveAppState(state: AppState): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Failed to save app state', e);
  }
}
