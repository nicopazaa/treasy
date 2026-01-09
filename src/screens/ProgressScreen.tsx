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
import { AppState, TrainingBlock, Exercise, SetEntry, TrainingBlockId } from '../features/workouts/model/types';
import { getBlockTone, getDotColor } from '../shared/theme/blockTone';
import { formatRelativeDateTime, formatShortDate } from '../shared/utils/dateLabels';
import { SPACING, TEXT, RADIUS, SCREEN_PADDING, COLORS } from '../shared/theme/tokens';
import { blockLabel, t, type StringKey } from '../shared/i18n/i18n';
import { formatExerciseLabel } from '../shared/utils/exerciseLabel';
import { formatWeight, fromKg, roundForDisplay, toKg, type MassUnit } from '../shared/utils/units';
import { useBackSwipeContext } from '../app/navigation/BackSwipeContext';

interface Props {
  appState: AppState;
  onBack: () => void;
}

type TimeRange = 'all' | '90d' | '30d';
type Metric = 'weight' | 'oneRm' | 'volume' | 'reps';
type Aggregation = 'day' | 'month' | 'year';
type TileVariant = 'primary' | 'secondary';

const RANGE_LABEL_KEY: Record<TimeRange, StringKey> = {
  all: 'progress.range.all',
  '90d': 'progress.range.90d',
  '30d': 'progress.range.30d',
};

const AGGREGATION_LABEL_KEY: Record<Aggregation, StringKey> = {
  day: 'progress.aggregation.day',
  month: 'progress.aggregation.month',
  year: 'progress.aggregation.year',
};

const CHART_AXIS_WIDTH = 56;
const CHART_HEIGHT = 140;
const CHART_X_PADDING = 10;
const CHART_Y_PADDING_TOP = 12;
const CHART_Y_PADDING_BOTTOM = 12;
const CHART_POINT_SIZE = 10;
const CHART_LINE_THICKNESS = 2;

const MAIN_BLOCK_ORDER: TrainingBlockId[] = ['chest', 'shoulders', 'back', 'arms', 'core', 'legs'];
const MODE_BLOCK_IDS: TrainingBlockId[] = ['cardio', 'bodyweight'];
const VALID_BLOCK_IDS = new Set<string>([...MAIN_BLOCK_ORDER, ...MODE_BLOCK_IDS]);
const BLOCK_ICONS: Partial<Record<TrainingBlockId, ImageSourcePropType>> = {
  chest: require('../assets/chest.png'),
  shoulders: require('../assets/shoulder.png'),
  back: require('../assets/back.png'),
  arms: require('../assets/arms.png'),
  core: require('../assets/core.png'),
  legs: require('../assets/leggs.png'),
  cardio: require('../assets/cardio.png'),
  bodyweight: require('../assets/bodyweight.png'),
};

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

