import type { AppState, SetEntry, TrainingBlockId } from '../workouts/types';

export type MuscleBlockId = Exclude<TrainingBlockId, 'cardio'>;

export type MomentumStatus = 'up' | 'stable' | 'down';

export type WorkoutTimelineItem = {
  dateKey: string;
  dominantBlockId: string | null;
  exerciseCount: number;
  setCount: number;
};

type DateRange = { start: Date; end: Date };

const DAY_MS = 86400000;

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addDaysUtc(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

function toDateKey(iso: string): string {
  return iso.slice(0, 10);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function getLastDaysRangesUtc(
  days: number,
  now: Date = new Date()
): { current: DateRange; previous: DateRange } {
  const end = addDaysUtc(startOfUtcDay(now), 1); // exclusive end (tomorrow 00:00 UTC)
  const current: DateRange = { start: addDaysUtc(end, -days), end };
  const previous: DateRange = { start: addDaysUtc(end, -2 * days), end: addDaysUtc(end, -days) };
  return { current, previous };
}

export function getWorkoutsInRange(appState: AppState, startDate: Date, endDate: Date): SetEntry[] {
  const start = startDate.getTime();
  const end = endDate.getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) return [];

  return appState.sets.filter((s) => {
    const ts = new Date(s.createdAt).getTime();
    return Number.isFinite(ts) && ts >= start && ts < end;
  });
}

export function countSessions(sets: SetEntry[]): number {
  const keys = new Set<string>();
  for (const s of sets) {
    if (!s.createdAt) continue;
    keys.add(toDateKey(s.createdAt));
  }
  return keys.size;
}

export function calcTotalVolume(sets: SetEntry[]): number {
  let total = 0;
  for (const s of sets) {
    if (!isFiniteNumber(s.weight) || !isFiniteNumber(s.reps)) continue;
    if (s.weight < 0 || s.reps <= 0) continue;
    total += s.weight * s.reps;
  }
  return total;
}

export function calcVolumeByMuscle(
  appState: AppState,
  sets: SetEntry[],
  muscleIds: string[]
): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const id of muscleIds) totals[id] = 0;

  const exerciseToBlock = new Map(appState.exercises.map((ex) => [ex.id, ex.blockId] as const));
  const allowed = new Set(muscleIds);

  for (const s of sets) {
    if (!isFiniteNumber(s.weight) || !isFiniteNumber(s.reps)) continue;
    if (s.weight < 0 || s.reps <= 0) continue;

    const blockId = exerciseToBlock.get(s.exerciseId);
    if (!blockId || !allowed.has(blockId)) continue;
    totals[blockId] += s.weight * s.reps;
  }

  return totals;
}

export function calcChangeRatio(current: number, previous: number): number {
  const safePrev = Math.max(previous, 1);
  return (current - previous) / safePrev;
}

export function calcPctChange(
  current: number,
  previous: number,
  options?: { clampAbs?: number }
): number {
  const raw = calcChangeRatio(current, previous) * 100;
  if (!Number.isFinite(raw)) return 0;
  const clampAbs = options?.clampAbs;
  if (!clampAbs) return raw;
  return Math.max(-clampAbs, Math.min(clampAbs, raw));
}

export function getMomentumStatus(params: {
  sessions7d: number;
  sessionsPrev7d: number;
  volume7d: number;
  volumePrev7d: number;
}): MomentumStatus {
  const freqDelta = params.sessions7d - params.sessionsPrev7d;
  const volPct = calcChangeRatio(params.volume7d, params.volumePrev7d);

  if (volPct > 0.05 || freqDelta >= 1) return 'up';
  if (volPct < -0.05 && freqDelta <= -1) return 'down';
  return 'stable';
}

export function buildWorkoutTimeline(appState: AppState, options?: { limit?: number }): WorkoutTimelineItem[] {
  const exerciseToBlock = new Map(appState.exercises.map((ex) => [ex.id, ex.blockId] as const));

  const byDay = new Map<
    string,
    {
      exerciseIds: Set<string>;
      setCount: number;
      volumeByBlock: Map<string, number>;
    }
  >();

  for (const s of appState.sets) {
    const key = s.createdAt ? toDateKey(s.createdAt) : '';
    if (!key) continue;

    const day = byDay.get(key) ?? { exerciseIds: new Set<string>(), setCount: 0, volumeByBlock: new Map() };
    day.setCount += 1;
    day.exerciseIds.add(s.exerciseId);

    const blockId = exerciseToBlock.get(s.exerciseId);
    if (blockId && isFiniteNumber(s.weight) && isFiniteNumber(s.reps) && s.weight >= 0 && s.reps > 0) {
      const vol = s.weight * s.reps;
      day.volumeByBlock.set(blockId, (day.volumeByBlock.get(blockId) ?? 0) + vol);
    }

    byDay.set(key, day);
  }

  const items: WorkoutTimelineItem[] = Array.from(byDay.entries()).map(([dateKey, day]) => {
    let dominantBlockId: string | null = null;
    let bestVol = 0;
    for (const [blockId, vol] of day.volumeByBlock.entries()) {
      if (vol > bestVol) {
        bestVol = vol;
        dominantBlockId = blockId;
      }
    }

    return {
      dateKey,
      dominantBlockId,
      exerciseCount: day.exerciseIds.size,
      setCount: day.setCount,
    };
  });

  items.sort((a, b) => (a.dateKey < b.dateKey ? 1 : -1));
  const limit = options?.limit ?? 5;
  return items.slice(0, Math.max(0, limit));
}
