import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  FlatList,
  Platform,
  LayoutAnimation,
  PanResponder,
  Image,
  ImageSourcePropType,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppLanguage } from '../shared/types';
import type { AppState, TrainingBlock, Exercise, SetEntry, TrainingBlockId } from '../features/workouts';
import { getBlockTone, getDotColor } from '../shared/theme/blockTone';
import { formatRelativeDateTime, formatShortDate } from '../shared/utils/dateLabels';
import { SPACING, TEXT, RADIUS, SCREEN_PADDING, COLORS } from '../shared/theme/tokens';
import { blockLabel, t, type StringKey } from '../shared/i18n/i18n';
import { formatExerciseLabel } from '../shared/utils/exerciseLabel';
import { formatWeight, fromKg, roundForDisplay, toKg, type MassUnit } from '../shared/utils/units';
import { now } from '../shared/time';
import { useBackSwipeContext } from '../app/navigation/BackSwipeContext';
import { BLOCK_ICON_SOURCES } from '../shared/ui/blockIcons';

interface Props {
  appState: AppState;
  onBack: () => void;
}

type TimeRange = 'all' | '90d' | '30d' | '14d' | '7d';
type Metric = 'weight' | 'oneRm' | 'volume' | 'reps';
type Aggregation = 'auto' | 'day' | 'week' | 'month' | 'year';
type ChartAggregation = Exclude<Aggregation, 'auto'>;
type TileVariant = 'primary' | 'secondary';

const RANGE_LABEL_KEY: Record<TimeRange, StringKey> = {
  all: 'progress.range.all',
  '90d': 'progress.range.90d',
  '30d': 'progress.range.30d',
  '14d': 'progress.range.14d',
  '7d': 'progress.range.7d',
};

const RANGE_LONG_LABEL_KEY: Record<TimeRange, StringKey> = {
  all: 'progress.rangeLong.all',
  '90d': 'progress.rangeLong.90d',
  '30d': 'progress.rangeLong.30d',
  '14d': 'progress.rangeLong.14d',
  '7d': 'progress.rangeLong.7d',
};

const AGGREGATION_LABEL_KEY: Record<Aggregation, StringKey> = {
  auto: 'progress.aggregation.auto',
  day: 'progress.aggregation.day',
  week: 'progress.aggregation.week',
  month: 'progress.aggregation.month',
  year: 'progress.aggregation.year',
};

const CHART_AXIS_WIDTH = 56;
const CHART_HEIGHT = 140;
const CHART_X_PADDING = 10;
const CHART_Y_PADDING_TOP = 12;
const CHART_Y_PADDING_BOTTOM = 12;
const CHART_POINT_SIZE = 8;
const CHART_LINE_THICKNESS = 1;
const CHART_TREND_LINE_THICKNESS = 2;
const CHART_TREND_ALPHA = 0.34;

const INSIGHTS_TREND_WINDOW_DAYS = 14;
const INSIGHTS_FALLBACK_SESSIONS = 5;
const FEEDBACK_WINDOW_SETS = 4;
const PLATEAU_WINDOW_SETS = 6;

const MAIN_BLOCK_ORDER: TrainingBlockId[] = ['chest', 'shoulders', 'back', 'arms', 'core', 'legs'];
const MODE_BLOCK_IDS: TrainingBlockId[] = ['cardio', 'bodyweight'];
const VALID_BLOCK_IDS = new Set<string>([...MAIN_BLOCK_ORDER, ...MODE_BLOCK_IDS]);