function bucketStartMs(timestampMs: number, aggregation: Aggregation): number {
  const date = new Date(timestampMs);
  if (aggregation === 'year') return new Date(date.getFullYear(), 0, 1).getTime();
  if (aggregation === 'month') return new Date(date.getFullYear(), date.getMonth(), 1).getTime();
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function formatAggregationLabel(date: Date, aggregation: Aggregation, language: AppLanguage): string {
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

function aggregateChartRows(rows: SetRow[], aggregation: Aggregation, language: AppLanguage): ChartRow[] {
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
  const selectedBg = selected ? hexToRgba(accent, variant === 'primary' ? 0.18 : 0.12) : '#0B1220';
  const borderColor = selected
    ? hexToRgba(accent, variant === 'primary' ? 0.7 : 0.45)
    : 'rgba(148, 163, 184, 0.16)';
  const glowColor = selected ? accent : '#0B1220';
  const dotOpacity = variant === 'primary' ? 1 : 0.6;

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
        <Text
          style={[
            styles.tileLabel,
            variant === 'secondary' ? styles.tileLabelSecondary : null,
            selected ? styles.tileLabelSelected : null,
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
        {subtitle ? (
          <Text
            style={[
              styles.tileSubtitle,
              variant === 'secondary' ? styles.tileSubtitleSecondary : null,
              selected ? styles.tileSubtitleSelected : null,
            ]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Text style={[styles.tileChevron, { opacity: selected ? 1 : 0 }]}>{'>'}</Text>
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

  const selectedBg = selected ? hexToRgba(accent, 0.18) : '#0B1220';
  const borderColor = selected ? hexToRgba(accent, 0.75) : 'rgba(148, 163, 184, 0.2)';
  const glowColor = selected ? accent : '#0B1220';

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
        <View style={[styles.groupTileIconWrap, selected ? styles.groupTileIconWrapSelected : null]}>
          {icon ? (
            <Image source={icon} style={styles.groupTileIcon} resizeMode="contain" tintColor="#3B82F6" />
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
  const [aggregation, setAggregation] = useState<Aggregation>('day');
  const [metric, setMetric] = useState<Metric>('weight');
  const [chartWidth, setChartWidth] = useState(0);
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const [viewport, setViewport] = useState<{ startMs: number; endMs: number } | null>(null);
  const viewportRef = useRef<{ startMs: number; endMs: number } | null>(null);
  const gestureRef = useRef<{
    mode: 'pan' | 'pinch';
    startViewport: { startMs: number; endMs: number };
    startDistance: number;
  } | null>(null);
  const chartContainerRef = useRef<View>(null);
  const chartMeasureRaf = useRef<number | null>(null);

  const primaryBlocks = useMemo<TrainingBlock[]>(() => {
    const byId = new Map<string, TrainingBlock>(appState.blocks.map((block) => [block.id, block]));
    return MAIN_BLOCK_ORDER.map((id) => byId.get(id) ?? { id, name: blockLabel(id, language) });
  }, [appState.blocks, language]);
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
    const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000;
    return setRows.filter((row) => row.createdAtMs >= cutoffMs);
  }, [setRows, timeRange]);

  const rowsVisible: ChartRow[] = useMemo(() => {
    return aggregateChartRows(rowsInRange, aggregation, language);
  }, [aggregation, language, rowsInRange]);

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

  const chartStartLabel = viewRange
    ? formatAggregationLabel(new Date(viewRange.startMs), aggregation, language)
    : '';
  const chartEndLabel = viewRange
    ? formatAggregationLabel(new Date(viewRange.endMs), aggregation, language)
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

  const selectedExercise =
    selectedExerciseId && appState.exercises.find((e) => e.id === selectedExerciseId);

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

  const animateNext = () => {
    if (Platform.OS !== 'web') {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        onScroll={scheduleChartBlockerMeasure}
        scrollEventThrottle={16}
      >
        <TouchableOpacity onPress={onBack} hitSlop={12} style={styles.backButton} activeOpacity={0.8}>
          <Text style={styles.back}>{t(language, 'back')}</Text>
        </TouchableOpacity>

        <Text style={styles.title}>{t(language, 'progressScreenTitle')}</Text>
        <Text style={styles.subtitle}>{t(language, 'progressScreenSubtitle')}</Text>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>{t(language, 'muscleGroups')}</Text>
          <View style={styles.modeButtons}>
            <IconModeButton
              label={blockLabel('cardio', language)}
              icon={BLOCK_ICONS.cardio}
              accent={getBlockTone('cardio').accent}
              selected={selectedBlockId === 'cardio'}
              onPress={() => {
                animateNext();
                setSelectedBlockId('cardio');
                setSelectedExerciseId(null);
              }}
            />
            <IconModeButton
              label={blockLabel('bodyweight', language)}
              icon={BLOCK_ICONS.bodyweight}
              accent={getBlockTone('bodyweight').accent}
              selected={selectedBlockId === 'bodyweight'}
              onPress={() => {
                animateNext();
                setSelectedBlockId('bodyweight');
                setSelectedExerciseId(null);
              }}
            />
          </View>
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
            const icon = BLOCK_ICONS[item.id as TrainingBlockId];
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

        <Text style={[styles.sectionLabel, { marginTop: SPACING.xl }]}>{t(language, 'exercises')}</Text>
        {exercises.length === 0 ? (
          <Text style={styles.emptyText}>{t(language, 'noExercisesInBlock')}</Text>
        ) : (
          <View style={styles.tileRow}>
            {exercises.map((ex) => {
              const selected = ex.id === selectedExerciseId;
              const subtitle = exerciseSummaries.get(ex.id);
              return (
                <SelectableTile
                  key={ex.id}
                  label={formatExerciseLabel(ex)}
                  subtitle={subtitle}
                  accent={selectedBlockTone.accent}
                  selected={selected}
                  variant="secondary"
                  onPress={() => {
                    animateNext();
                    setSelectedExerciseId(ex.id);
                  }}
                />
              );
            })}
          </View>
        )}

        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressTitle}>{t(language, 'development')}</Text>
          </View>

          {selectedExercise && latestOverall ? (
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
            <Text style={styles.emptyText}>{t(language, 'chooseExerciseToSee')}</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: Platform.OS === 'ios' ? SPACING.sm : SPACING.xxxl,
    paddingBottom: SPACING.xxl,
    ...Platform.select({
      web: { width: '100%', maxWidth: 720, alignSelf: 'center' },
    }),
  },
  backButton: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  back: {
    color: '#93C5FD',
    fontSize: TEXT.sm,
    fontWeight: '600',
  },
  title: {
    fontSize: TEXT.xl,
    fontWeight: '700',
    color: '#F9FAFB',
  },
  subtitle: {
    marginTop: SPACING.xs,
    color: '#9CA3AF',
    fontSize: TEXT.sm,
  },
  sectionLabel: {
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
    color: '#F9FAFB',
    fontSize: TEXT.sm,
    fontWeight: '700',
  },
  sectionHeaderRow: {
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: SPACING.md,
  },
  sectionTitle: {
    color: '#F9FAFB',
    fontSize: TEXT.sm,
    fontWeight: '700',
    flex: 1,
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
    paddingBottom: SPACING.sm,
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
    minHeight: 78,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
    backgroundColor: '#0B1220',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
    shadowColor: '#0B1220',
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  groupTileSelected: {
    shadowOpacity: 0.45,
    elevation: 4,
  },
  groupTileDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  groupTileText: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: TEXT.md,
    fontWeight: '700',
    marginLeft: SPACING.xs,
  },
  groupTileTextSelected: {
    color: '#FFFFFF',
  },
  groupTileIconWrap: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 'auto',
    borderWidth: 1,
    borderColor: '#1F2937',
    backgroundColor: '#0F172A',
  },
  groupTileIconWrapSelected: {
    borderColor: '#1D4ED8',
  },
  groupTileIcon: {
    width: 22,
    height: 22,
  },
  groupTileFallbackDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  tileRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -SPACING.xs,
  },
  tile: {
    flexBasis: '48%',
    flexGrow: 1,
    margin: SPACING.xs,
    minHeight: 68,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.16)',
    backgroundColor: '#0B1220',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    gap: SPACING.md,
    shadowColor: '#0B1220',
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  tileSelected: {
    shadowOpacity: 0.5,
    elevation: 4,
  },
  tileSecondary: {
    minHeight: 72,
  },
  tilePressed: {
    opacity: 0.9,
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
    gap: 2,
  },
  tileLabel: {
    color: '#E2E8F0',
    fontSize: TEXT.sm,
    fontWeight: '700',
  },
  tileLabelSecondary: {
    color: '#CBD5F5',
    fontWeight: '600',
  },
  tileLabelSelected: {
    color: '#F8FAFC',
  },
  tileSubtitle: {
    color: '#94A3B8',
    fontSize: TEXT.xs,
    fontWeight: '600',
  },
  tileSubtitleSecondary: {
    color: '#8FA3C5',
  },
  tileSubtitleSelected: {
    color: '#CBD5F5',
  },
  tileChevron: {
    color: '#93C5FD',
    fontSize: TEXT.sm,
    fontWeight: '800',
    width: 14,
    textAlign: 'right',
  },
  emptyText: {
    color: '#9CA3AF',
    fontSize: TEXT.sm,
  },
  progressCard: {
    marginTop: SPACING.xxl,
    backgroundColor: '#0B1220',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
    padding: SPACING.xl,
    shadowColor: COLORS.blue2,
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.md,
  },
  progressTitle: {
    color: '#F9FAFB',
    fontSize: TEXT.lg,
    fontWeight: '800',
  },
  progressSubtitle: {
    color: '#9CA3AF',
    marginBottom: SPACING.sm,
    fontSize: TEXT.sm,
    fontWeight: '700',
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
    borderColor: '#111827',
    backgroundColor: '#020617',
    padding: SPACING.md,
  },
  targetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.md,
  },
  targetLabel: {
    color: '#9CA3AF',
    fontSize: TEXT.xs,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  targetValue: {
    color: '#F9FAFB',
    fontSize: TEXT.sm,
    fontWeight: '900',
  },
  progressTrack: {
    marginTop: SPACING.sm,
    height: 10,
    borderRadius: RADIUS.pill,
    backgroundColor: '#111827',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: RADIUS.pill,
  },
  targetHint: {
    marginTop: SPACING.xs,
    color: '#9CA3AF',
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
    borderColor: '#1F2937',
    backgroundColor: '#020617',
    overflow: 'hidden',
  },
  segmentButton: {
    minHeight: 36,
    paddingHorizontal: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentButtonSelected: {
    backgroundColor: '#0B1220',
  },
  segmentText: {
    color: '#9CA3AF',
    fontSize: TEXT.xs,
    fontWeight: '800',
  },
  segmentTextSelected: {
    color: '#F9FAFB',
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
    color: '#9CA3AF',
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
    borderColor: '#1F2937',
    backgroundColor: '#020617',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartControlText: {
    color: '#E5E7EB',
    fontSize: TEXT.sm,
    fontWeight: '800',
  },
  chartResetButton: {
    height: 28,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: '#1F2937',
    backgroundColor: '#020617',
    paddingHorizontal: SPACING.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartResetButtonDisabled: {
    opacity: 0.5,
  },
  chartResetText: {
    color: '#93C5FD',
    fontSize: TEXT.xs,
    fontWeight: '800',
  },
  chartResetTextDisabled: {
    color: '#6B7280',
  },
  chart: {
    marginBottom: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#111827',
    backgroundColor: '#020617',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    shadowColor: COLORS.blue2,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 1,
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
    color: '#9CA3AF',
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
    backgroundColor: '#111827',
  },
  chartLine: {
    position: 'absolute',
    borderRadius: 999,
  },
  chartPoint: {
    position: 'absolute',
    width: CHART_POINT_SIZE,
    height: CHART_POINT_SIZE,
    borderRadius: CHART_POINT_SIZE / 2,
    borderWidth: 2,
  },
  chartUnit: {
    position: 'absolute',
    right: SPACING.xs,
    top: SPACING.xs,
    color: '#6B7280',
    fontSize: TEXT.xs,
    fontWeight: '800',
  },
  chartTooltip: {
    position: 'absolute',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#1F2937',
    backgroundColor: 'rgba(2, 6, 23, 0.98)',
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    gap: 2,
    zIndex: 5,
  },
  chartTooltipTitle: {
    color: '#CBD5F5',
    fontSize: TEXT.xs,
    fontWeight: '700',
  },
  chartTooltipValue: {
    color: '#F9FAFB',
    fontSize: TEXT.xs,
    fontWeight: '900',
  },
  chartTooltipDetail: {
    color: '#94A3B8',
    fontSize: TEXT.xs,
    fontWeight: '700',
  },
  chartTooltipLabel: {
    color: '#9CA3AF',
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
    color: '#6B7280',
    fontSize: TEXT.xs,
    fontWeight: '800',
  },
  table: {
    marginTop: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: '#1F2937',
  },
  row: {
    flexDirection: 'row',
    paddingVertical: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: '#111827',
  },
  headerRow: {
    backgroundColor: '#020617',
  },
  cell: {
    fontSize: TEXT.xs,
    color: '#E5E7EB',
  },
  cellDate: {
    flex: 1.6,
  },
  cellMetric: {
    flex: 1,
    textAlign: 'right',
  },
});
