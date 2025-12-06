import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, TrainingBlock } from '../types';

const STORAGE_KEY = 'treasy_app_state_v2';

// Standard muskelgrupper som alltid skal finnes
const DEFAULT_BLOCKS: TrainingBlock[] = [
  { id: 'chest',     name: 'Bryst' },
  { id: 'shoulders', name: 'Skuldre' },
  { id: 'back',      name: 'Rygg' },
  { id: 'arms',      name: 'Armer' },
  { id: 'core',      name: 'Core' },
  { id: 'legs',      name: 'Bein' },
];

export function createInitialState(email: string): AppState {
  return {
    userEmail: email,
    nickname: null,
    heightCm: null,
    weightKg: null,
    theme: 'dark',
    blocks: DEFAULT_BLOCKS,
    exercises: [],
    sets: [],
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
      blocks: mergedBlocks,
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
