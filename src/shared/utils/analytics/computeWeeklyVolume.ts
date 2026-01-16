import type { AppState } from '../../../domain/workouts/types';

export type WeeklySummary = {
  index: number; // 0 = most recent 7 days
  start: Date; // inclusive
  end: Date; // exclusive
  volumeKg: number;
  sessions: number; // unique UTC days with sets
};

const DAY_MS = 86400000;
const WEEK_DAYS = 7;
const WEEK_MS = WEEK_DAYS * DAY_MS;

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addDaysUtc(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

function toUtcDayKey(iso: string): string {
  return String(iso ?? '').slice(0, 10);
}

export function computeWeeklyVolumeUtc(appState: AppState, weeks: number, now: Date = new Date()): WeeklySummary[] {
  const safeWeeks = Math.max(0, Math.floor(weeks));
  if (safeWeeks === 0) return [];

  const end = addDaysUtc(startOfUtcDay(now), 1); // exclusive end (tomorrow 00:00 UTC)
  const endMs = end.getTime();
  const startMs = endMs - safeWeeks * WEEK_MS;

  const buckets: Array<{ volume: number; dayKeys: Set<string> }> = Array.from({ length: safeWeeks }, () => ({
    volume: 0,
    dayKeys: new Set<string>(),
  }));

  for (const set of appState.sets) {
    if (!set?.createdAt) continue;

    const ts = new Date(set.createdAt).getTime();
    if (!Number.isFinite(ts) || ts < startMs || ts >= endMs) continue;

    const diff = endMs - ts;
    if (!Number.isFinite(diff) || diff <= 0) continue;

    const weekIndex = Math.floor((diff - 1) / WEEK_MS); // include start boundary in the newer bucket
    if (weekIndex < 0 || weekIndex >= safeWeeks) continue;

    const bucket = buckets[weekIndex];
    bucket.dayKeys.add(toUtcDayKey(set.createdAt));

    if (Number.isFinite(set.weight) && Number.isFinite(set.reps) && set.weight >= 0 && set.reps > 0) {
      bucket.volume += set.weight * set.reps;
    }
  }

  const out: WeeklySummary[] = [];
  for (let index = 0; index < safeWeeks; index += 1) {
    const weekEnd = addDaysUtc(end, -index * WEEK_DAYS);
    const weekStart = addDaysUtc(weekEnd, -WEEK_DAYS);
    out.push({
      index,
      start: weekStart,
      end: weekEnd,
      volumeKg: buckets[index].volume,
      sessions: buckets[index].dayKeys.size,
    });
  }

  return out;
}