interface SetRow {
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

type NextTarget =
  | { kind: 'reps'; next: number; progress: number; diff: number }
  | { kind: 'weight'; nextKg: number; progress: number; diffKg: number };

type RecentPerformanceSnapshot = {
  baselineMetric: number;
  latestMetric: number;
  deltaMetric: number;
  deltaPct: number;
  baselineReps: number;
  latestReps: number;
};

type InstantFeedback = {
  tone: 'up' | 'stable' | 'down';
  title: string;
  detail: string;
  accent: string;
};

type NextSetSuggestion = {
  title: string;
  detail: string;
  accent: string;
};

type PlateauInsight = {
  level: 'plateau' | 'regression';
  title: string;
  detail: string;
  actionPrimary: string;
  actionSecondary: string;
  accent: string;
};

interface ChartRow {
  id: string;
  createdAtMs: number;
  dateLabel: string;
  weightMax: number;
  oneRmMax: number;
  volumeSum: number;
  repsSum: number;
  bestSet: SetRow | null;
}

type ChartPoint = {
  id: string;
  row: ChartRow;
  x: number;
  y: number;
  value: number;
};

type TrendPoint = {
  id: string;
  x: number;
  y: number;
};

function metricValueSet(row: SetRow, metric: Metric): number {
  if (metric === 'oneRm') return row.oneRm;
  if (metric === 'reps') return row.reps;
  if (metric === 'volume') return row.volume;
  return row.weight;
}

function metricValueChart(row: ChartRow, metric: Metric): number {
  if (metric === 'oneRm') return row.oneRmMax;
  if (metric === 'reps') return row.repsSum;
  if (metric === 'volume') return row.volumeSum;
  return row.weightMax;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatSignedInteger(value: number): string {
  const rounded = Math.round(value);
  if (rounded > 0) return `+${rounded}`;
  return String(rounded);
}

function computeEwma(values: number[], alpha: number): number[] {
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

function splitLabelParentheses(label: string): { main: string; parentheses: string | null } {
  const idx = label.indexOf('(');
  if (idx <= 0) return { main: label, parentheses: null };
  const main = label.slice(0, idx).trimEnd();
  const parentheses = label.slice(idx).trim();
  return parentheses.startsWith('(') && parentheses.length > 0 ? { main, parentheses } : { main: label, parentheses: null };
}

function localeForLanguage(language: AppLanguage): string {
  if (language === 'nb') return 'nb-NO';
  if (language === 'es') return 'es-ES';
  return 'en-US';
}

function formatChartTick(
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

function formatDateTime(date: Date, language: AppLanguage): string {
  const time = date.toLocaleTimeString(localeForLanguage(language), {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${formatShortDate(date)} ${time}`;
}

function formatSetLabel(
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

function formatMetricLabel(language: AppLanguage, metric: Metric): string {
  if (metric === 'oneRm') return t(language, 'oneRm');
  if (metric === 'volume') return t(language, 'analysis.volume.title');
  if (metric === 'reps') return t(language, 'reps');
  return t(language, 'weight');
}

function formatMetricValue(
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

function niceStep(rawStep: number, candidates: number[]): number {
  if (!Number.isFinite(rawStep) || rawStep <= 0) return 1;
  const exp = Math.floor(Math.log10(rawStep));
  const base = Math.pow(10, exp);
  const fraction = rawStep / base;

  let best = candidates[candidates.length - 1] ?? 1;
  for (const c of candidates) {
    if (fraction <= c) {
      best = c;
      break;
    }
  }
  return best * base;
}

function makeTicks(minValue: number, maxValue: number, step: number): number[] {
  const res: number[] = [];
  if (!Number.isFinite(minValue) || !Number.isFinite(maxValue) || !Number.isFinite(step) || step <= 0) return res;
  const roundedStep = Number(step.toFixed(10));
  const maxIter = 200;
  let v = minValue;
  let iter = 0;
  while (v <= maxValue + roundedStep * 0.5 && iter < maxIter) {
    res.push(Number(v.toFixed(10)));
    v += roundedStep;
    iter += 1;
  }
  return res;
}

function buildAxis(values: number[], desiredTickCount: number, candidates: number[]): { min: number; max: number; ticks: number[] } {
  const finite = values.filter((v) => Number.isFinite(v));
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

function yForChartValue(value: number, axisMin: number, axisMax: number): number {
  if (axisMax === axisMin) return CHART_Y_PADDING_TOP + (CHART_HEIGHT - CHART_Y_PADDING_TOP - CHART_Y_PADDING_BOTTOM) / 2;
  const t = (value - axisMin) / (axisMax - axisMin);
  const inner = CHART_HEIGHT - CHART_Y_PADDING_TOP - CHART_Y_PADDING_BOTTOM;
  return CHART_Y_PADDING_TOP + (1 - t) * inner;
}

function xForChartTime(timestampMs: number, minMs: number, maxMs: number, width: number): number {
  const innerWidth = Math.max(1, width - CHART_X_PADDING * 2);
  if (maxMs === minMs) return CHART_X_PADDING + innerWidth / 2;
  const t = (timestampMs - minMs) / (maxMs - minMs);
  return CHART_X_PADDING + t * innerWidth;
}

function timeForChartX(x: number, minMs: number, maxMs: number, width: number): number {
  const innerWidth = Math.max(1, width - CHART_X_PADDING * 2);
  if (maxMs === minMs) return minMs;
  const clampedX = clamp(x - CHART_X_PADDING, 0, innerWidth);
  const t = clampedX / innerWidth;
  return minMs + t * (maxMs - minMs);
}

function daysForRange(range: TimeRange): number | null {
  if (range === '7d') return 7;
  if (range === '14d') return 14;
  if (range === '30d') return 30;
  if (range === '90d') return 90;
  return null;
}

function weightStep(unit: MassUnit): number {
  return unit === 'lb' ? 5 : 2.5;
}

function estimateOneRm(weight: number, reps: number): number {
  if (reps <= 1) return weight;
  const est = weight * (1 + reps / 30);
  return Math.round(est * 10) / 10;
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function bucketStartMs(timestampMs: number, aggregation: ChartAggregation): number {
  const date = new Date(timestampMs);
  if (aggregation === 'year') return new Date(date.getFullYear(), 0, 1).getTime();
  if (aggregation === 'month') return new Date(date.getFullYear(), date.getMonth(), 1).getTime();
  if (aggregation === 'week') {
    const copy = new Date(date);
    const day = copy.getDay(); // 0 = Sun
    const diff = (day + 6) % 7; // Monday start
    copy.setHours(0, 0, 0, 0);
    copy.setDate(copy.getDate() - diff);
    return copy.getTime();
  }
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function formatAggregationLabel(date: Date, aggregation: ChartAggregation, language: AppLanguage): string {
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

function pickBestSet(current: SetRow | null, candidate: SetRow): SetRow {
  if (!current) return candidate;
  if (candidate.oneRm > current.oneRm) return candidate;
  if (candidate.oneRm < current.oneRm) return current;
  if (candidate.weight > current.weight) return candidate;
  if (candidate.weight < current.weight) return current;
  if (candidate.reps > current.reps) return candidate;
  if (candidate.reps < current.reps) return current;
  return candidate.createdAtMs > current.createdAtMs ? candidate : current;
}

function aggregateChartRows(rows: SetRow[], aggregation: ChartAggregation, language: AppLanguage): ChartRow[] {
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

  aggregated.sort((a, b) => a.createdAtMs - b.createdAtMs);
  return aggregated;
}

function findNearestRow(rows: ChartRow[], targetMs: number): ChartRow | null {
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

function clampViewport(
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

function labelForBlock(block: TrainingBlock, language: AppLanguage): string {
  const id = block.id as TrainingBlockId;
  if (['chest', 'shoulders', 'back', 'arms', 'core', 'legs', 'bodyweight'].includes(id)) {
    return blockLabel(id, language);
  }
  return block.name;
}

const OTHER_BLOCK_NAMES = new Set(['annet', 'other', 'otro']);

function normalizeBlockName(value: string): string {
  return value.trim().toLowerCase();
}

function isOtherBlock(block: TrainingBlock): boolean {
  const id = String(block.id ?? '').toLowerCase();
  if (id === 'other') return true;
  const name = normalizeBlockName(block.name ?? '');
  return OTHER_BLOCK_NAMES.has(name);
}

type SelectableTileProps = {
  label: string;
  subtitle?: string | null;
  accent: string;
  selected: boolean;
  variant?: TileVariant;
  onPress: () => void;
};

type MuscleGroupTileProps = {
  label: string;
  accent: string;
  dotColor: string;
  icon?: ImageSourcePropType | null;
  selected: boolean;
  onPress: () => void;
};

type IconModeButtonProps = {
  label: string;
  icon?: ImageSourcePropType | null;
  accent: string;
  selected: boolean;
  onPress: () => void;
};

const SelectableTile: React.FC<SelectableTileProps> = ({
  label,
  subtitle,
  accent,
  selected,
  variant = 'primary',
  onPress,
}) => {
  const isExerciseCard = variant === 'secondary';
  const splitLabel = isExerciseCard ? splitLabelParentheses(label) : null;
  const showSplitLabel = Boolean(splitLabel?.parentheses);
  const selectedBg = isExerciseCard
    ? selected
      ? hexToRgba(accent, 0.24)
      : '#0D1A31'
    : selected
      ? hexToRgba(accent, 0.2)
      : '#0A152A';
  const borderColor = selected ? hexToRgba(accent, 0.72) : 'rgba(148, 163, 184, 0.2)';
  const glowColor = selected ? accent : '#081226';
  const dotOpacity = variant === 'primary' ? 1 : selected ? 0.95 : 0.72;
  const exerciseMainTextColor = selected ? '#F8FBFF' : '#D7E6FF';
  const exerciseSubTextColor = selected ? '#BFD9FF' : '#8EA5C6';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        variant === 'secondary' ? styles.tileSecondary : null,
        { backgroundColor: selectedBg, borderColor, shadowColor: glowColor },
        selected ? styles.tileSelected : null,
        pressed ? styles.tilePressed : null,
      ]}
    >
      <View style={styles.tileDotWrap}>
        <View style={[styles.tileDot, { backgroundColor: accent, opacity: dotOpacity }]} />
      </View>
      <View style={styles.tileText}>
        {variant === 'secondary' && showSplitLabel ? (
          <View style={styles.tileLabelColumn}>
            <Text
              style={[styles.tileLabelSecondaryMain, { color: exerciseMainTextColor }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {splitLabel?.main ?? label}
            </Text>
            <Text
              style={[styles.tileLabelSecondaryParen, { color: exerciseSubTextColor }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {splitLabel?.parentheses}
            </Text>
          </View>
        ) : (
          <Text
            style={[
              styles.tileLabel,
              variant === 'secondary' ? styles.tileLabelSecondary : null,
              selected && variant !== 'secondary' ? styles.tileLabelSelected : null,
              variant === 'secondary' ? { color: exerciseMainTextColor } : null,
            ]}
            numberOfLines={1}
          >
            {label}
          </Text>
        )}
        {subtitle ? (
          <Text
            style={[
              styles.tileSubtitle,
              variant === 'secondary' ? styles.tileSubtitleSecondary : null,
              selected && variant !== 'secondary' ? styles.tileSubtitleSelected : null,
              variant === 'secondary' ? { color: exerciseSubTextColor } : null,
            ]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Text
        style={[
          styles.tileChevron,
          variant === 'secondary' ? styles.tileChevronSecondary : null,
          variant === 'secondary'
            ? { color: selected ? accent : '#79A5D9', opacity: 1 }
            : { opacity: selected ? 1 : 0.4 },
        ]}
      >
        {'>'}
      </Text>
    </Pressable>
  );
};

const MuscleGroupTile: React.FC<MuscleGroupTileProps> = ({
  label,
  accent,
  dotColor,
  icon,
  selected,
  onPress,
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.timing(scaleAnim, {
      toValue: 0.97,
      duration: 120,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.timing(scaleAnim, {
      toValue: 1,
      duration: 140,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);

  const selectedBg = selected ? hexToRgba(accent, 0.2) : '#09162C';
  const borderColor = selected ? hexToRgba(accent, 0.62) : 'rgba(148, 163, 184, 0.22)';
  const glowColor = selected ? accent : '#09162C';
  const iconBorderColor = selected ? hexToRgba(accent, 0.5) : 'rgba(148, 163, 184, 0.24)';
  const iconBgColor = selected ? hexToRgba(accent, 0.16) : 'rgba(148, 163, 184, 0.08)';

  return (
    <Pressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut}>
      <Animated.View
        style={[
          styles.groupTile,
          { backgroundColor: selectedBg, borderColor, shadowColor: glowColor, transform: [{ scale: scaleAnim }] },
          selected ? styles.groupTileSelected : null,
        ]}
      >
        <View style={[styles.groupTileDot, { backgroundColor: dotColor }]} />
        <Text style={[styles.groupTileText, selected ? styles.groupTileTextSelected : null]} numberOfLines={1}>
          {label}
        </Text>
        <View style={[styles.groupTileIconWrap, { borderColor: iconBorderColor, backgroundColor: iconBgColor }]}>
          {icon ? (
            <Image source={icon} style={styles.groupTileIcon} resizeMode="contain" tintColor={selected ? '#F8FBFF' : '#B8CCEA'} />
          ) : (
            <View style={[styles.groupTileFallbackDot, { backgroundColor: accent }]} />
          )}
        </View>
      </Animated.View>
    </Pressable>
  );
};

const IconModeButton: React.FC<IconModeButtonProps> = ({ label, icon, accent, selected, onPress }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const handlePressIn = useCallback(() => {
    Animated.timing(scaleAnim, {
      toValue: 0.96,
      duration: 120,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);
  const handlePressOut = useCallback(() => {
    Animated.timing(scaleAnim, {
      toValue: 1,
      duration: 140,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim]);
  const webTooltipProps = Platform.OS === 'web' ? ({ title: label } as any) : {};
  const ringColor = selected ? hexToRgba(accent, 0.7) : 'rgba(148, 163, 184, 0.2)';
  const fillColor = selected ? hexToRgba(accent, 0.2) : '#0B1220';
  return (
    <View style={styles.modeButtonWrap}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole="button"
        accessibilityLabel={label}
        hitSlop={12}
        {...webTooltipProps}
      >
        <Animated.View
          style={[
            styles.modeButton,
            {
              borderColor: ringColor,
              borderWidth: selected ? 2 : 1,
              backgroundColor: fillColor,
              shadowColor: selected ? accent : '#0B1220',
              transform: [{ scale: scaleAnim }],
            },
            selected ? styles.modeButtonSelected : null,
          ]}
        >
          {icon ? (
            <Image
              source={icon}
              style={styles.modeButtonIcon}
              resizeMode="contain"
              tintColor={selected ? accent : '#93C5FD'}
            />
          ) : (
            <View style={[styles.groupTileFallbackDot, { backgroundColor: accent }]} />
          )}
        </Animated.View>
      </Pressable>
      <Text style={styles.modeButtonLabel}>{label}</Text>
    </View>
  );
};

export const ProgressScreen: React.FC<Props> = ({ appState, onBack }) => {
  const language = appState.language ?? 'en';
  const massUnit = appState.massUnit ?? 'kg';
  const backSwipeContext = useBackSwipeContext();
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(() => {
    const preferred =
      MAIN_BLOCK_ORDER.find((id) => appState.blocks.some((block) => block.id === id)) ?? MAIN_BLOCK_ORDER[0];
    return preferred ?? null;
  });
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('all');
  const [aggregation, setAggregation] = useState<Aggregation>('auto');
  const [metric, setMetric] = useState<Metric>('weight');
  const [chartWidth, setChartWidth] = useState(0);
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [isTrayOpen, setIsTrayOpen] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const [viewport, setViewport] = useState<{ startMs: number; endMs: number } | null>(null);
  const viewportRef = useRef<{ startMs: number; endMs: number } | null>(null);
  const gestureRef = useRef<{
    mode: 'pan' | 'pinch';
    startViewport: { startMs: number; endMs: number };
    startDistance: number;
  } | null>(null);
  const chartContainerRef = useRef<View>(null);
  const chartMeasureRaf = useRef<number | null>(null);
  const insightsAnim = useRef(new Animated.Value(0)).current;
  const trayAnim = useRef(new Animated.Value(0)).current;

  const primaryBlocks = useMemo<TrainingBlock[]>(() => {
    const byId = new Map<string, TrainingBlock>(appState.blocks.map((block) => [block.id, block]));
    return MAIN_BLOCK_ORDER.map((id) => byId.get(id) ?? { id, name: blockLabel(id, language) });
  }, [appState.blocks, language]);
  const selectedBlock = useMemo(
    () => primaryBlocks.find((block) => block.id === selectedBlockId) ?? null,
    [primaryBlocks, selectedBlockId]
  );
  const selectedBlockTone = getBlockTone(selectedBlockId ?? '');

  const registerChartBlocker = useCallback(() => {
    if (!backSwipeContext || Platform.OS === 'web') return;
    if (!chartContainerRef.current?.measureInWindow) return;
    chartContainerRef.current.measureInWindow((x, y, width, height) => {
      if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;
      backSwipeContext.registerBlocker('progressChart', { x, y, width, height });
    });
  }, [backSwipeContext]);

  const scheduleChartBlockerMeasure = useCallback(() => {
    if (!backSwipeContext || Platform.OS === 'web') return;
    if (chartMeasureRaf.current != null) return;
    chartMeasureRaf.current = requestAnimationFrame(() => {
      chartMeasureRaf.current = null;
      registerChartBlocker();
    });
  }, [backSwipeContext, registerChartBlocker]);

  useEffect(() => {
    return () => {
      backSwipeContext?.unregisterBlocker('progressChart');
      if (chartMeasureRaf.current != null) {
        cancelAnimationFrame(chartMeasureRaf.current);
        chartMeasureRaf.current = null;
      }
    };
  }, [backSwipeContext]);

  const exercises = useMemo(() => {
    if (!selectedBlockId) return [] as Exercise[];
    return appState.exercises.filter((e) => e.blockId === selectedBlockId) as Exercise[];
  }, [appState.exercises, selectedBlockId]);

  const insightsInsertAfterIndex = useMemo(() => {
    if (!selectedExerciseId) return null;
    const idx = exercises.findIndex((e) => e.id === selectedExerciseId);
    if (idx < 0) return null;
    if (idx % 2 === 0 && idx + 1 < exercises.length) return idx + 1;
    return idx;
  }, [exercises, selectedExerciseId]);

  const fallbackBlockId = useMemo(() => {
    const preferred = MAIN_BLOCK_ORDER.find((id) => appState.blocks.some((block) => block.id === id)) ?? MAIN_BLOCK_ORDER[0];
    return preferred ?? null;
  }, [appState.blocks]);

  useEffect(() => {
    if (!fallbackBlockId) return;
    if (!selectedBlockId) {
      setSelectedBlockId(fallbackBlockId);
      setSelectedExerciseId(null);
      return;
    }
    if (!VALID_BLOCK_IDS.has(selectedBlockId) || selectedBlockId === 'other') {
      setSelectedBlockId(fallbackBlockId);
      setSelectedExerciseId(null);
      return;
    }
    const selectedBlock = appState.blocks.find((block) => block.id === selectedBlockId);
    if (selectedBlock && isOtherBlock(selectedBlock)) {
      setSelectedBlockId(fallbackBlockId);
      setSelectedExerciseId(null);
    }
  }, [appState.blocks, fallbackBlockId, selectedBlockId]);

  const exerciseSummaries = useMemo(() => {
    const summaries = new Map<string, string>();
    if (exercises.length === 0) return summaries;
    const bestLabel = t(language, 'progress.best1rm');
    const lastLabel = t(language, 'progress.latest');
    const repsLabel = t(language, 'reps');

    for (const ex of exercises) {
      const sets = appState.sets.filter((s) => s.exerciseId === ex.id && s.setType !== 'cardio');
      if (sets.length === 0) continue;

      let bestOneRm: number | null = null;
      let lastSet: SetEntry | null = null;
      let lastMs = -Infinity;

      for (const set of sets) {
        const createdAtMs = new Date(set.createdAt).getTime();
        if (createdAtMs > lastMs) {
          lastMs = createdAtMs;
          lastSet = set;
        }
        if (set.weight > 0 && set.reps > 0) {
          const est = estimateOneRm(set.weight, set.reps);
          if (bestOneRm == null || est > bestOneRm) bestOneRm = est;
        }
      }

      if (bestOneRm != null) {
        summaries.set(ex.id, `${bestLabel}: ${formatWeight(bestOneRm, massUnit, language)}`);
        continue;
      }

      if (!lastSet) continue;
      const isBodyweight = lastSet.isBodyweight || lastSet.setType === 'bodyweight' || lastSet.weight === 0;
      const lastValue = isBodyweight
        ? `${lastSet.reps} ${repsLabel}`
        : `${formatWeight(lastSet.weight, massUnit, language)} x ${lastSet.reps}`;
      summaries.set(ex.id, `${lastLabel}: ${lastValue}`);
    }

    return summaries;
  }, [appState.sets, exercises, language, massUnit]);


  const bodyweightKg = appState.weightKg ?? 0;
  const repsLabel = t(language, 'reps');

  const setRows: SetRow[] = useMemo(() => {
    if (!selectedExerciseId) return [];

    const setsForExercise = appState.sets
      .filter((s) => s.exerciseId === selectedExerciseId)
      .sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1)) as SetEntry[];

    return setsForExercise.map((s) => {
      const date = new Date(s.createdAt);
      const createdAtMs = date.getTime();
      const dateLabel = formatRelativeDateTime(date, new Date(), language);
      const dateTimeLabel = formatDateTime(date, language);
      const isBodyweight = s.isBodyweight || s.setType === 'bodyweight' || s.weight === 0;
      const usesBodyweight = isBodyweight && bodyweightKg > 0;
      const volumeUsesWeight = s.weight > 0 || usesBodyweight;
      const baseWeightKg = s.weight > 0 ? s.weight : usesBodyweight ? bodyweightKg : 0;
      const volume = baseWeightKg > 0 ? baseWeightKg * s.reps : s.reps;
      const setLabel = formatSetLabel(s.weight, s.reps, isBodyweight, massUnit, language);
      return {
        id: s.id,
        createdAtMs,
        dateLabel,
        dateTimeLabel,
        weight: s.weight,
        reps: s.reps,
        oneRm: estimateOneRm(s.weight, s.reps),
        volume,
        volumeUsesWeight,
        setLabel,
      };
    });
  }, [appState.sets, bodyweightKg, language, massUnit, selectedExerciseId]);

  const hasWeightData = setRows.some((row) => row.weight > 0);
  const volumeUsesWeight = useMemo(() => setRows.some((row) => row.volumeUsesWeight), [setRows]);

  useEffect(() => {
    if (!selectedExerciseId) return;

    if ((metric === 'weight' || metric === 'oneRm') && !hasWeightData) {
      setMetric('reps');
    }
  }, [hasWeightData, metric, selectedExerciseId]);

  const metricOptions = useMemo(() => {
    const options: Array<{ key: Metric; label: string }> = [];
    if (hasWeightData) {
      options.push({ key: 'weight', label: t(language, 'weight') });
      options.push({ key: 'oneRm', label: t(language, 'oneRm') });
    }
    options.push({ key: 'volume', label: t(language, 'analysis.volume.title') });
    options.push({ key: 'reps', label: t(language, 'reps') });
    return options;
  }, [hasWeightData, language]);

  useEffect(() => {
    if (!selectedExerciseId) return;
    if (metricOptions.length === 0) return;
    if (!metricOptions.some((opt) => opt.key === metric)) {
      setMetric(metricOptions[0].key);
    }
  }, [metric, metricOptions, selectedExerciseId]);

  useEffect(() => {
    setSelectedPointId(null);
  }, [aggregation, metric, selectedExerciseId, timeRange]);

  const rowsInRange: SetRow[] = useMemo(() => {
    const days = daysForRange(timeRange);
    if (!days) return setRows;
    const cutoffMs = now() - days * 24 * 60 * 60 * 1000;
    return setRows.filter((row) => row.createdAtMs >= cutoffMs);
  }, [setRows, timeRange]);

  const resolvedAggregation: ChartAggregation = useMemo(() => {
    if (aggregation !== 'auto') return aggregation;
    if (rowsInRange.length < 2) return 'day';

    if (timeRange === '7d' || timeRange === '14d') return 'day';
    if (timeRange === '30d') return rowsInRange.length < 6 ? 'day' : 'week';
    if (timeRange === '90d') return rowsInRange.length < 10 ? 'month' : 'week';

    const spanMs = rowsInRange[rowsInRange.length - 1]!.createdAtMs - rowsInRange[0]!.createdAtMs;
    const twoYearsMs = 2 * 365 * 24 * 60 * 60 * 1000;
    return spanMs >= twoYearsMs ? 'year' : 'month';
  }, [aggregation, rowsInRange, timeRange]);

  const rowsVisible: ChartRow[] = useMemo(() => {
    return aggregateChartRows(rowsInRange, resolvedAggregation, language);
  }, [language, resolvedAggregation, rowsInRange]);

  const rowsChart: ChartRow[] = useMemo(() => {
    if (metric === 'weight') return rowsVisible.filter((row) => row.weightMax > 0);
    if (metric === 'oneRm') return rowsVisible.filter((row) => row.oneRmMax > 0);
    if (metric === 'volume') return rowsVisible.filter((row) => row.volumeSum > 0);
    return rowsVisible.filter((row) => row.repsSum > 0);
  }, [metric, rowsVisible]);

  useEffect(() => {
    if (!backSwipeContext) return;
    if (rowsChart.length === 0) {
      backSwipeContext.unregisterBlocker('progressChart');
    }
  }, [backSwipeContext, rowsChart.length]);

  const rowsChartRef = useRef<ChartRow[]>([]);

  useEffect(() => {
    rowsChartRef.current = rowsChart;
  }, [rowsChart]);

  const fullRange = useMemo(() => {
    if (rowsChart.length === 0) return null;
    return { minMs: rowsChart[0].createdAtMs, maxMs: rowsChart[rowsChart.length - 1].createdAtMs };
  }, [rowsChart]);

  const minWindowMs = useMemo(() => {
    if (!fullRange) return 0;
    const range = Math.max(1, fullRange.maxMs - fullRange.minMs);
    if (rowsChart.length < 2) return range;
    const gaps = rowsChart
      .slice(1)
      .map((row, idx) => row.createdAtMs - rowsChart[idx].createdAtMs)
      .filter((value) => value > 0);
    const minGap = gaps.length > 0 ? Math.min(...gaps) : range;
    return Math.max(minGap * 2, range * 0.05);
  }, [fullRange, rowsChart]);

  useEffect(() => {
    if (!fullRange) {
      setViewport(null);
      return;
    }
    setViewport({ startMs: fullRange.minMs, endMs: fullRange.maxMs });
  }, [fullRange]);

  useEffect(() => {
    if (viewport) {
      viewportRef.current = viewport;
      return;
    }
    if (fullRange) {
      viewportRef.current = { startMs: fullRange.minMs, endMs: fullRange.maxMs };
    } else {
      viewportRef.current = null;
    }
  }, [fullRange, viewport]);

  const viewRange = viewport ?? (fullRange ? { startMs: fullRange.minMs, endMs: fullRange.maxMs } : null);

  const viewportRows = useMemo(() => {
    if (!viewRange) return [] as ChartRow[];
    const filtered = rowsChart.filter(
      (row) => row.createdAtMs >= viewRange.startMs && row.createdAtMs <= viewRange.endMs
    );
    if (filtered.length > 0) return filtered;
    const nearest = findNearestRow(rowsChart, (viewRange.startMs + viewRange.endMs) / 2);
    return nearest ? [nearest] : [];
  }, [rowsChart, viewRange]);

  const chartValues = useMemo(() => {
    return viewportRows.map((row) => {
      const value = metricValueChart(row, metric);
      if (metric === 'reps' || (metric === 'volume' && !volumeUsesWeight)) return value;
      const raw = fromKg(value, massUnit);
      return roundForDisplay(raw, massUnit);
    });
  }, [massUnit, metric, volumeUsesWeight, viewportRows]);

  const chartAxisCandidates = useMemo(() => {
    if (metric === 'reps' || (metric === 'volume' && !volumeUsesWeight)) {
      return [1, 2, 5, 10];
    }
    if (massUnit === 'lb') return [1, 2, 5, 10];
    return [1, 2, 2.5, 5, 10];
  }, [massUnit, metric, volumeUsesWeight]);

  const chartAxis = useMemo(() => buildAxis(chartValues, 5, chartAxisCandidates), [chartAxisCandidates, chartValues]);

  const chartPoints = useMemo<ChartPoint[]>(() => {
    if (viewportRows.length === 0 || chartWidth <= 0 || !viewRange) return [];
    const minMs = viewRange.startMs;
    const maxMs = viewRange.endMs;
    return viewportRows.map((row, idx) => {
      const value = chartValues[idx] ?? 0;
      const x = xForChartTime(row.createdAtMs, minMs, maxMs, chartWidth);
      const y = yForChartValue(value, chartAxis.min, chartAxis.max);
      return { id: row.id, row, x, y, value };
    });
  }, [chartAxis.max, chartAxis.min, chartValues, chartWidth, viewRange, viewportRows]);

  const chartTrendValues = useMemo(() => computeEwma(chartValues, CHART_TREND_ALPHA), [chartValues]);

  const chartTrendPoints = useMemo<TrendPoint[]>(() => {
    if (viewportRows.length === 0 || chartWidth <= 0 || !viewRange) return [];
    const minMs = viewRange.startMs;
    const maxMs = viewRange.endMs;
    return viewportRows.map((row, idx) => {
      const value = chartTrendValues[idx] ?? chartValues[idx] ?? 0;
      const x = xForChartTime(row.createdAtMs, minMs, maxMs, chartWidth);
      const y = yForChartValue(value, chartAxis.min, chartAxis.max);
      return { id: `trend-${row.id}`, x, y };
    });
  }, [chartAxis.max, chartAxis.min, chartTrendValues, chartValues, chartWidth, viewRange, viewportRows]);

  const prPointIds = useMemo(() => {
    const ids = new Set<string>();
    let runningMax = Number.NEGATIVE_INFINITY;
    for (const point of chartPoints) {
      if (!Number.isFinite(point.value)) continue;
      if (point.value > runningMax + 1e-9) {
        ids.add(point.id);
        runningMax = point.value;
      }
    }
    return ids;
  }, [chartPoints]);

  const chartStartLabel = viewRange
    ? formatAggregationLabel(new Date(viewRange.startMs), resolvedAggregation, language)
    : '';
  const chartEndLabel = viewRange
    ? formatAggregationLabel(new Date(viewRange.endMs), resolvedAggregation, language)
    : '';
  const chartMetricLabel = formatMetricLabel(language, metric);
  const chartUnitLabel =
    metric === 'reps'
      ? t(language, 'reps')
      : metric === 'volume' && !volumeUsesWeight
        ? t(language, 'reps')
        : t(language, massUnit === 'lb' ? 'units.lb' : 'units.kg');

  const bestChartPointId = useMemo(() => {
    if (chartPoints.length === 0) return null;
    const maxValue = chartPoints.reduce((max, p) => Math.max(max, p.value), -Infinity);
    const bestPoints = chartPoints.filter((p) => p.value === maxValue);
    return bestPoints.length > 0 ? bestPoints[bestPoints.length - 1]?.id ?? null : null;
  }, [chartPoints]);

  const latestChartPointId = chartPoints.length > 0 ? chartPoints[chartPoints.length - 1]?.id ?? null : null;

  const selectedChartPoint = useMemo(() => {
    if (!selectedPointId) return null;
    return chartPoints.find((p) => p.id === selectedPointId) ?? null;
  }, [chartPoints, selectedPointId]);

  const chartTooltipStyle = useMemo(() => {
    if (!selectedChartPoint) return null;
    const tooltipWidth = 200;
    const tooltipHeight = 92;
    const left = clamp(selectedChartPoint.x - tooltipWidth / 2, 0, Math.max(0, chartWidth - tooltipWidth));
    const top = clamp(selectedChartPoint.y - tooltipHeight - 10, 0, CHART_HEIGHT - tooltipHeight);
    return { left, top, width: tooltipWidth, minHeight: tooltipHeight };
  }, [chartWidth, selectedChartPoint]);

  const latestVisible = rowsChart.length > 0 ? rowsChart[rowsChart.length - 1] : null;

  const bestVisible = useMemo(() => {
    if (rowsChart.length === 0) return null;
    return rowsChart.reduce(
      (best, row) => (metricValueChart(row, metric) > metricValueChart(best, metric) ? row : best),
      rowsChart[0]
    );
  }, [metric, rowsChart]);

  const isFullRange = useMemo(() => {
    if (!viewRange || !fullRange) return true;
    return viewRange.startMs === fullRange.minMs && viewRange.endMs === fullRange.maxMs;
  }, [fullRange, viewRange]);

  const selectNearestAtX = (x: number, range: { startMs: number; endMs: number }) => {
    const availableRows = rowsChartRef.current;
    if (availableRows.length === 0 || chartWidth <= 0) return;
    const targetMs = timeForChartX(x, range.startMs, range.endMs, chartWidth);
    const nearest = findNearestRow(availableRows, targetMs);
    if (nearest) setSelectedPointId(nearest.id);
  };

  const applyZoom = (
    scale: number,
    anchorX?: number,
    baseRange?: { startMs: number; endMs: number }
  ) => {
    if (!fullRange || chartWidth <= 0) return null;
    const base = baseRange ?? viewportRef.current ?? { startMs: fullRange.minMs, endMs: fullRange.maxMs };
    const windowMs = Math.max(1, base.endMs - base.startMs);
    const nextWindow = clamp(windowMs * scale, Math.max(1, minWindowMs), fullRange.maxMs - fullRange.minMs);
    const anchorTime =
      anchorX != null ? timeForChartX(anchorX, base.startMs, base.endMs, chartWidth) : base.startMs + windowMs / 2;
    const anchorRatio = windowMs > 0 ? (anchorTime - base.startMs) / windowMs : 0.5;
    const nextStart = anchorTime - anchorRatio * nextWindow;
    const nextEnd = nextStart + nextWindow;
    const clamped = clampViewport(nextStart, nextEnd, fullRange.minMs, fullRange.maxMs, minWindowMs);
    setViewport(clamped);
    return clamped;
  };

  const handleZoomIn = () => {
    applyZoom(0.75);
  };

  const handleZoomOut = () => {
    applyZoom(1.35);
  };

  const handleResetZoom = () => {
    if (!fullRange) return;
    setViewport({ startMs: fullRange.minMs, endMs: fullRange.maxMs });
  };

  // Enable timeline scrub + pinch zoom without introducing inner scroll views.
  const panResponder = useMemo(() => {
    return PanResponder.create({
      onStartShouldSetPanResponder: (evt) => {
        if (!fullRange) return false;
        return evt.nativeEvent.touches.length > 0;
      },
      onMoveShouldSetPanResponder: (evt, gesture) => {
        if (!fullRange) return false;
        if (evt.nativeEvent.touches.length >= 2) return true;
        return Math.abs(gesture.dx) > Math.abs(gesture.dy) && Math.abs(gesture.dx) > 4;
      },
      onPanResponderGrant: (evt) => {
        if (!fullRange) return;
        const touches = evt.nativeEvent.touches;
        const startViewport = viewportRef.current ?? { startMs: fullRange.minMs, endMs: fullRange.maxMs };
        if (touches.length >= 2) {
          const dx = touches[0].locationX - touches[1].locationX;
          const dy = touches[0].locationY - touches[1].locationY;
          gestureRef.current = {
            mode: 'pinch',
            startViewport,
            startDistance: Math.sqrt(dx * dx + dy * dy),
          };
          const anchorX = (touches[0].locationX + touches[1].locationX) / 2;
          selectNearestAtX(anchorX, startViewport);
          return;
        }
        gestureRef.current = { mode: 'pan', startViewport, startDistance: 0 };
        const anchorX = touches[0]?.locationX ?? 0;
        selectNearestAtX(anchorX, startViewport);
      },
      onPanResponderMove: (evt, gesture) => {
        if (!fullRange || chartWidth <= 0) return;
        const state = gestureRef.current;
        if (!state) return;
        const touches = evt.nativeEvent.touches;
        if (state.mode === 'pinch' && touches.length >= 2) {
          const dx = touches[0].locationX - touches[1].locationX;
          const dy = touches[0].locationY - touches[1].locationY;
          const distance = Math.sqrt(dx * dx + dy * dy) || 1;
          const scale = state.startDistance > 0 ? state.startDistance / distance : 1;
          const anchorX = (touches[0].locationX + touches[1].locationX) / 2;
          const next = applyZoom(scale, anchorX, state.startViewport);
          if (next) selectNearestAtX(anchorX, next);
          return;
        }
        if (state.mode === 'pan') {
          const innerWidth = Math.max(1, chartWidth - CHART_X_PADDING * 2);
          const windowMs = Math.max(1, state.startViewport.endMs - state.startViewport.startMs);
          const deltaMs = (gesture.dx / innerWidth) * windowMs;
          const nextStart = state.startViewport.startMs - deltaMs;
          const nextEnd = nextStart + windowMs;
          const next = clampViewport(nextStart, nextEnd, fullRange.minMs, fullRange.maxMs, minWindowMs);
          setViewport(next);
          const anchorX = touches[0]?.locationX ?? 0;
          selectNearestAtX(anchorX, next);
        }
      },
      onPanResponderRelease: () => {
        gestureRef.current = null;
      },
      onPanResponderTerminate: () => {
        gestureRef.current = null;
      },
    });
  }, [chartWidth, fullRange, minWindowMs]);

  const handleWheel = (event: any) => {
    if (Platform.OS !== 'web') return;
    if (!fullRange) return;
    const deltaY = event?.nativeEvent?.deltaY ?? event?.deltaY ?? 0;
    if (!Number.isFinite(deltaY) || deltaY === 0) return;
    event?.preventDefault?.();
    const scale = deltaY > 0 ? 1.25 : 0.8;
    const anchorX = event?.nativeEvent?.offsetX ?? event?.nativeEvent?.locationX ?? 0;
    const next = applyZoom(scale, anchorX);
    if (next) selectNearestAtX(anchorX, next);
  };

  const chartWheelProps = Platform.OS === 'web' ? ({ onWheel: handleWheel } as any) : {};

  const selectedExercise = selectedExerciseId
    ? (appState.exercises.find((e) => e.id === selectedExerciseId) ?? null)
    : null;

  const latestOverall = setRows.length > 0 ? setRows[setRows.length - 1] : null;
  const prevOverall = setRows.length > 1 ? setRows[setRows.length - 2] : null;
  const firstOverall = setRows.length > 0 ? setRows[0] : null;

  const bestAll = useMemo(() => {
    return setRows.reduce((max, row) => Math.max(max, metricValueSet(row, metric)), 0);
  }, [metric, setRows]);

  const bestAllWeight = useMemo(() => setRows.reduce((max, row) => Math.max(max, row.weight), 0), [setRows]);
  const bestAllOneRm = useMemo(() => setRows.reduce((max, row) => Math.max(max, row.oneRm), 0), [setRows]);
  const bestAllReps = useMemo(() => setRows.reduce((max, row) => Math.max(max, row.reps), 0), [setRows]);

  const bestWeightSet = useMemo<SetRow | null>(() => {
    if (setRows.length === 0) return null;
    return setRows.reduce((best, row) => {
      if (row.weight > best.weight) return row;
      if (row.weight < best.weight) return best;
      if (row.reps > best.reps) return row;
      if (row.reps < best.reps) return best;
      return row.createdAtMs > best.createdAtMs ? row : best;
    }, setRows[0]);
  }, [setRows]);

  const deltaFromPrev = useMemo(() => {
    if (!latestOverall || !prevOverall) return null;
    return metricValueSet(latestOverall, metric) - metricValueSet(prevOverall, metric);
  }, [latestOverall, metric, prevOverall]);

  const deltaFromFirst = useMemo(() => {
    if (!latestOverall || !firstOverall) return null;
    return metricValueSet(latestOverall, metric) - metricValueSet(firstOverall, metric);
  }, [firstOverall, latestOverall, metric]);

  const changeLabelStyle =
    deltaFromPrev == null
      ? styles.kpiLabelNeutral
      : deltaFromPrev > 0
        ? styles.kpiLabelUp
        : deltaFromPrev < 0
          ? styles.kpiLabelDown
          : styles.kpiLabelNeutral;

  const target = useMemo<NextTarget | null>(() => {
    if (!latestOverall) return null;

    if (metric === 'reps') {
      const next = bestAllReps + 1;
      const progress = next > 0 ? Math.min(1, latestOverall.reps / next) : 0;
      return {
        kind: 'reps',
        next,
        progress,
        diff: Math.max(0, next - latestOverall.reps),
      };
    }

    const bestValue = metric === 'oneRm' ? bestAllOneRm : bestAllWeight;
    const stepKg = toKg(weightStep(massUnit), massUnit);
    const nextKg = bestValue + stepKg;
    const current = metric === 'oneRm' ? latestOverall.oneRm : latestOverall.weight;
    const progress = nextKg > 0 ? Math.min(1, current / nextKg) : 0;
    return {
      kind: 'weight',
      nextKg,
      progress,
      diffKg: Math.max(0, nextKg - current),
    };
  }, [bestAllOneRm, bestAllReps, bestAllWeight, latestOverall, massUnit, metric]);

  const insightsMetric: 'oneRm' | 'reps' = hasWeightData ? 'oneRm' : 'reps';

  const insightsProgression = useMemo(() => {
    if (!latestOverall || setRows.length < 2) return null;

    const cutoffMs = now() - INSIGHTS_TREND_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    const recent = setRows.filter((row) => row.createdAtMs >= cutoffMs);
    const windowRows = (recent.length >= 2 ? recent : setRows.slice(-INSIGHTS_FALLBACK_SESSIONS)).filter(Boolean);
    if (windowRows.length < 2) return null;

    const first = windowRows[0];
    const last = windowRows[windowRows.length - 1];
    if (!first || !last) return null;

    const firstValue = insightsMetric === 'oneRm' ? first.oneRm : first.reps;
    const lastValue = insightsMetric === 'oneRm' ? last.oneRm : last.reps;
    const delta = lastValue - firstValue;

    const positive = delta > 0;
    const negative = delta < 0;
    const accent = positive ? COLORS.success : negative ? COLORS.warning : COLORS.actionSecondary;

    const signedDelta =
      insightsMetric === 'oneRm'
        ? delta > 0
          ? `+${formatWeight(delta, massUnit, language)}`
          : formatWeight(delta, massUnit, language)
        : delta > 0
          ? `+${Math.round(delta)}`
          : `${Math.round(delta)}`;

    const windowText =
      recent.length >= 2
        ? t(language, 'progress.insight.progression.windowWeeks', { weeks: INSIGHTS_TREND_WINDOW_DAYS / 7 })
        : t(language, 'progress.insight.progression.windowSessions', { count: windowRows.length });
    const metricText = insightsMetric === 'oneRm' ? t(language, 'progress.insight.progression.metricOneRm') : t(language, 'reps');
    const detailText = `${metricText} ${windowText}`;

    let microcopy: string | null = null;
    if (positive) {
      let nonDecreasingSteps = 0;
      for (let i = 1; i < windowRows.length; i += 1) {
        const prev = windowRows[i - 1];
        const curr = windowRows[i];
        if (!prev || !curr) continue;
        const prevV = insightsMetric === 'oneRm' ? prev.oneRm : prev.reps;
        const currV = insightsMetric === 'oneRm' ? curr.oneRm : curr.reps;
        if (currV >= prevV) nonDecreasingSteps += 1;
      }
      const looksConsistent = windowRows.length >= 4 && nonDecreasingSteps >= windowRows.length - 2;
      microcopy = looksConsistent
        ? t(language, 'progress.insight.feedback.greatConsistency')
        : t(language, 'progress.insight.feedback.niceWork');
    } else if (!negative) {
      microcopy = windowRows.length >= 4 ? t(language, 'progress.insight.feedback.stableTrend') : null;
    }

    return {
      accent,
      deltaText: signedDelta,
      detailText,
      microcopy,
    };
  }, [language, latestOverall, massUnit, setRows, insightsMetric]);

  const insightsNewPr = useMemo(() => {
    if (!latestOverall || setRows.length < 2) return null;
    const latestValue = insightsMetric === 'oneRm' ? latestOverall.oneRm : latestOverall.reps;
    const prevBest = setRows.slice(0, -1).reduce((max, row) => {
      const v = insightsMetric === 'oneRm' ? row.oneRm : row.reps;
      return Math.max(max, v);
    }, -Infinity);

    if (!Number.isFinite(prevBest) || latestValue <= prevBest) return null;
    if (insightsMetric === 'oneRm') {
      return t(language, 'progress.insight.pr.newOneRm', {
        value: formatWeight(latestOverall.oneRm, massUnit, language),
        allTime: t(language, 'progress.allTime'),
      });
    }
    return t(language, 'progress.insight.pr.newReps', {
      value: latestOverall.reps,
      reps: t(language, 'reps'),
      allTime: t(language, 'progress.allTime'),
    });
  }, [insightsMetric, language, latestOverall, massUnit, setRows]);

  const insightsTarget = useMemo<NextTarget | null>(() => {
    if (!latestOverall) return null;

    if (insightsMetric === 'reps') {
      const next = bestAllReps + 1;
      const progress = next > 0 ? Math.min(1, latestOverall.reps / next) : 0;
      return {
        kind: 'reps',
        next,
        progress,
        diff: Math.max(0, next - latestOverall.reps),
      };
    }

    const bestValue = bestAllOneRm;
    const stepKg = toKg(weightStep(massUnit), massUnit);
    const nextKg = bestValue + stepKg;
    const current = latestOverall.oneRm;
    const progress = nextKg > 0 ? Math.min(1, current / nextKg) : 0;
    return {
      kind: 'weight',
      nextKg,
      progress,
      diffKg: Math.max(0, nextKg - current),
    };
  }, [bestAllOneRm, bestAllReps, insightsMetric, latestOverall, massUnit]);

  const recentPerformance = useMemo<RecentPerformanceSnapshot | null>(() => {
    if (!latestOverall || setRows.length < 2) return null;
    const recentWindow = setRows.slice(-FEEDBACK_WINDOW_SETS);
    const latest = recentWindow[recentWindow.length - 1];
    const baselineRows = recentWindow.slice(0, -1);
    if (!latest || baselineRows.length === 0) return null;

    const metricOf = (row: SetRow) => (insightsMetric === 'oneRm' ? row.oneRm : row.reps);
    const baselineMetric = average(baselineRows.map(metricOf));
    const latestMetric = metricOf(latest);
    const deltaMetric = latestMetric - baselineMetric;
    const deltaPct = baselineMetric > 0 ? deltaMetric / baselineMetric : 0;
    const baselineReps = average(baselineRows.map((row) => row.reps));

    return {
      baselineMetric,
      latestMetric,
      deltaMetric,
      deltaPct,
      baselineReps,
      latestReps: latest.reps,
    };
  }, [insightsMetric, latestOverall, setRows]);

  const instantFeedback = useMemo<InstantFeedback | null>(() => {
    if (!recentPerformance) return null;

    const rising =
      recentPerformance.deltaPct >= 0.025 ||
      (insightsMetric === 'oneRm' &&
        recentPerformance.deltaMetric >= Math.max(0.5, toKg(weightStep(massUnit), massUnit) * 0.35));
    const dropping = recentPerformance.deltaPct <= -0.02;

    const tone: InstantFeedback['tone'] = rising ? 'up' : dropping ? 'down' : 'stable';
    const accent = tone === 'up' ? COLORS.success : tone === 'down' ? COLORS.warning : COLORS.actionSecondary;
    const title = t(language, `progress.feedback.status.${tone}` as StringKey);

    const detail =
      insightsMetric === 'oneRm'
        ? t(language, 'progress.feedback.detail.oneRm', {
            diff:
              recentPerformance.deltaMetric >= 0
                ? `+${formatWeight(recentPerformance.deltaMetric, massUnit, language)}`
                : formatWeight(recentPerformance.deltaMetric, massUnit, language),
            baseline: formatWeight(recentPerformance.baselineMetric, massUnit, language),
          })
        : t(language, 'progress.feedback.detail.reps', {
            diff: formatSignedInteger(recentPerformance.deltaMetric),
            baseline: Math.max(0, Math.round(recentPerformance.baselineMetric)),
          });

    return { tone, title, detail, accent };
  }, [insightsMetric, language, massUnit, recentPerformance]);

  const nextSetSuggestion = useMemo<NextSetSuggestion | null>(() => {
    if (!latestOverall || !recentPerformance || !instantFeedback) return null;
    const tone = instantFeedback.tone;

    if (insightsMetric === 'oneRm' && latestOverall.weight > 0) {
      const stepKg = toKg(weightStep(massUnit), massUnit);
      if (tone === 'up' && latestOverall.reps >= Math.max(4, Math.round(recentPerformance.baselineReps))) {
        const nextWeightKg = latestOverall.weight + stepKg;
        return {
          title: t(language, 'progress.feedback.next.weightUp.title', {
            weight: formatWeight(nextWeightKg, massUnit, language),
          }),
          detail: t(language, 'progress.feedback.next.weightUp.detail', { reps: latestOverall.reps }),
          accent: COLORS.success,
        };
      }
      if (tone === 'down') {
        const downStepKg = Math.max(stepKg / 2, 0);
        const reducedWeightKg = Math.max(0, latestOverall.weight - downStepKg);
        return {
          title: t(language, 'progress.feedback.next.weightDown.title', {
            weight: formatWeight(reducedWeightKg, massUnit, language),
          }),
          detail: t(language, 'progress.feedback.next.weightDown.detail'),
          accent: COLORS.warning,
        };
      }

      return {
        title: t(language, 'progress.feedback.next.weightHold.title', {
          weight: formatWeight(latestOverall.weight, massUnit, language),
        }),
        detail: t(language, 'progress.feedback.next.weightHold.detail'),
        accent: COLORS.actionSecondary,
      };
    }

    if (tone === 'up') {
      return {
        title: t(language, 'progress.feedback.next.repsUp.title', { reps: latestOverall.reps + 1 }),
        detail: t(language, 'progress.feedback.next.repsUp.detail'),
        accent: COLORS.success,
      };
    }
    if (tone === 'down') {
      return {
        title: t(language, 'progress.feedback.next.repsHold.title', { reps: latestOverall.reps }),
        detail: t(language, 'progress.feedback.next.repsHold.detail'),
        accent: COLORS.warning,
      };
    }
    return {
      title: t(language, 'progress.feedback.next.repsNudge.title', { reps: latestOverall.reps + 1 }),
      detail: t(language, 'progress.feedback.next.repsNudge.detail'),
      accent: COLORS.actionSecondary,
    };
  }, [insightsMetric, instantFeedback, language, latestOverall, massUnit, recentPerformance]);

  const plateauInsight = useMemo<PlateauInsight | null>(() => {
    if (setRows.length < 4) return null;
    const windowRows = setRows.slice(-PLATEAU_WINDOW_SETS);
    if (windowRows.length < 4) return null;

    const values = windowRows.map((row) => (insightsMetric === 'oneRm' ? row.oneRm : row.reps));
    if (values.length < 4) return null;
    const first = values[0] ?? 0;
    const last = values[values.length - 1] ?? 0;
    if (!Number.isFinite(first) || !Number.isFinite(last)) return null;

    const deltaPct = first > 0 ? (last - first) / first : 0;
    let improvingSteps = 0;
    let decliningSteps = 0;
    for (let i = 1; i < values.length; i += 1) {
      const prev = values[i - 1] ?? 0;
      const current = values[i] ?? 0;
      if (current - prev > 0.001) improvingSteps += 1;
      if (current - prev < -0.001) decliningSteps += 1;
    }

    let runningMax = Number.NEGATIVE_INFINITY;
    let lastPrIndex = -1;
    for (let i = 0; i < values.length; i += 1) {
      const value = values[i] ?? Number.NEGATIVE_INFINITY;
      if (value > runningMax + 1e-9) {
        runningMax = value;
        lastPrIndex = i;
      }
    }
    const sessionsSincePr = lastPrIndex >= 0 ? values.length - 1 - lastPrIndex : 0;
    const plateau = Math.abs(deltaPct) < 0.012 && improvingSteps <= 1 && sessionsSincePr >= 3;
    const regression = deltaPct <= -0.035 && decliningSteps >= 3;
    if (!plateau && !regression) return null;

    if (regression) {
      return {
        level: 'regression',
        title: t(language, 'progress.feedback.plateau.regression.title'),
        detail: t(language, 'progress.feedback.plateau.regression.detail'),
        actionPrimary: t(language, 'progress.feedback.plateau.action.deload'),
        actionSecondary: t(language, 'progress.feedback.plateau.action.resetFatigue'),
        accent: COLORS.warning,
      };
    }

    return {
      level: 'plateau',
      title: t(language, 'progress.feedback.plateau.flat.title'),
      detail: t(language, 'progress.feedback.plateau.flat.detail', { count: sessionsSincePr }),
      actionPrimary: t(language, 'progress.feedback.plateau.action.repRange'),
      actionSecondary: t(language, 'progress.feedback.plateau.action.microload'),
      accent: COLORS.actionSecondary,
    };
  }, [insightsMetric, language, setRows]);

  useEffect(() => {
    setShowTable(false);
    setIsTrayOpen(false);
    trayAnim.setValue(0);
  }, [selectedExerciseId, trayAnim]);

  useEffect(() => {
    if (!selectedExerciseId) return;
    insightsAnim.setValue(0);
    Animated.timing(insightsAnim, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [insightsAnim, selectedExerciseId]);

  const animateNext = () => {
    if (Platform.OS !== 'web') {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
  };

  const controlsSummaryText = `${t(language, 'progress.controls.showing')} ${t(
    language,
    RANGE_LONG_LABEL_KEY[timeRange]
  )} | ${formatMetricLabel(language, metric)}`;

  const trayRangeOptions: TimeRange[] = ['7d', '14d', '30d', '90d', 'all'];
  const trayResolutionOptions: Aggregation[] = ['auto', 'day', 'week', 'month', 'year'];

  return (
    <SafeAreaView style={styles.container}>
      <View pointerEvents="none" style={styles.backdropWrap}>
        <View style={styles.backdropOrbTop} />
        <View style={styles.backdropOrbMid} />
        <View style={styles.backdropOrbBottom} />
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        onScroll={scheduleChartBlockerMeasure}
        scrollEventThrottle={16}
      >
        <View style={styles.headerWrap}>
          <TouchableOpacity onPress={onBack} hitSlop={12} style={styles.backButton} activeOpacity={0.8}>
            <Text style={styles.back}>{t(language, 'back')}</Text>
          </TouchableOpacity>

          <View style={styles.heroCard}>
            <Text style={styles.heroEyebrow}>{t(language, 'development')}</Text>
            <Text style={styles.title}>{t(language, 'progressScreenTitle')}</Text>
            <Text style={styles.subtitle}>{t(language, 'progressScreenSubtitle')}</Text>
            <View style={styles.heroMetaRow}>
              {selectedBlock ? (
                <View
                  style={[
                    styles.heroMetaChip,
                    {
                      borderColor: hexToRgba(selectedBlockTone.accent, 0.5),
                      backgroundColor: hexToRgba(selectedBlockTone.accent, 0.16),
                    },
                  ]}
                >
                  <View style={[styles.heroMetaDot, { backgroundColor: getDotColor(selectedBlock.id as TrainingBlockId) }]} />
                  <Text style={[styles.heroMetaText, { color: '#EAF1FF' }]} numberOfLines={1}>
                    {labelForBlock(selectedBlock, language)}
                  </Text>
                </View>
              ) : null}
              <View style={styles.heroMetaChip}>
                <Text style={styles.heroMetaText} numberOfLines={1}>
                  {`${exercises.length} ${t(language, 'exercises').toLowerCase()}`}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>{t(language, 'muscleGroups')}</Text>
        </View>
        <FlatList
          data={primaryBlocks}
          keyExtractor={(item) => item.id}
          numColumns={2}
          scrollEnabled={false}
          columnWrapperStyle={styles.groupGridRow}
          contentContainerStyle={styles.groupGrid}
          renderItem={({ item, index }) => {
            const selected = item.id === selectedBlockId;
            const tone = getBlockTone(item.id);
            const dotColor = getDotColor(item.id);
            const icon = BLOCK_ICON_SOURCES[item.id as TrainingBlockId];
            return (
              <View
                style={[
                  styles.groupTileWrap,
                  index % 2 === 1 ? styles.groupTileWrapRight : null,
                ]}
              >
                <MuscleGroupTile
                  label={labelForBlock(item, language)}
                  accent={tone.accent}
                  dotColor={dotColor}
                  icon={icon}
                  selected={selected}
                  onPress={() => {
                    animateNext();
                    setSelectedBlockId(item.id);
                    setSelectedExerciseId(null);
                  }}
                />
              </View>
            );
          }}
        />

        <View style={[styles.sectionHeaderRow, styles.sectionHeaderExercises]}>
          <Text style={styles.sectionTitle}>{t(language, 'exercises')}</Text>
          <View style={styles.sectionCountChip}>
            <Text style={styles.sectionCountText}>{exercises.length}</Text>
          </View>
        </View>
        {exercises.length === 0 ? (
          <Text style={styles.emptyText}>{t(language, 'noExercisesInBlock')}</Text>
        ) : (
          <>
            <View style={styles.tileRow}>
              {exercises.map((ex, index) => {
                const selected = ex.id === selectedExerciseId;
                const subtitle = exerciseSummaries.get(ex.id);
                return (
                  <React.Fragment key={ex.id}>
                    <SelectableTile
                      label={formatExerciseLabel(ex)}
                      subtitle={subtitle}
                      accent={selectedBlockTone.accent}
                      selected={selected}
                      variant="secondary"
                      onPress={() => {
                        animateNext();
                        setSelectedExerciseId((prev) => (prev === ex.id ? null : ex.id));
                      }}
                    />

                    {insightsInsertAfterIndex === index ? (
                      <Animated.View
                        style={[
                          styles.insightsWrap,
                          {
                            opacity: insightsAnim,
                            transform: [
                              {
                                translateY: insightsAnim.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [10, 0],
                                }),
                              },
                            ],
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.progressCard,
                            {
                              borderColor: hexToRgba(selectedBlockTone.accent, 0.34),
                              shadowColor: selectedBlockTone.accent,
                            },
                          ]}
                        >
                          <View style={styles.progressHeader}>
                            <Text style={styles.progressTitle}>{t(language, 'progress.insight.title')}</Text>
                            <View
                              style={[
                                styles.progressMetricChip,
                                {
                                  borderColor: hexToRgba(selectedBlockTone.accent, 0.48),
                                  backgroundColor: hexToRgba(selectedBlockTone.accent, 0.15),
                                },
                              ]}
                            >
                              <Text style={[styles.progressMetricChipText, { color: selectedBlockTone.accent }]}>
                                {chartMetricLabel}
                              </Text>
                            </View>
                          </View>
                          <Text style={styles.insightsSubtitle}>{t(language, 'progress.insight.subtitle')}</Text>

                          {latestOverall ? (
                            <>
                              {selectedExercise ? (
                                (() => {
                                  const split = splitLabelParentheses(formatExerciseLabel(selectedExercise));
                                  return (
                                    <View style={styles.insightsSelectedExercise}>
                                      <Text style={styles.insightsSelectedExerciseMain} numberOfLines={1}>
                                        {split.main}
                                      </Text>
                                      {split.parentheses ? (
                                        <Text style={styles.insightsSelectedExerciseParen} numberOfLines={1}>
                                          {split.parentheses}
                                        </Text>
                                      ) : null}
                                    </View>
                                  );
                                })()
                              ) : null}

                              {insightsProgression ? (
                                <View style={styles.insightsProgression}>
                                  <Text style={styles.insightsProgressionHeadline}>
                                    <Text style={[styles.insightsProgressionDelta, { color: insightsProgression.accent }]}>
                                      {insightsProgression.deltaText}
                                    </Text>
                                    <Text style={styles.insightsProgressionDetail}> {insightsProgression.detailText}</Text>
                                  </Text>
                                  {insightsProgression.microcopy ? (
                                    <Text style={[styles.insightsMicrocopy, { color: insightsProgression.accent }]}>
                                      {insightsProgression.microcopy}
                                    </Text>
                                  ) : null}
                                </View>
                              ) : (
                                <Text style={styles.insightsEmpty}>{t(language, 'progress.insight.empty')}</Text>
                              )}

                              {instantFeedback ? (
                                <View
                                  style={[
                                    styles.feedbackCard,
                                    {
                                      borderColor: hexToRgba(instantFeedback.accent, 0.48),
                                      backgroundColor: hexToRgba(instantFeedback.accent, 0.14),
                                    },
                                  ]}
                                >
                                  <Text style={[styles.feedbackCardTitle, { color: instantFeedback.accent }]}>
                                    {instantFeedback.title}
                                  </Text>
                                  <Text style={styles.feedbackCardDetail}>{instantFeedback.detail}</Text>
                                </View>
                              ) : null}

                              {nextSetSuggestion ? (
                                <View style={styles.nextSetCard}>
                                  <Text style={[styles.nextSetTitle, { color: nextSetSuggestion.accent }]}>
                                    {t(language, 'progress.feedback.next.title')}
                                  </Text>
                                  <Text style={styles.nextSetMain}>{nextSetSuggestion.title}</Text>
                                  <Text style={styles.nextSetDetail}>{nextSetSuggestion.detail}</Text>
                                </View>
                              ) : null}

                              <View style={styles.insightsRow}>
                                <Text style={styles.insightsLabel}>{t(language, 'progress.insight.lastSession')}</Text>
                                <Text style={styles.insightsValue} numberOfLines={2}>
                                  {latestOverall.setLabel} - {latestOverall.dateTimeLabel}
                                </Text>
                              </View>

                              {insightsNewPr ? (
                                <View style={styles.insightsRow}>
                                  <Text style={styles.insightsLabel}>{t(language, 'progress.pr')}</Text>
                                  <Text style={styles.insightsValue} numberOfLines={2}>
                                    {insightsNewPr}
                                  </Text>
                                </View>
                              ) : null}

                              {plateauInsight ? (
                                <View
                                  style={[
                                    styles.plateauCard,
                                    {
                                      borderColor: hexToRgba(plateauInsight.accent, 0.52),
                                      backgroundColor: hexToRgba(plateauInsight.accent, 0.14),
                                    },
                                  ]}
                                >
                                  <Text style={[styles.plateauTitle, { color: plateauInsight.accent }]}>
                                    {plateauInsight.title}
                                  </Text>
                                  <Text style={styles.plateauDetail}>{plateauInsight.detail}</Text>
                                  <Text style={styles.plateauAction}>{`1) ${plateauInsight.actionPrimary}`}</Text>
                                  <Text style={styles.plateauAction}>{`2) ${plateauInsight.actionSecondary}`}</Text>
                                </View>
                              ) : null}

                              {insightsTarget ? (
                                <View style={styles.targetCard}>
                                  <View style={styles.targetRow}>
                                    <Text style={styles.targetLabel}>{t(language, 'progress.insight.nextGoal')}</Text>
                                    <Text style={[styles.targetValue, { color: selectedBlockTone.accent }]} numberOfLines={1}>
                                      {insightsTarget.kind === 'weight'
                                        ? formatWeight(insightsTarget.nextKg, massUnit, language)
                                        : `${insightsTarget.next} ${t(language, 'reps')}`}
                                    </Text>
                                  </View>
                                  <View style={styles.progressTrack}>
                                    <View
                                      style={[
                                        styles.progressFill,
                                        {
                                          width: `${Math.round(insightsTarget.progress * 100)}%`,
                                          backgroundColor: selectedBlockTone.accent,
                                        },
                                      ]}
                                    />
                                  </View>
                                  <Text style={styles.targetHint}>
                                    {(() => {
                                      const diffLabel =
                                        insightsTarget.kind === 'weight'
                                          ? formatWeight(insightsTarget.diffKg, massUnit, language)
                                          : `${insightsTarget.diff} ${t(language, 'reps')}`;
                                      return t(language, 'progress.insight.onlyXToGo', { diff: diffLabel });
                                    })()}
                                  </Text>
                                </View>
                              ) : null}

                              <View style={styles.insightsDivider} />

                              <TouchableOpacity
                                onPress={() => {
                                  animateNext();
                                  const next = !isTrayOpen;
                                  setIsTrayOpen(next);
                                  Animated.timing(trayAnim, {
                                    toValue: next ? 1 : 0,
                                    duration: 180,
                                    useNativeDriver: false,
                                  }).start();
                                }}
                                activeOpacity={0.85}
                                style={styles.controlsSummary}
                                accessibilityRole="button"
                                accessibilityLabel={t(language, isTrayOpen ? 'progress.controls.close' : 'progress.controls.open')}
                              >
                                <Text style={styles.controlsSummaryText} numberOfLines={1}>
                                  {controlsSummaryText}
                                </Text>
                                <Text style={styles.controlsSummaryChevron}>{isTrayOpen ? '^' : 'v'}</Text>
                              </TouchableOpacity>

                              <Animated.View
                                pointerEvents={isTrayOpen ? 'auto' : 'none'}
                                style={[
                                  styles.controlTray,
                                  {
                                    maxHeight: trayAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 520] }),
                                    opacity: trayAnim,
                                    marginTop: trayAnim.interpolate({ inputRange: [0, 1], outputRange: [0, SPACING.sm] }),
                                    transform: [
                                      {
                                        translateY: trayAnim.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }),
                                      },
                                    ],
                                  },
                                ]}
                              >
                                <Text style={styles.controlTrayLabel}>{t(language, 'progress.controls.quickRanges')}</Text>
                                <View style={styles.segment}>
                                  {trayRangeOptions.map((r) => {
                                    const selectedRange = r === timeRange;
                                    return (
                                      <TouchableOpacity
                                        key={r}
                                        onPress={() => {
                                          animateNext();
                                          setTimeRange(r);
                                        }}
                                        activeOpacity={0.9}
                                        style={[styles.segmentButton, selectedRange ? styles.segmentButtonSelected : null]}
                                      >
                                        <Text style={[styles.segmentText, selectedRange ? styles.segmentTextSelected : null]}>
                                          {t(language, RANGE_LABEL_KEY[r])}
                                        </Text>
                                      </TouchableOpacity>
                                    );
                                  })}
                                </View>

                                <Text style={styles.controlTrayLabel}>{t(language, 'progress.controls.metric')}</Text>
                                <View style={styles.segment}>
                                  {metricOptions.map((opt) => {
                                    const selectedMetric = metric === opt.key;
                                    return (
                                      <TouchableOpacity
                                        key={opt.key}
                                        onPress={() => {
                                          animateNext();
                                          setMetric(opt.key);
                                        }}
                                        activeOpacity={0.9}
                                        style={[styles.segmentButton, selectedMetric ? styles.segmentButtonSelected : null]}
                                      >
                                        <Text style={[styles.segmentText, selectedMetric ? styles.segmentTextSelected : null]}>
                                          {opt.label}
                                        </Text>
                                      </TouchableOpacity>
                                    );
                                  })}
                                </View>

                                <Text style={styles.controlTrayLabel}>{t(language, 'progress.controls.resolution')}</Text>
                                <View style={styles.segment}>
                                  {trayResolutionOptions.map((agg) => {
                                    const selectedAgg = agg === aggregation;
                                    return (
                                      <TouchableOpacity
                                        key={agg}
                                        onPress={() => {
                                          animateNext();
                                          setAggregation(agg);
                                        }}
                                        activeOpacity={0.9}
                                        style={[styles.segmentButton, selectedAgg ? styles.segmentButtonSelected : null]}
                                      >
                                        <Text style={[styles.segmentText, selectedAgg ? styles.segmentTextSelected : null]}>
                                          {t(language, AGGREGATION_LABEL_KEY[agg])}
                                        </Text>
                                      </TouchableOpacity>
                                    );
                                  })}
                                </View>

                                <Text style={styles.controlTrayLabel}>{t(language, 'progress.controls.view')}</Text>
                                <View style={styles.chartControls}>
                                  <TouchableOpacity onPress={handleZoomOut} activeOpacity={0.85} style={styles.chartControlButton}>
                                    <Text style={styles.chartControlText}>-</Text>
                                  </TouchableOpacity>
                                  <TouchableOpacity onPress={handleZoomIn} activeOpacity={0.85} style={styles.chartControlButton}>
                                    <Text style={styles.chartControlText}>+</Text>
                                  </TouchableOpacity>
                                  <TouchableOpacity
                                    onPress={handleResetZoom}
                                    activeOpacity={0.85}
                                    style={[styles.chartResetButton, isFullRange ? styles.chartResetButtonDisabled : null]}
                                    disabled={isFullRange}
                                  >
                                    <Text style={[styles.chartResetText, isFullRange ? styles.chartResetTextDisabled : null]}>
                                      {t(language, 'progress.reset')}
                                    </Text>
                                  </TouchableOpacity>
                                </View>
                              </Animated.View>

                              {rowsChart.length === 0 ? (
                                <Text style={styles.emptyText}>{t(language, 'progress.emptyRange')}</Text>
                              ) : (
                                <>
                                  <View style={styles.chartLegendRow}>
                                    <View style={styles.chartLegendItem}>
                                      <View style={[styles.chartLegendLine, { backgroundColor: hexToRgba(selectedBlockTone.accent, 0.62) }]} />
                                      <Text style={styles.chartLegendText}>{t(language, 'progress.chart.legend.trend')}</Text>
                                    </View>
                                    <View style={styles.chartLegendItem}>
                                      <View style={styles.chartLegendDotWrap}>
                                        <View style={styles.chartLegendDotCore} />
                                        <View style={styles.chartLegendDotRing} />
                                      </View>
                                      <Text style={styles.chartLegendText}>{t(language, 'progress.chart.legend.pr')}</Text>
                                    </View>
                                  </View>

                                  <View ref={chartContainerRef} style={styles.chart} onLayout={registerChartBlocker}>
                                    <View style={styles.chartRow}>
                                      <View style={styles.chartYAxis}>
                                        {chartAxis.ticks.map((tick) => {
                                          const y = yForChartValue(tick, chartAxis.min, chartAxis.max);
                                          return (
                                            <Text key={`y-${tick}`} style={[styles.chartYAxisLabel, { top: y - 7 }]}>
                                              {formatChartTick(language, tick, metric, massUnit, volumeUsesWeight)}
                                            </Text>
                                          );
                                        })}
                                      </View>

                                      <View
                                        style={styles.chartPlot}
                                        onLayout={(e) => {
                                          const w = Math.round(e.nativeEvent.layout.width);
                                          setChartWidth((prev) => (prev === w ? prev : w));
                                        }}
                                        {...chartWheelProps}
                                        {...panResponder.panHandlers}
                                      >
                                        {chartAxis.ticks.map((tick) => {
                                          const y = yForChartValue(tick, chartAxis.min, chartAxis.max);
                                          const isBaseline = tick === chartAxis.min;
                                          return (
                                            <View
                                              key={`g-${tick}`}
                                              style={[styles.chartGridLine, { top: y, opacity: isBaseline ? 0.22 : 0.12 }]}
                                            />
                                          );
                                        })}

                                        {chartTrendPoints.map((p, idx) => {
                                          if (idx === 0) return null;
                                          const prev = chartTrendPoints[idx - 1];
                                          if (!prev) return null;
                                          const dx = p.x - prev.x;
                                          const dy = p.y - prev.y;
                                          const length = Math.sqrt(dx * dx + dy * dy);
                                          const angle = Math.atan2(dy, dx);
                                          const midX = (prev.x + p.x) / 2;
                                          const midY = (prev.y + p.y) / 2;
                                          const isInRange = p.x >= 0 && p.x <= chartWidth;
                                          if (!isInRange) return null;

                                          return (
                                            <View
                                              key={`trend-${p.id}`}
                                              style={[
                                                styles.chartTrendLine,
                                                {
                                                  left: midX - length / 2,
                                                  top: midY - CHART_TREND_LINE_THICKNESS / 2,
                                                  width: length,
                                                  height: CHART_TREND_LINE_THICKNESS,
                                                  backgroundColor: hexToRgba(selectedBlockTone.accent, 0.62),
                                                  transform: [{ rotateZ: `${angle}rad` }],
                                                },
                                              ]}
                                            />
                                          );
                                        })}

                                        {chartPoints.map((p, idx) => {
                                          if (idx === 0) return null;
                                          const prev = chartPoints[idx - 1];
                                          if (!prev) return null;
                                          const dx = p.x - prev.x;
                                          const dy = p.y - prev.y;
                                          const length = Math.sqrt(dx * dx + dy * dy);
                                          const angle = Math.atan2(dy, dx);
                                          const midX = (prev.x + p.x) / 2;
                                          const midY = (prev.y + p.y) / 2;
                                          const isInRange = p.x >= 0 && p.x <= chartWidth;
                                          if (!isInRange) return null;

                                          return (
                                            <View
                                              key={`l-${p.id}`}
                                              style={[
                                                styles.chartLine,
                                                {
                                                  left: midX - length / 2,
                                                  top: midY - CHART_LINE_THICKNESS / 2,
                                                  width: length,
                                                  height: CHART_LINE_THICKNESS,
                                                  backgroundColor: selectedBlockTone.accent,
                                                  transform: [{ rotateZ: `${angle}rad` }],
                                                  opacity: 0.9,
                                                },
                                              ]}
                                            />
                                          );
                                        })}

                                        {chartPoints.map((p) => {
                                          const isLatest = p.id === latestChartPointId;
                                          const isSelected = p.id === selectedPointId;
                                          const isBest = p.id === bestChartPointId;
                                          const isPrPoint = prPointIds.has(p.id);
                                          const borderColor = isSelected
                                            ? '#F9FAFB'
                                            : isPrPoint || isBest
                                              ? COLORS.success
                                              : selectedBlockTone.accent;
                                          const fillColor = isSelected ? '#F9FAFB' : isLatest ? selectedBlockTone.accent : '#0B1220';
                                          return (
                                            <View key={`p-${p.id}`} pointerEvents="box-none">
                                              <Pressable
                                                onPress={() => setSelectedPointId(p.id)}
                                                hitSlop={8}
                                                style={[
                                                  styles.chartPoint,
                                                  {
                                                    left: p.x - CHART_POINT_SIZE / 2,
                                                    top: p.y - CHART_POINT_SIZE / 2,
                                                    borderColor,
                                                    backgroundColor: fillColor,
                                                    opacity: isLatest ? 1 : 0.9,
                                                  },
                                                ]}
                                              />
                                              {isPrPoint ? (
                                                <View
                                                  pointerEvents="none"
                                                  style={[
                                                    styles.chartPrRing,
                                                    {
                                                      left: p.x - CHART_POINT_SIZE / 2 - 3,
                                                      top: p.y - CHART_POINT_SIZE / 2 - 3,
                                                    },
                                                  ]}
                                                />
                                              ) : null}
                                            </View>
                                          );
                                        })}

                                        {selectedChartPoint && chartTooltipStyle ? (
                                          <View style={[styles.chartTooltip, chartTooltipStyle]} pointerEvents="none">
                                            {selectedExercise ? (
                                              <Text style={styles.chartTooltipTitle} numberOfLines={1}>
                                                {formatExerciseLabel(selectedExercise)}
                                              </Text>
                                            ) : null}
                                            <Text style={styles.chartTooltipValue} numberOfLines={1}>
                                              {chartMetricLabel}:{' '}
                                              {formatMetricValue(
                                                metricValueChart(selectedChartPoint.row, metric),
                                                metric,
                                                massUnit,
                                                language,
                                                volumeUsesWeight
                                              )}
                                            </Text>
                                            {selectedChartPoint.row.bestSet?.setLabel ? (
                                              <Text style={styles.chartTooltipDetail} numberOfLines={1}>
                                                {selectedChartPoint.row.bestSet.setLabel}
                                              </Text>
                                            ) : null}
                                            {prPointIds.has(selectedChartPoint.id) ? (
                                              <Text style={styles.chartTooltipPr}>{t(language, 'progress.newPr')}</Text>
                                            ) : null}
                                            <Text style={styles.chartTooltipLabel} numberOfLines={1}>
                                              {selectedChartPoint.row.bestSet?.dateTimeLabel ?? selectedChartPoint.row.dateLabel}
                                            </Text>
                                          </View>
                                        ) : null}

                                        <Text style={styles.chartUnit} numberOfLines={1}>
                                          {chartUnitLabel}
                                        </Text>
                                      </View>
                                    </View>

                                    <View style={styles.chartXAxis}>
                                      <Text style={styles.chartXAxisLabel}>{chartStartLabel}</Text>
                                      <Text style={styles.chartXAxisLabel}>{chartEndLabel}</Text>
                                    </View>
                                  </View>

                                  <TouchableOpacity
                                    onPress={() => {
                                      animateNext();
                                      setShowTable((prev) => !prev);
                                    }}
                                    activeOpacity={0.85}
                                    style={styles.tableToggle}
                                  >
                                    <Text style={styles.tableToggleText}>
                                      {t(language, showTable ? 'progress.chart.hideTable' : 'progress.chart.showTable')}
                                    </Text>
                                  </TouchableOpacity>

                                  {showTable ? (
                                    <View style={styles.table}>
                                      <View style={[styles.row, styles.headerRow]}>
                                        <Text style={[styles.cell, styles.cellDate]}>{t(language, 'date')}</Text>
                                        <Text style={[styles.cell, styles.cellMetric]}>{chartMetricLabel}</Text>
                                      </View>

                                      {[...rowsChart].reverse().map((r) => {
                                        const isLatest = latestVisible?.id === r.id;
                                        const rowIsBest = bestVisible?.id === r.id;
                                        return (
                                          <View
                                            key={r.id}
                                            style={[
                                              styles.row,
                                              isLatest ? { backgroundColor: selectedBlockTone.soft } : null,
                                              rowIsBest ? { backgroundColor: 'rgba(34, 197, 94, 0.08)' } : null,
                                            ]}
                                          >
                                            <Text style={[styles.cell, styles.cellDate]}>{r.dateLabel}</Text>
                                            <Text style={[styles.cell, styles.cellMetric]}>
                                              {formatMetricValue(
                                                metricValueChart(r, metric),
                                                metric,
                                                massUnit,
                                                language,
                                                volumeUsesWeight
                                              )}
                                            </Text>
                                          </View>
                                        );
                                      })}
                                    </View>
                                  ) : null}
                                </>
                              )}
                            </>
                          ) : (
                            <Text style={styles.emptyText}>{t(language, 'analysis.empty')}</Text>
                          )}
                        </View>
                      </Animated.View>
                    ) : null}
                  </React.Fragment>
                );
              })}
            </View>

            {!selectedExercise ? (
              <Text style={styles.chooseExerciseHint}>{t(language, 'chooseExerciseToSee')}</Text>
            ) : null}
          </>
        )}

        {/*
        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressTitle}>{t(language, 'development')}</Text>
          </View>

          {latestOverall ? (
            <>
              <Text style={[styles.progressSubtitle, { color: selectedBlockTone.accent }]} numberOfLines={1}>
                {formatExerciseLabel(selectedExercise)}
              </Text>

              <View style={styles.kpiGrid}>
                <View style={styles.kpiCard}>
                  <Text style={[styles.kpiLabel, styles.kpiLabelLatest]}>{t(language, 'progress.latest')}</Text>
                  <Text style={[styles.kpiValue, styles.kpiValueLast]} numberOfLines={1}>
                    {hasWeightData
                      ? `${formatWeight(latestOverall.weight, massUnit, language)} x ${latestOverall.reps}`
                      : `${latestOverall.reps} ${t(language, 'reps')}`}
                  </Text>
                  <Text style={[styles.kpiSub, styles.kpiSubMuted]}>{latestOverall.dateLabel}</Text>
                </View>

                <View style={styles.kpiCard}>
                  <Text style={[styles.kpiLabel, styles.kpiLabelPr]}>{t(language, 'progress.pr')}</Text>
                  <Text style={[styles.kpiValue, styles.kpiValuePr]} numberOfLines={1}>
                    {metric === 'reps'
                      ? `${bestAllReps} ${t(language, 'reps')}`
                      : metric === 'weight'
                        ? bestWeightSet
                          ? `${formatWeight(bestWeightSet.weight, massUnit, language)} x ${bestWeightSet.reps}`
                          : t(language, 'analysis.empty')
                        : formatWeight(bestAll, massUnit, language)}
                  </Text>
                  <Text style={styles.kpiSub}>{t(language, 'progress.allTime')}</Text>
                </View>

                <View style={styles.kpiCard}>
                  <Text style={[styles.kpiLabel, changeLabelStyle]}>{t(language, 'progress.change')}</Text>
                  <Text
                    style={[
                      styles.kpiValue,
                      deltaFromPrev == null
                        ? styles.deltaNeutral
                        : deltaFromPrev > 0
                          ? styles.deltaUp
                          : deltaFromPrev < 0
                            ? styles.deltaDown
                            : styles.deltaNeutral,
                    ]}
                    numberOfLines={1}
                  >
                    {deltaFromPrev == null
                      ? t(language, 'analysis.empty')
                      : metric === 'reps'
                        ? `${deltaFromPrev > 0 ? '+' : ''}${Math.round(deltaFromPrev)} ${t(language, 'reps')}`
                        : `${deltaFromPrev > 0 ? '+' : ''}${formatWeight(deltaFromPrev, massUnit, language)}`}
                  </Text>
                  <Text style={styles.kpiSub}>
                    {deltaFromFirst == null
                      ? t(language, 'analysis.empty')
                      : metric === 'reps'
                        ? `${deltaFromFirst > 0 ? '+' : ''}${Math.round(deltaFromFirst)} ${t(language, 'reps')}`
                        : `${deltaFromFirst > 0 ? '+' : ''}${formatWeight(deltaFromFirst, massUnit, language)}`}
                    {'  '}
                    <Text style={styles.kpiSubMuted}>{t(language, 'progress.sinceFirst')}</Text>
                  </Text>
                </View>
              </View>

              {target ? (
                <View style={styles.targetCard}>
                  <View style={styles.targetRow}>
                    <Text style={styles.targetLabel}>{t(language, 'progress.nextTarget')}</Text>
                    <Text style={[styles.targetValue, { color: selectedBlockTone.accent }]} numberOfLines={1}>
                      {target.kind === 'weight'
                        ? formatWeight(target.nextKg, massUnit, language)
                        : `${target.next} ${t(language, 'reps')}`}
                    </Text>
                  </View>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${Math.round(target.progress * 100)}%`, backgroundColor: selectedBlockTone.accent }]} />
                  </View>
                  <Text style={styles.targetHint}>
                    {target.kind === 'weight'
                      ? t(language, 'progress.away', { diff: formatWeight(target.diffKg, massUnit, language) })
                      : t(language, 'progress.away', { diff: `${target.diff} ${t(language, 'reps')}` })}
                  </Text>
                </View>
              ) : null}

              <View style={styles.controlsRow}>
                <View style={styles.segment}>
                  {(['all', '90d', '30d'] as TimeRange[]).map((r) => {
                    const selected = r === timeRange;
                    return (
                      <TouchableOpacity
                        key={r}
                        onPress={() => {
                          animateNext();
                          setTimeRange(r);
                        }}
                        activeOpacity={0.9}
                        style={[styles.segmentButton, selected ? styles.segmentButtonSelected : null]}
                      >
                        <Text style={[styles.segmentText, selected ? styles.segmentTextSelected : null]}>
                          {t(language, RANGE_LABEL_KEY[r])}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={styles.segment}>
                  {(['day', 'month', 'year'] as Aggregation[]).map((agg) => {
                    const selected = agg === aggregation;
                    return (
                      <TouchableOpacity
                        key={agg}
                        onPress={() => {
                          animateNext();
                          setAggregation(agg);
                        }}
                        activeOpacity={0.9}
                        style={[styles.segmentButton, selected ? styles.segmentButtonSelected : null]}
                      >
                        <Text style={[styles.segmentText, selected ? styles.segmentTextSelected : null]}>
                          {t(language, AGGREGATION_LABEL_KEY[agg])}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={styles.segment}>
                  {metricOptions.map((opt) => {
                    const selected = metric === opt.key;
                    return (
                      <TouchableOpacity
                        key={opt.key}
                        onPress={() => {
                          animateNext();
                          setMetric(opt.key);
                        }}
                        activeOpacity={0.9}
                        style={[styles.segmentButton, selected ? styles.segmentButtonSelected : null]}
                      >
                        <Text style={[styles.segmentText, selected ? styles.segmentTextSelected : null]}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.chartHeader}>
                <Text style={styles.chartCaption}>
                  {metric === 'weight'
                    ? t(language, 'weightOverTime')
                    : metric === 'oneRm'
                      ? t(language, 'oneRmOverTime')
                      : metric === 'volume'
                        ? t(language, 'progress.volumeOverTime')
                        : t(language, 'repsOverTime')}
                </Text>
                <View style={styles.chartControls}>
                  <TouchableOpacity onPress={handleZoomOut} activeOpacity={0.85} style={styles.chartControlButton}>
                    <Text style={styles.chartControlText}>-</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleZoomIn} activeOpacity={0.85} style={styles.chartControlButton}>
                    <Text style={styles.chartControlText}>+</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleResetZoom}
                    activeOpacity={0.85}
                    style={[styles.chartResetButton, isFullRange ? styles.chartResetButtonDisabled : null]}
                    disabled={isFullRange}
                  >
                    <Text style={[styles.chartResetText, isFullRange ? styles.chartResetTextDisabled : null]}>
                      {t(language, 'progress.reset')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

                {rowsChart.length === 0 ? (
                  <Text style={styles.emptyText}>{t(language, 'progress.emptyRange')}</Text>
                ) : (
                  <>
                    <View ref={chartContainerRef} style={styles.chart} onLayout={registerChartBlocker}>
                      <View style={styles.chartRow}>
                        <View style={styles.chartYAxis}>
                          {chartAxis.ticks.map((tick) => {
                            const y = yForChartValue(tick, chartAxis.min, chartAxis.max);
                            return (
                              <Text key={`y-${tick}`} style={[styles.chartYAxisLabel, { top: y - 7 }]}>
                                {formatChartTick(language, tick, metric, massUnit, volumeUsesWeight)}
                              </Text>
                            );
                          })}
                        </View>

                        <View
                          style={styles.chartPlot}
                          onLayout={(e) => {
                            const w = Math.round(e.nativeEvent.layout.width);
                            setChartWidth((prev) => (prev === w ? prev : w));
                          }}
                          {...chartWheelProps}
                          {...panResponder.panHandlers}
                        >
                          {chartAxis.ticks.map((tick) => {
                            const y = yForChartValue(tick, chartAxis.min, chartAxis.max);
                            const isBaseline = tick === chartAxis.min;
                            return (
                              <View
                                key={`g-${tick}`}
                                style={[styles.chartGridLine, { top: y, opacity: isBaseline ? 0.7 : 0.35 }]}
                              />
                            );
                          })}

                          {chartPoints.map((p, idx) => {
                            if (idx === 0) return null;
                            const prev = chartPoints[idx - 1];
                            if (!prev) return null;
                            const dx = p.x - prev.x;
                            const dy = p.y - prev.y;
                            const length = Math.sqrt(dx * dx + dy * dy);
                            const angle = Math.atan2(dy, dx);
                            const midX = (prev.x + p.x) / 2;
                            const midY = (prev.y + p.y) / 2;
                            return (
                              <View
                                key={`seg-${prev.id}-${p.id}`}
                                style={[
                                  styles.chartLine,
                                  {
                                    left: midX - length / 2,
                                    top: midY - CHART_LINE_THICKNESS / 2,
                                    width: length,
                                    height: CHART_LINE_THICKNESS,
                                    backgroundColor: selectedBlockTone.accent,
                                    transform: [{ rotateZ: `${angle}rad` }],
                                  },
                                ]}
                              />
                            );
                          })}

                          {chartPoints.map((p) => {
                            const isBest = p.id === bestChartPointId;
                            const isLatest = p.id === latestChartPointId;
                            const isSelected = p.id === selectedPointId;
                            return (
                              <View
                                key={`pt-${p.id}`}
                                style={[
                                  styles.chartPoint,
                                  {
                                    left: p.x - CHART_POINT_SIZE / 2,
                                    top: p.y - CHART_POINT_SIZE / 2,
                                    backgroundColor: isBest ? COLORS.success : selectedBlockTone.accent,
                                    borderColor: isSelected || isLatest ? '#F9FAFB' : 'transparent',
                                    transform: [{ scale: isSelected ? 1.25 : isLatest ? 1.1 : 1 }],
                                  },
                                ]}
                              />
                            );
                          })}

                          {selectedChartPoint && chartTooltipStyle ? (
                            <View style={[styles.chartTooltip, chartTooltipStyle]} pointerEvents="none">
                              {selectedExercise ? (
                                <Text style={styles.chartTooltipTitle} numberOfLines={1}>
                                  {formatExerciseLabel(selectedExercise)}
                                </Text>
                              ) : null}
                              <Text style={styles.chartTooltipValue} numberOfLines={1}>
                                {chartMetricLabel}:{' '}
                                {formatMetricValue(
                                  metricValueChart(selectedChartPoint.row, metric),
                                  metric,
                                  massUnit,
                                  language,
                                  volumeUsesWeight
                                )}
                              </Text>
                              {selectedChartPoint.row.bestSet?.setLabel ? (
                                <Text style={styles.chartTooltipDetail} numberOfLines={1}>
                                  {selectedChartPoint.row.bestSet.setLabel}
                                </Text>
                              ) : null}
                              <Text style={styles.chartTooltipLabel} numberOfLines={1}>
                                {selectedChartPoint.row.bestSet?.dateTimeLabel ?? selectedChartPoint.row.dateLabel}
                              </Text>
                            </View>
                          ) : null}

                          <Text style={styles.chartUnit} numberOfLines={1}>
                            {chartUnitLabel}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.chartXAxis}>
                        <Text style={styles.chartXAxisLabel}>{chartStartLabel}</Text>
                        <Text style={styles.chartXAxisLabel}>{chartEndLabel}</Text>
                      </View>
                    </View>

                    <View style={styles.table}>
                      <View style={[styles.row, styles.headerRow]}>
                        <Text style={[styles.cell, styles.cellDate]}>{t(language, 'date')}</Text>
                        <Text style={[styles.cell, styles.cellMetric]}>{chartMetricLabel}</Text>
                      </View>

                      {[...rowsChart].reverse().map((r) => {
                        const isLatest = latestVisible?.id === r.id;
                        const rowIsBest = bestVisible?.id === r.id;
                        return (
                          <View
                            key={r.id}
                            style={[
                              styles.row,
                              isLatest ? { backgroundColor: selectedBlockTone.soft } : null,
                              rowIsBest ? { backgroundColor: 'rgba(34, 197, 94, 0.08)' } : null,
                            ]}
                          >
                            <Text style={[styles.cell, styles.cellDate]}>{r.dateLabel}</Text>
                            <Text style={[styles.cell, styles.cellMetric]}>
                              {formatMetricValue(
                                metricValueChart(r, metric),
                                metric,
                                massUnit,
                                language,
                                volumeUsesWeight
                              )}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                </>
              )}
            </>
          ) : (
            <Text style={styles.emptyText}>{t(language, 'analysis.empty')}</Text>
          )}
        </View>
        */}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#040B1A',
  },
  backdropWrap: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  backdropOrbTop: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 999,
    right: -120,
    top: -84,
    backgroundColor: 'rgba(51, 111, 198, 0.24)',
  },
  backdropOrbMid: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 999,
    left: -132,
    top: 240,
    backgroundColor: 'rgba(13, 148, 136, 0.14)',
  },
  backdropOrbBottom: {
    position: 'absolute',
    width: 360,
    height: 360,
    borderRadius: 999,
    right: -150,
    bottom: -170,
    backgroundColor: 'rgba(79, 142, 232, 0.12)',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: Platform.OS === 'ios' ? SPACING.sm : SPACING.xxxl,
    paddingBottom: SPACING.xxxl,
    ...Platform.select({
      web: { width: '100%', maxWidth: 720, alignSelf: 'center' },
    }),
  },
  headerWrap: {
    marginBottom: SPACING.md,
  },
  backButton: {
    alignSelf: 'flex-start',
    minHeight: 40,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.24)',
    backgroundColor: 'rgba(10, 21, 43, 0.78)',
    paddingHorizontal: SPACING.md,
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  back: {
    color: '#B8D3FA',
    fontSize: TEXT.sm,
    fontWeight: '600',
  },
  heroCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
    backgroundColor: 'rgba(11, 22, 42, 0.88)',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    gap: SPACING.xs,
    ...Platform.select({
      web: {
        boxShadow: '0 12px 28px rgba(2, 6, 23, 0.45)',
      },
      default: {
        shadowColor: '#020617',
        shadowOpacity: 0.42,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 8 },
        elevation: 3,
      },
    }),
  },
  heroEyebrow: {
    color: '#8FB5FF',
    fontSize: TEXT.xs,
    fontWeight: '700',
    letterSpacing: 0.36,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 32,
    lineHeight: 36,
    fontWeight: '700',
    color: '#F8FBFF',
  },
  subtitle: {
    marginTop: SPACING.xs - 1,
    color: '#9FB0C8',
    fontSize: TEXT.sm,
    lineHeight: 20,
  },
  heroMetaRow: {
    marginTop: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  heroMetaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    minHeight: 30,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.26)',
    backgroundColor: 'rgba(148, 163, 184, 0.08)',
    paddingHorizontal: SPACING.sm,
  },
  heroMetaDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
  },
  heroMetaText: {
    color: '#C5D4EA',
    fontSize: TEXT.xs,
    fontWeight: '700',
  },
  sectionLabel: {
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
    color: '#EAF1FF',
    fontSize: TEXT.sm,
    fontWeight: '700',
  },
  sectionHeaderRow: {
    marginTop: SPACING.xl,
    marginBottom: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.md,
  },
  sectionHeaderExercises: {
    marginTop: SPACING.lg,
  },
  sectionTitle: {
    color: '#EAF1FF',
    fontSize: TEXT.sm,
    fontWeight: '700',
    letterSpacing: 0.22,
    flex: 1,
  },
  sectionCountChip: {
    minWidth: 28,
    height: 22,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.34)',
    backgroundColor: 'rgba(79, 142, 232, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xs,
  },
  sectionCountText: {
    color: '#B8D3FA',
    fontSize: TEXT.xs,
    fontWeight: '700',
  },
  modeButtons: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: SPACING.md,
    paddingTop: 2,
  },
  modeButtonWrap: {
    alignItems: 'center',
  },
  modeButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    backgroundColor: '#0B1220',
    shadowOpacity: 0.24,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  modeButtonSelected: {
    shadowOpacity: 0.5,
    elevation: 5,
  },
  modeButtonIcon: {
    width: 28,
    height: 28,
  },
  modeButtonLabel: {
    marginTop: 4,
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.6)',
    fontWeight: '600',
  },
  groupGrid: {
    paddingBottom: SPACING.xs,
    marginTop: 0,
  },
  groupGridRow: {
    justifyContent: 'space-between',
  },
  groupTileWrap: {
    flex: 1,
    marginBottom: SPACING.sm,
  },
  groupTileWrapRight: {
    marginLeft: SPACING.sm,
  },
  groupTile: {
    minHeight: 70,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.24)',
    backgroundColor: '#0A152A',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
    shadowColor: '#020617',
    shadowOpacity: 0.36,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 7 },
    elevation: 2,
  },
  groupTileSelected: {
    shadowOpacity: 0.5,
    elevation: 4,
  },
  groupTileDot: {
    width: 9,
    height: 9,
    borderRadius: 999,
  },
  groupTileText: {
    flex: 1,
    color: '#E5EEFC',
    fontSize: TEXT.sm,
    fontWeight: '700',
    marginLeft: 2,
  },
  groupTileTextSelected: {
    color: '#FFFFFF',
  },
  groupTileIconWrap: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 'auto',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.24)',
    backgroundColor: 'rgba(148, 163, 184, 0.08)',
  },
  groupTileIcon: {
    width: 24,
    height: 24,
  },
  groupTileFallbackDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  tileRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  tile: {
    flexBasis: '47.5%',
    flexGrow: 1,
    margin: 0,
    minHeight: 74,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
    backgroundColor: '#0A152A',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
    shadowColor: '#020617',
    shadowOpacity: 0.36,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 7 },
    elevation: 2,
  },
  tileSelected: {
    shadowOpacity: 0.5,
    elevation: 4,
  },
  tileSecondary: {
    minHeight: 76,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.22)',
    shadowColor: '#020617',
    shadowOpacity: 0.34,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 7 },
    elevation: 2,
  },
  tilePressed: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },
  tileDotWrap: {
    width: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  tileText: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  tileLabelColumn: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  tileLabel: {
    color: '#D7E6FF',
    fontSize: TEXT.md,
    fontWeight: '700',
  },
  tileLabelSecondary: {
    color: '#D7E6FF',
    fontWeight: '700',
  },
  tileLabelSecondaryMain: {
    fontSize: TEXT.md,
    fontWeight: '700',
  },
  tileLabelSecondaryParen: {
    fontSize: TEXT.xs,
    fontWeight: '700',
  },
  tileLabelSelected: {
    color: '#F8FBFF',
  },
  tileSubtitle: {
    color: '#8EA5C6',
    fontSize: TEXT.xs,
    fontWeight: '600',
  },
  tileSubtitleSecondary: {
    color: '#8EA5C6',
  },
  tileSubtitleSelected: {
    color: '#C7DDFF',
  },
  tileChevron: {
    color: '#79A5D9',
    fontSize: TEXT.sm,
    fontWeight: '800',
    width: 14,
    textAlign: 'right',
  },
  tileChevronSecondary: {
    color: '#79A5D9',
  },
  emptyText: {
    color: '#9FB0C8',
    fontSize: TEXT.sm,
  },
  chooseExerciseHint: {
    marginTop: SPACING.lg,
    color: '#9FB0C8',
    fontSize: TEXT.sm,
    fontWeight: '700',
  },
  insightsWrap: {
    flexBasis: '100%',
    marginTop: SPACING.sm,
  },
  progressCard: {
    backgroundColor: '#0C1A33',
    borderRadius: RADIUS.lg + 2,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.28)',
    padding: SPACING.lg,
    shadowColor: '#2F6FBC',
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 2,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.md,
  },
  progressMetricChip: {
    minHeight: 26,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    paddingHorizontal: SPACING.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressMetricChipText: {
    fontSize: TEXT.xs,
    fontWeight: '700',
    letterSpacing: 0.28,
    textTransform: 'uppercase',
  },
  progressTitle: {
    color: '#F8FBFF',
    fontSize: TEXT.lg,
    fontWeight: '700',
  },
  insightsSubtitle: {
    marginTop: 6,
    marginBottom: SPACING.md,
    color: '#A9BCD8',
    fontSize: TEXT.xs,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  progressSubtitle: {
    color: '#9CA3AF',
    marginBottom: SPACING.sm,
    fontSize: TEXT.sm,
    fontWeight: '700',
  },
  insightsSelectedExercise: {
    marginTop: 2,
    marginBottom: SPACING.sm,
    gap: 2,
  },
  insightsSelectedExerciseMain: {
    color: '#F8FBFF',
    fontSize: TEXT.sm,
    fontWeight: '800',
  },
  insightsSelectedExerciseParen: {
    color: '#A9BCD8',
    fontSize: TEXT.xs,
    fontWeight: '700',
  },
  insightsProgression: {
    marginBottom: SPACING.md,
  },
  insightsProgressionHeadline: {
    color: '#F8FBFF',
    fontSize: TEXT.md,
    fontWeight: '900',
    lineHeight: TEXT.md + 4,
  },
  insightsProgressionDelta: {
    fontSize: TEXT.md,
    fontWeight: '900',
  },
  insightsProgressionDetail: {
    color: '#DFEBFF',
    fontSize: TEXT.sm,
    fontWeight: '800',
  },
  insightsMicrocopy: {
    marginTop: 4,
    fontSize: TEXT.xs,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  insightsEmpty: {
    marginBottom: SPACING.md,
    color: '#9FB0C8',
    fontSize: TEXT.sm,
    fontWeight: '700',
  },
  insightsRow: {
    marginTop: SPACING.sm,
    gap: 6,
  },
  insightsLabel: {
    color: '#A9BCD8',
    fontSize: TEXT.xs,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  insightsValue: {
    color: '#F3F8FF',
    fontSize: TEXT.sm,
    fontWeight: '800',
  },
  feedbackCard: {
    marginTop: SPACING.sm,
    borderRadius: RADIUS.md + 2,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: 4,
  },
  feedbackCardTitle: {
    fontSize: TEXT.xs,
    fontWeight: '800',
    letterSpacing: 0.24,
    textTransform: 'uppercase',
  },
  feedbackCardDetail: {
    color: '#EAF1FF',
    fontSize: TEXT.sm,
    fontWeight: '700',
  },
  nextSetCard: {
    marginTop: SPACING.sm,
    borderRadius: RADIUS.md + 2,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.24)',
    backgroundColor: 'rgba(148, 163, 184, 0.08)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: 3,
  },
  nextSetTitle: {
    fontSize: TEXT.xs,
    fontWeight: '800',
    letterSpacing: 0.24,
    textTransform: 'uppercase',
  },
  nextSetMain: {
    color: '#F8FBFF',
    fontSize: TEXT.sm,
    fontWeight: '800',
  },
  nextSetDetail: {
    color: '#C5D4EA',
    fontSize: TEXT.xs,
    fontWeight: '700',
  },
  plateauCard: {
    marginTop: SPACING.sm,
    borderRadius: RADIUS.md + 2,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: 4,
  },
  plateauTitle: {
    fontSize: TEXT.sm,
    fontWeight: '800',
  },
  plateauDetail: {
    color: '#EAF1FF',
    fontSize: TEXT.xs,
    fontWeight: '700',
  },
  plateauAction: {
    color: '#D7E6FF',
    fontSize: TEXT.xs,
    fontWeight: '700',
  },
  insightsDivider: {
    marginTop: SPACING.lg,
    marginBottom: SPACING.lg,
    height: 1,
    backgroundColor: 'rgba(148, 163, 184, 0.24)',
  },
  controlsSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm + 1,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md + 2,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.24)',
    backgroundColor: 'rgba(148, 163, 184, 0.12)',
  },
  controlsSummaryText: {
    flex: 1,
    minWidth: 0,
    color: '#C5D4EA',
    fontSize: TEXT.xs,
    fontWeight: '800',
  },
  controlsSummaryChevron: {
    color: '#C5D4EA',
    fontSize: TEXT.xs,
    fontWeight: '900',
  },
  controlTray: {
    overflow: 'hidden',
    backgroundColor: '#0A162C',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.22)',
    padding: SPACING.md,
    gap: SPACING.xs + 2,
  },
  controlTrayLabel: {
    color: '#A9BCD8',
    fontSize: TEXT.xs,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
    marginTop: SPACING.md,
  },
  kpiCard: {
    flexGrow: 1,
    flexBasis: '30%',
    minWidth: 150,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.18)',
    backgroundColor: '#020617',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
  },
  kpiLabel: {
    color: '#94A3B8',
    fontSize: TEXT.xs,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  kpiLabelLatest: {
    color: '#60A5FA',
  },
  kpiLabelPr: {
    color: '#FBBF24',
  },
  kpiLabelUp: {
    color: '#6EE7B7',
  },
  kpiLabelDown: {
    color: '#FDBA74',
  },
  kpiLabelNeutral: {
    color: '#94A3B8',
  },
  kpiValue: {
    marginTop: 4,
    color: '#F9FAFB',
    fontSize: TEXT.md,
    fontWeight: '900',
  },
  kpiValueLast: {
    color: '#F8FAFC',
  },
  kpiValuePr: {
    color: '#FBBF24',
  },
  kpiSub: {
    marginTop: 2,
    color: '#94A3B8',
    fontSize: TEXT.xs,
    fontWeight: '700',
  },
  kpiSubMuted: {
    color: '#64748B',
    fontWeight: '700',
  },
  deltaUp: {
    color: '#86EFAC',
  },
  deltaDown: {
    color: '#FDBA74',
  },
  deltaNeutral: {
    color: '#E5E7EB',
  },
  targetCard: {
    marginTop: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
    backgroundColor: '#091429',
    padding: SPACING.md,
  },
  targetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.md,
  },
  targetLabel: {
    color: '#A9BCD8',
    fontSize: TEXT.xs,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  targetValue: {
    color: '#F8FBFF',
    fontSize: TEXT.sm,
    fontWeight: '900',
  },
  progressTrack: {
    marginTop: SPACING.sm,
    height: 10,
    borderRadius: RADIUS.pill,
    backgroundColor: '#10213E',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: RADIUS.pill,
  },
  targetHint: {
    marginTop: SPACING.xs,
    color: '#A9BCD8',
    fontSize: TEXT.xs,
    fontWeight: '700',
  },
  controlsRow: {
    marginTop: SPACING.lg,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  segment: {
    flexDirection: 'row',
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.24)',
    backgroundColor: '#081227',
    overflow: 'hidden',
  },
  segmentButton: {
    minHeight: 36,
    paddingHorizontal: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentButtonSelected: {
    backgroundColor: '#122447',
  },
  segmentText: {
    color: '#A9BCD8',
    fontSize: TEXT.xs,
    fontWeight: '800',
  },
  segmentTextSelected: {
    color: '#F8FBFF',
  },
  chartHeader: {
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  chartCaption: {
    color: '#A9BCD8',
    fontSize: TEXT.xs,
    fontWeight: '800',
  },
  chartLegendRow: {
    marginTop: SPACING.xs,
    marginBottom: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  chartLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  chartLegendLine: {
    width: 16,
    height: CHART_TREND_LINE_THICKNESS,
    borderRadius: 999,
  },
  chartLegendDotWrap: {
    width: CHART_POINT_SIZE + 6,
    height: CHART_POINT_SIZE + 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartLegendDotCore: {
    width: CHART_POINT_SIZE,
    height: CHART_POINT_SIZE,
    borderRadius: CHART_POINT_SIZE / 2,
    backgroundColor: COLORS.success,
  },
  chartLegendDotRing: {
    position: 'absolute',
    width: CHART_POINT_SIZE + 6,
    height: CHART_POINT_SIZE + 6,
    borderRadius: (CHART_POINT_SIZE + 6) / 2,
    borderWidth: 1,
    borderColor: COLORS.success,
  },
  chartLegendText: {
    color: '#A9BCD8',
    fontSize: TEXT.xs,
    fontWeight: '700',
  },
  chartControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  chartControlButton: {
    minWidth: 28,
    height: 28,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.24)',
    backgroundColor: '#081227',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartControlText: {
    color: '#EAF1FF',
    fontSize: TEXT.sm,
    fontWeight: '800',
  },
  chartResetButton: {
    height: 28,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.24)',
    backgroundColor: '#081227',
    paddingHorizontal: SPACING.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartResetButtonDisabled: {
    opacity: 0.5,
  },
  chartResetText: {
    color: '#9FC6FB',
    fontSize: TEXT.xs,
    fontWeight: '800',
  },
  chartResetTextDisabled: {
    color: '#6E819D',
  },
  chart: {
    marginBottom: SPACING.md,
    borderRadius: RADIUS.lg + 2,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.22)',
    backgroundColor: '#081227',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    shadowColor: '#2F6FBC',
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  chartYAxis: {
    width: CHART_AXIS_WIDTH,
    height: CHART_HEIGHT,
    position: 'relative',
  },
  chartYAxisLabel: {
    position: 'absolute',
    right: SPACING.xs,
    color: '#B4C7E4',
    fontSize: TEXT.xs,
    fontWeight: '800',
  },
  chartPlot: {
    flex: 1,
    height: CHART_HEIGHT,
    position: 'relative',
    borderRadius: RADIUS.md,
    overflow: 'visible',
  },
  chartGridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(168, 189, 220, 0.24)',
  },
  chartLine: {
    position: 'absolute',
    borderRadius: 999,
  },
  chartTrendLine: {
    position: 'absolute',
    borderRadius: 999,
  },
  chartPoint: {
    position: 'absolute',
    width: CHART_POINT_SIZE,
    height: CHART_POINT_SIZE,
    borderRadius: CHART_POINT_SIZE / 2,
    borderWidth: 1,
  },
  chartPrRing: {
    position: 'absolute',
    width: CHART_POINT_SIZE + 6,
    height: CHART_POINT_SIZE + 6,
    borderRadius: (CHART_POINT_SIZE + 6) / 2,
    borderWidth: 1,
    borderColor: COLORS.success,
    opacity: 0.9,
  },
  chartUnit: {
    position: 'absolute',
    right: SPACING.xs,
    top: SPACING.xs,
    color: '#9FB0C8',
    fontSize: TEXT.xs,
    fontWeight: '800',
  },
  chartTooltip: {
    position: 'absolute',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.34)',
    backgroundColor: 'rgba(6, 13, 27, 0.98)',
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    gap: 2,
    zIndex: 5,
  },
  chartTooltipTitle: {
    color: '#CFE0FA',
    fontSize: TEXT.xs,
    fontWeight: '700',
  },
  chartTooltipValue: {
    color: '#F8FBFF',
    fontSize: TEXT.xs,
    fontWeight: '900',
  },
  chartTooltipDetail: {
    color: '#A9BCD8',
    fontSize: TEXT.xs,
    fontWeight: '700',
  },
  chartTooltipPr: {
    color: COLORS.success,
    fontSize: TEXT.xs,
    fontWeight: '800',
  },
  chartTooltipLabel: {
    color: '#9FB0C8',
    fontSize: TEXT.xs,
    fontWeight: '700',
  },
  chartXAxis: {
    marginTop: SPACING.xs,
    marginLeft: CHART_AXIS_WIDTH,
    paddingHorizontal: CHART_X_PADDING,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  chartXAxisLabel: {
    color: '#9FB0C8',
    fontSize: TEXT.xs,
    fontWeight: '800',
  },
  table: {
    marginTop: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: 'rgba(148, 163, 184, 0.26)',
  },
  tableToggle: {
    marginTop: SPACING.sm,
    alignSelf: 'flex-start',
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.24)',
    backgroundColor: 'rgba(148, 163, 184, 0.1)',
  },
  tableToggleText: {
    color: '#CFE0FA',
    fontSize: TEXT.xs,
    fontWeight: '800',
  },
  row: {
    flexDirection: 'row',
    paddingVertical: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.16)',
  },
  headerRow: {
    backgroundColor: '#0A162C',
  },
  cell: {
    fontSize: TEXT.xs,
    color: '#EAF1FF',
  },
  cellDate: {
    flex: 1.6,
  },
  cellMetric: {
    flex: 1,
    textAlign: 'right',
  },
});

