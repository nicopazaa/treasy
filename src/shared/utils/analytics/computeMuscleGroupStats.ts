import type { AppState, SetEntry } from '../../../domain/workouts/types';
import { calcPctChange, calcVolumeByMuscle } from '../../../domain/analytics/insights';

export type MuscleGroupStat = {
  id: string;
  volume7d: number;
  volumePrev7d: number;
  pctChange: number;
};

export function computeMuscleGroupStats(
  appState: AppState,
  sets7d: SetEntry[],
  setsPrev7d: SetEntry[],
  muscleIds: string[]
): MuscleGroupStat[] {
  const current = calcVolumeByMuscle(appState, sets7d, muscleIds);
  const previous = calcVolumeByMuscle(appState, setsPrev7d, muscleIds);

  return muscleIds.map((id) => {
    const volume7d = current[id] ?? 0;
    const volumePrev7d = previous[id] ?? 0;
    const pctChange = calcPctChange(volume7d, volumePrev7d, { clampAbs: 999 });
    return { id, volume7d, volumePrev7d, pctChange };
  });
}

export function pickTopMuscleGroup(stats: MuscleGroupStat[], order: string[]): string | null {
  let bestId: string | null = null;
  let bestVolume = 0;

  for (const id of order) {
    const stat = stats.find((s) => s.id === id);
    const vol = stat?.volume7d ?? 0;
    if (bestId == null || vol > bestVolume) {
      bestId = id;
      bestVolume = vol;
    }
  }

  return bestVolume > 0 ? bestId : null;
}
