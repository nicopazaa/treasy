import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppState, TrainingBlock } from '../model/types';
import { DEFAULT_BLOCKS, generateUserId, guessDeviceLanguage } from '../model/initialState';

const STORAGE_KEY = 'treasy_app_state_v2';

export async function loadAppState(): Promise<AppState | null> {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEY);
    if (!json) {
      return null;
    }

    const parsed = JSON.parse(json) as AppState;

    // SA,rg for at nye standardblokker (Armer/Core) legges til
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
      notes: parsed.notes ?? [],
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
