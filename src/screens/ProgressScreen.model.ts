import type { AppLanguage } from '../shared/types';
import type { TrainingBlock, TrainingBlockId } from '../features/workouts';
import { formatRelativeDateTime, formatShortDate } from '../shared/utils/dateLabels';
import { blockLabel, t, type StringKey } from '../shared/i18n/i18n';
import { formatWeight, type MassUnit } from '../shared/utils/units';

export type TimeRange = 'all' | '90d' | '30d' | '14d' | '7d';
export type Metric = 'weight' | 'oneRm' | 'volume' | 'reps';
export type Aggregation = 'auto' | 'day' | 'week' | 'month' | 'year';
export type ChartAggregation = Exclude<Aggregation, 'auto'>;
export type TileVariant = 'primary' | 'secondary';

export const RANGE_LABEL_KEY: Record<TimeRange, StringKey> = {
  all: 'progress.range.all',
  '90d': 'progress.range.90d',
  '30d': 'progress.range.30d',
  '14d': 'progress.range.14d',
  '7d': 'progress.range.7d',
};

export const RANGE_LONG_LABEL_KEY: Record<TimeRange, StringKey> = {
  all: 'progress.rangeLong.all',
  '90d': 'progress.rangeLong.90d',
  '30d': 'progress.rangeLong.30d',
  '14d': 'progress.rangeLong.14d',
  '7d': 'progress.rangeLong.7d',
};

export const AGGREGATION_LABEL_KEY: Record<Aggregation, StringKey> = {
  auto: 'progress.aggregation.auto',
  day: 'progress.aggregation.day',
  week: 'progress.aggregation.week',
  month: 'progress.aggregation.month',
  year: 'progress.aggregation.year',
};

export const CHART_AXIS_WIDTH = 56;
export const CHART_HEIGHT = 140;
export const CHART_X_PADDING = 10;
export const CHART_Y_PADDING_TOP = 12;
export const CHART_Y_PADDING_BOTTOM = 12;
export const CHART_POINT_SIZE = 8;
export const CHART_LINE_THICKNESS = 1;
export const CHART_TREND_LINE_THICKNESS = 2;
export const CHART_TREND_ALPHA = 0.34;

export const INSIGHTS_TREND_WINDOW_DAYS = 14;
export const INSIGHTS_FALLBACK_SESSIONS = 5;
export const FEEDBACK_WINDOW_SETS = 4;
export const PLATEAU_WINDOW_SETS = 6;

export const MAIN_BLOCK_ORDER: TrainingBlockId[] = ['chest', 'shoulders', 'back', 'arms', 'core', 'legs'];
export const MODE_BLOCK_IDS: TrainingBlockId[] = ['cardio', 'bodyweight'];
export const VALID_BLOCK_IDS = new Set<string>([...MAIN_BLOCK_ORDER, ...MODE_BLOCK_IDS]);

export interface SetRow {
  id: string;
  createdAtMs: number;
  dateLabel: string;
  dateTimeLabel: string;
  weight: number;
  reps: number;
  oneRm: number;
  volume: number;
  volumeUsesWeight: boolean;
  setLabel: string;
}

export type NextTarget =
  | { kind: 'reps'; next: number; progress: number; diff: number }
  | { kind: 'weight'; nextKg: number; progress: number; diffKg: number };

export type RecentPerformanceSnapshot = {
  baselineMetric: number;
  latestMetric: number;
  deltaMetric: number;
  deltaPct: number;
  baselineReps: number;
  latestReps: number;
};

export type InstantFeedback = {
  tone: 'up' | 'stable' | 'down';
  title: string;
  detail: string;
  accent: string;
};

export type NextSetSuggestion = {
  title: string;
  detail: string;
  accent: string;
};

export type PlateauInsight = {
  level: 'plateau' | 'regression';
  title: string;
  detail: string;
  actionPrimary: string;
  actionSecondary: string;
  accent: string;
};

export interface ChartRow {
  id: string;
  createdAtMs: number;
  dateLabel: string;
  weightMax: number;
  oneRmMax: number;
  volumeSum: number;
  repsSum: number;
  bestSet: SetRow | null;
}

export type ChartPoint = {
  id: string;
  row: ChartRow;
  x: number;
  y: number;
  value: number;
};

export type TrendPoint = {
  id: string;
  x: number;
  y: number;
};

export function metricValueSet(row: SetRow, metric: Metric): number {
  if (metric === 'oneRm') return row.oneRm;
  if (metric === 'reps') return row.reps;
  if (metric === 'volume') return row.volume;
  return row.weight;
}

