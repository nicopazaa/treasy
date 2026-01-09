import { useMemo } from 'react';
import type { AppState } from '../../features/workouts/model/types';
import { buildDerivedCache, type DerivedCache } from './derivedCache';

// Memoized derived indexes for fast O(1) lookups in the app composition layer.
// Important: This should be used mostly in App/actions to avoid pushing extra props into screens.
export function useDerivedCache(state: AppState): DerivedCache {
  return useMemo(() => buildDerivedCache(state), [state]);
}