export function metricValueChart(row: ChartRow, metric: Metric): number {
  if (metric === 'oneRm') return row.oneRmMax;
  if (metric === 'reps') return row.repsSum;
  if (metric === 'volume') return row.volumeSum;
  return row.weightMax;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function formatSignedInteger(value: number): string {
  const rounded = Math.round(value);
  if (rounded > 0) return `+${rounded}`;
  return String(rounded);
}

export function computeEwma(values: number[], alpha: number): number[] {
  if (values.length === 0) return [];
  const safeAlpha = Number.isFinite(alpha) ? clamp(alpha, 0.05, 0.95) : 0.3;
  const smoothed: number[] = [];
  let prev = values[0] ?? 0;
  for (let index = 0; index < values.length; index += 1) {
    const current = values[index] ?? prev;
    prev = index === 0 ? current : prev + safeAlpha * (current - prev);
    smoothed.push(prev);
  }
  return smoothed;
}

export function splitLabelParentheses(label: string): { main: string; parentheses: string | null } {
  const idx = label.indexOf('(');
  if (idx <= 0) return { main: label, parentheses: null };
  const main = label.slice(0, idx).trimEnd();
  const parentheses = label.slice(idx).trim();
  return parentheses.startsWith('(') && parentheses.length > 0 ? { main, parentheses } : { main: label, parentheses: null };
}

export function localeForLanguage(language: AppLanguage): string {
  if (language === 'nb') return 'nb-NO';
  if (language === 'es') return 'es-ES';
  return 'en-US';
}

export function formatChartTick(
  language: AppLanguage,
  value: number,
  metric: Metric,
  massUnit: MassUnit,
  volumeUsesWeight: boolean
): string {
  if (!Number.isFinite(value)) return '';
  if (metric === 'reps' || (metric === 'volume' && !volumeUsesWeight)) {
    return String(Math.round(value));
  }
  const maximumFractionDigits = massUnit === 'lb' ? 0 : 1;
  try {
    const nf = new Intl.NumberFormat(localeForLanguage(language), {
      maximumFractionDigits,
      minimumFractionDigits: 0,
    });
    return nf.format(value);
  } catch {
    return maximumFractionDigits === 0 ? String(Math.round(value)) : String(value);
  }
}

export function formatDateTime(date: Date, language: AppLanguage): string {
  const time = date.toLocaleTimeString(localeForLanguage(language), {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${formatShortDate(date)} ${time}`;
}

export function formatSetLabel(
  weightKg: number,
  reps: number,
  isBodyweight: boolean,
  massUnit: MassUnit,
  language: AppLanguage
): string {
  if (isBodyweight || weightKg === 0) {
    return `${reps} ${t(language, 'reps')}`;
  }
  return `${formatWeight(weightKg, massUnit, language)} x ${reps} ${t(language, 'reps')}`;
}

export function formatMetricLabel(language: AppLanguage, metric: Metric): string {
  if (metric === 'oneRm') return t(language, 'oneRm');
  if (metric === 'volume') return t(language, 'analysis.volume.title');
  if (metric === 'reps') return t(language, 'reps');
  return t(language, 'weight');
}

export function formatMetricValue(
  value: number,
  metric: Metric,
  massUnit: MassUnit,
  language: AppLanguage,
  volumeUsesWeight: boolean
): string {
  if (!Number.isFinite(value)) return '';
  if (metric === 'reps') return `${Math.round(value)} ${t(language, 'reps')}`;
  if (metric === 'volume' && !volumeUsesWeight) return `${Math.round(value)} ${t(language, 'reps')}`;
  return formatWeight(value, massUnit, language);
}

export function niceStep(rawStep: number, candidates: number[]): number {
  if (!Number.isFinite(rawStep) || rawStep <= 0) return 1;
  const exp = Math.floor(Math.log10(rawStep));
  const base = Math.pow(10, exp);
  const fraction = rawStep / base;

  let best = candidates[candidates.length - 1] ?? 1;
  for (const candidate of candidates) {
    if (fraction <= candidate) {
      best = candidate;
      break;
    }
  }
  return best * base;
}

export function makeTicks(minValue: number, maxValue: number, step: number): number[] {
  const res: number[] = [];
  if (!Number.isFinite(minValue) || !Number.isFinite(maxValue) || !Number.isFinite(step) || step <= 0) return res;
  const roundedStep = Number(step.toFixed(10));
  const maxIter = 200;
  let value = minValue;
  let iter = 0;
  while (value <= maxValue + roundedStep * 0.5 && iter < maxIter) {
    res.push(Number(value.toFixed(10)));
    value += roundedStep;
    iter += 1;
  }
  return res;
}

export function buildAxis(
  values: number[],
  desiredTickCount: number,
  candidates: number[]
): { min: number; max: number; ticks: number[] } {
  const finite = values.filter((value) => Number.isFinite(value));
  if (finite.length === 0) return { min: 0, max: 1, ticks: [0, 1] };

  let min = Math.min(...finite);
  let max = Math.max(...finite);

  if (min === max) {
    const pad = min === 0 ? 1 : Math.max(1, Math.abs(min) * 0.1);
    min -= pad;
    max += pad;
  }

  const range = max - min;
  const rawStep = range / Math.max(1, desiredTickCount - 1);
  let step = niceStep(rawStep, candidates);
  if (!Number.isFinite(step) || step <= 0) step = 1;

  let axisMin = Math.floor(min / step) * step;
  let axisMax = Math.ceil(max / step) * step;
  let ticks = makeTicks(axisMin, axisMax, step);

  while (ticks.length > desiredTickCount + 2) {
    step *= 2;
    axisMin = Math.floor(min / step) * step;
    axisMax = Math.ceil(max / step) * step;
    ticks = makeTicks(axisMin, axisMax, step);
  }

  if (ticks.length < 2) {
    return { min, max, ticks: [min, max] };
  }

  return { min: axisMin, max: axisMax, ticks };
}

export function yForChartValue(value: number, axisMin: number, axisMax: number): number {
  if (axisMax === axisMin) return CHART_Y_PADDING_TOP + (CHART_HEIGHT - CHART_Y_PADDING_TOP - CHART_Y_PADDING_BOTTOM) / 2;
  const tValue = (value - axisMin) / (axisMax - axisMin);
  const inner = CHART_HEIGHT - CHART_Y_PADDING_TOP - CHART_Y_PADDING_BOTTOM;
  return CHART_Y_PADDING_TOP + (1 - tValue) * inner;
}

export function xForChartTime(timestampMs: number, minMs: number, maxMs: number, width: number): number {
  const innerWidth = Math.max(1, width - CHART_X_PADDING * 2);
  if (maxMs === minMs) return CHART_X_PADDING + innerWidth / 2;
  const tValue = (timestampMs - minMs) / (maxMs - minMs);
  return CHART_X_PADDING + tValue * innerWidth;
}

export function timeForChartX(x: number, minMs: number, maxMs: number, width: number): number {
  const innerWidth = Math.max(1, width - CHART_X_PADDING * 2);
  if (maxMs === minMs) return minMs;
  const clampedX = clamp(x - CHART_X_PADDING, 0, innerWidth);
  const tValue = clampedX / innerWidth;
  return minMs + tValue * (maxMs - minMs);
}

export function daysForRange(range: TimeRange): number | null {
  if (range === '7d') return 7;
  if (range === '14d') return 14;
  if (range === '30d') return 30;
  if (range === '90d') return 90;
  return null;
}

export function weightStep(unit: MassUnit): number {
  return unit === 'lb' ? 5 : 2.5;
}

export function estimateOneRm(weight: number, reps: number): number {
  if (reps <= 1) return weight;
  const est = weight * (1 + reps / 30);
  return Math.round(est * 10) / 10;
}

export function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function bucketStartMs(timestampMs: number, aggregation: ChartAggregation): number {
  const date = new Date(timestampMs);
  if (aggregation === 'year') return new Date(date.getFullYear(), 0, 1).getTime();
  if (aggregation === 'month') return new Date(date.getFullYear(), date.getMonth(), 1).getTime();
  if (aggregation === 'week') {
    const copy = new Date(date);
    const day = copy.getDay();
    const diff = (day + 6) % 7;
    copy.setHours(0, 0, 0, 0);
    copy.setDate(copy.getDate() - diff);
    return copy.getTime();
  }
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function formatAggregationLabel(date: Date, aggregation: ChartAggregation, language: AppLanguage): string {
  if (aggregation === 'year') return String(date.getFullYear());
  if (aggregation === 'month') {
    try {
      return date.toLocaleDateString(localeForLanguage(language), { month: 'short', year: '2-digit' });
    } catch {
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = String(date.getFullYear()).slice(-2);
      return `${month}/${year}`;
    }
  }
  if (aggregation === 'week') return formatShortDate(date);
  return formatShortDate(date);
}

export function pickBestSet(current: SetRow | null, candidate: SetRow): SetRow {
  if (!current) return candidate;
  if (candidate.oneRm > current.oneRm) return candidate;
  if (candidate.oneRm < current.oneRm) return current;
  if (candidate.weight > current.weight) return candidate;
  if (candidate.weight < current.weight) return current;
  if (candidate.reps > current.reps) return candidate;
  if (candidate.reps < current.reps) return current;
  return candidate.createdAtMs > current.createdAtMs ? candidate : current;
}

export function aggregateChartRows(rows: SetRow[], aggregation: ChartAggregation, language: AppLanguage): ChartRow[] {
  const buckets = new Map<string, ChartRow>();

  for (const row of rows) {
    const bucketMs = bucketStartMs(row.createdAtMs, aggregation);
    const key = String(bucketMs);
    const existing = buckets.get(key);

    if (!existing) {
      buckets.set(key, {
        id: `${bucketMs}`,
        createdAtMs: bucketMs,
        dateLabel: '',
        weightMax: row.weight,
        oneRmMax: row.oneRm,
        volumeSum: row.volume,
        repsSum: row.reps,
        bestSet: row,
      });
      continue;
    }

    existing.weightMax = Math.max(existing.weightMax, row.weight);
    existing.oneRmMax = Math.max(existing.oneRmMax, row.oneRm);
    existing.volumeSum += row.volume;
    existing.repsSum += row.reps;
    existing.bestSet = pickBestSet(existing.bestSet, row);
  }

  const aggregated = Array.from(buckets.values()).map((row) => ({
    ...row,
    dateLabel: formatAggregationLabel(new Date(row.createdAtMs), aggregation, language),
  }));

  aggregated.sort((left, right) => left.createdAtMs - right.createdAtMs);
  return aggregated;
}

export function findNearestRow(rows: ChartRow[], targetMs: number): ChartRow | null {
  if (rows.length === 0) return null;
  let lo = 0;
  let hi = rows.length - 1;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const value = rows[mid].createdAtMs;
    if (value === targetMs) return rows[mid];
    if (value < targetMs) lo = mid + 1;
    else hi = mid - 1;
  }
  const before = rows[Math.max(0, hi)];
  const after = rows[Math.min(rows.length - 1, lo)];
  if (!before) return after;
  if (!after) return before;
  return Math.abs(before.createdAtMs - targetMs) <= Math.abs(after.createdAtMs - targetMs) ? before : after;
}

export function clampViewport(
  startMs: number,
  endMs: number,
  minMs: number,
  maxMs: number,
  minWindowMs: number
): { startMs: number; endMs: number } {
  let windowMs = Math.max(minWindowMs, endMs - startMs);
  const maxWindow = Math.max(1, maxMs - minMs);
  if (windowMs > maxWindow) windowMs = maxWindow;

  let nextStart = startMs;
  let nextEnd = nextStart + windowMs;
  if (nextStart < minMs) {
    nextStart = minMs;
    nextEnd = nextStart + windowMs;
  }
  if (nextEnd > maxMs) {
    nextEnd = maxMs;
    nextStart = nextEnd - windowMs;
  }
  return { startMs: nextStart, endMs: nextEnd };
}

export function labelForBlock(block: TrainingBlock, language: AppLanguage): string {
  const id = block.id as TrainingBlockId;
  if (['chest', 'shoulders', 'back', 'arms', 'core', 'legs', 'bodyweight'].includes(id)) {
    return blockLabel(id, language);
  }
  return block.name;
}

const OTHER_BLOCK_NAMES = new Set(['annet', 'other', 'otro']);

export function normalizeBlockName(value: string): string {
  return value.trim().toLowerCase();
}

export function isOtherBlock(block: TrainingBlock): boolean {
  const id = String(block.id ?? '').toLowerCase();
  if (id === 'other') return true;
  const name = normalizeBlockName(block.name ?? '');
  return OTHER_BLOCK_NAMES.has(name);
}

export function buildSetRow(
  params: {
    createdAt: string;
    weight: number;
    reps: number;
    isBodyweight: boolean;
    bodyweightKg: number;
    massUnit: MassUnit;
    language: AppLanguage;
    id: string;
  }
): SetRow {
  const date = new Date(params.createdAt);
  const createdAtMs = date.getTime();
  const dateLabel = formatRelativeDateTime(date, new Date(), params.language);
  const dateTimeLabel = formatDateTime(date, params.language);
  const usesBodyweight = params.isBodyweight && params.bodyweightKg > 0;
  const volumeUsesWeight = params.weight > 0 || usesBodyweight;
  const baseWeightKg = params.weight > 0 ? params.weight : usesBodyweight ? params.bodyweightKg : 0;
  const volume = baseWeightKg > 0 ? baseWeightKg * params.reps : params.reps;
  const setLabel = formatSetLabel(params.weight, params.reps, params.isBodyweight, params.massUnit, params.language);
  return {
    id: params.id,
    createdAtMs,
    dateLabel,
    dateTimeLabel,
    weight: params.weight,
    reps: params.reps,
    oneRm: estimateOneRm(params.weight, params.reps),
    volume,
    volumeUsesWeight,
    setLabel,
  };
}
