import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, LayoutAnimation, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppLanguage } from '../shared/types';
import { AppState, TrainingBlock, Exercise, SetEntry, TrainingBlockId } from '../features/workouts/model/types';
import { getBlockTone } from '../shared/theme/blockTone';
import { formatRelativeDateTime, formatShortDate } from '../shared/utils/dateLabels';
import { SPACING, TEXT, RADIUS, SCREEN_PADDING, COLORS } from '../shared/theme/tokens';
import { blockLabel, t, type StringKey } from '../shared/i18n/i18n';
import { formatExerciseLabel } from '../shared/utils/exerciseLabel';
import { formatWeight, fromKg, roundForDisplay, toKg, type MassUnit } from '../shared/utils/units';

interface Props {
  appState: AppState;
  onBack: () => void;
}

type TimeRange = 'all' | '90d' | '30d';
type Metric = 'weight' | 'oneRm' | 'reps';

const RANGE_LABEL_KEY: Record<TimeRange, StringKey> = {
  all: 'progress.range.all',
  '90d': 'progress.range.90d',
  '30d': 'progress.range.30d',
};

const CHART_AXIS_WIDTH = 56;
const CHART_HEIGHT = 140;
const CHART_X_PADDING = 10;
const CHART_Y_PADDING_TOP = 12;
const CHART_Y_PADDING_BOTTOM = 12;
const CHART_POINT_SIZE = 10;
const CHART_LINE_THICKNESS = 2;

interface ProgressRow {
  id: string;
  createdAtMs: number;
  dateLabel: string;
  weight: number;
  reps: number;
  oneRm: number;
}

type NextTarget =
  | { kind: 'reps'; next: number; progress: number; diff: number }
  | { kind: 'weight'; nextKg: number; progress: number; diffKg: number };

type ChartPoint = {
  id: string;
  row: ProgressRow;
  x: number;
  y: number;
  value: number;
};

function metricValue(row: ProgressRow, metric: Metric): number {
  if (metric === 'oneRm') return row.oneRm;
  if (metric === 'reps') return row.reps;
  return row.weight;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function localeForLanguage(language: AppLanguage): string {
  if (language === 'nb') return 'nb-NO';
  if (language === 'es') return 'es-ES';
  return 'en-US';
}

function formatChartTick(language: AppLanguage, value: number, metric: Metric, massUnit: MassUnit): string {
  if (!Number.isFinite(value)) return '';
  if (metric === 'reps') return String(Math.round(value));
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

function labelForBlock(block: TrainingBlock, language: AppLanguage): string {
  const id = block.id as TrainingBlockId;
  if (['chest', 'shoulders', 'back', 'arms', 'core', 'legs', 'bodyweight'].includes(id)) {
    return blockLabel(id, language);
  }
  return block.name;
}

export const ProgressScreen: React.FC<Props> = ({ appState, onBack }) => {
  const language = appState.language ?? 'en';
  const massUnit = appState.massUnit ?? 'kg';
  const initialBlockId = appState.blocks.find((b) => b.id !== 'cardio')?.id ?? null;
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(initialBlockId);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('all');
  const [metric, setMetric] = useState<Metric>('weight');
  const [chartWidth, setChartWidth] = useState(0);
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const prAnim = useRef(new Animated.Value(0)).current;

  const blocks = appState.blocks.filter((b) => b.id !== 'cardio') as TrainingBlock[];
  const selectedBlockTone = getBlockTone(selectedBlockId ?? '');

  const exercises = useMemo(() => {
    if (!selectedBlockId) return [] as Exercise[];
    return appState.exercises.filter((e) => e.blockId === selectedBlockId) as Exercise[];
  }, [appState.exercises, selectedBlockId]);

  const rowsAll: ProgressRow[] = useMemo(() => {
    if (!selectedExerciseId) return [];

    const setsForExercise = appState.sets
      .filter((s) => s.exerciseId === selectedExerciseId)
      .sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1)) as SetEntry[];

    return setsForExercise.map((s) => {
      const createdAtMs = new Date(s.createdAt).getTime();
      const dateLabel = formatRelativeDateTime(new Date(s.createdAt), new Date(), language);
      return {
        id: s.id,
        createdAtMs,
        dateLabel,
        weight: s.weight,
        reps: s.reps,
        oneRm: estimateOneRm(s.weight, s.reps),
      };
    });
  }, [appState.sets, language, selectedExerciseId]);

  const hasWeightData = rowsAll.some((row) => row.weight > 0);

  useEffect(() => {
    if (!selectedExerciseId) return;

    setMetric((prev) => {
      if (!hasWeightData) return 'reps';
      if (prev === 'reps') return 'weight';
      return prev;
    });
  }, [hasWeightData, selectedExerciseId]);

  useEffect(() => {
    setSelectedPointId(null);
  }, [metric, selectedExerciseId, timeRange]);

  const rowsVisible: ProgressRow[] = useMemo(() => {
    const days = daysForRange(timeRange);
    if (!days) return rowsAll;
    const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000;
    return rowsAll.filter((row) => row.createdAtMs >= cutoffMs);
  }, [rowsAll, timeRange]);

  const rowsChart: ProgressRow[] = useMemo(() => {
    if (metric === 'reps') return rowsVisible;
    return rowsVisible.filter((row) => row.weight > 0);
  }, [metric, rowsVisible]);

  const chartValues = useMemo(() => {
    return rowsChart.map((row) => {
      if (metric === 'reps') return row.reps;
      const raw = fromKg(metricValue(row, metric), massUnit);
      return roundForDisplay(raw, massUnit);
    });
  }, [massUnit, metric, rowsChart]);

  const chartAxisCandidates = useMemo(() => {
    if (metric === 'reps') return [1, 2, 5, 10];
    if (massUnit === 'lb') return [1, 2, 5, 10];
    return [1, 2, 2.5, 5, 10];
  }, [massUnit, metric]);

  const chartAxis = useMemo(() => buildAxis(chartValues, 5, chartAxisCandidates), [chartAxisCandidates, chartValues]);

  const chartPoints = useMemo<ChartPoint[]>(() => {
    if (rowsChart.length === 0 || chartWidth <= 0) return [];
    const minMs = rowsChart[0].createdAtMs;
    const maxMs = rowsChart[rowsChart.length - 1].createdAtMs;
    return rowsChart.map((row, idx) => {
      const value = chartValues[idx] ?? 0;
      const x = xForChartTime(row.createdAtMs, minMs, maxMs, chartWidth);
      const y = yForChartValue(value, chartAxis.min, chartAxis.max);
      return { id: row.id, row, x, y, value };
    });
  }, [chartAxis.max, chartAxis.min, chartValues, chartWidth, rowsChart]);

  const chartStartLabel = rowsChart.length > 0 ? formatShortDate(new Date(rowsChart[0].createdAtMs)) : '';
  const chartEndLabel =
    rowsChart.length > 0 ? formatShortDate(new Date(rowsChart[rowsChart.length - 1].createdAtMs)) : '';

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
    const tooltipWidth = 190;
    const tooltipHeight = 56;
    const left = clamp(selectedChartPoint.x - tooltipWidth / 2, 0, Math.max(0, chartWidth - tooltipWidth));
    const top = clamp(selectedChartPoint.y - tooltipHeight - 10, 0, CHART_HEIGHT - tooltipHeight);
    return { left, top, width: tooltipWidth, minHeight: tooltipHeight };
  }, [chartWidth, selectedChartPoint]);

  const selectedExercise =
    selectedExerciseId && appState.exercises.find((e) => e.id === selectedExerciseId);

  const latestOverall = rowsAll.length > 0 ? rowsAll[rowsAll.length - 1] : null;
  const prevOverall = rowsAll.length > 1 ? rowsAll[rowsAll.length - 2] : null;
  const firstOverall = rowsAll.length > 0 ? rowsAll[0] : null;

  const bestAll = useMemo(() => {
    return rowsAll.reduce((max, row) => Math.max(max, metricValue(row, metric)), 0);
  }, [metric, rowsAll]);

  const bestAllWeight = useMemo(() => rowsAll.reduce((max, row) => Math.max(max, row.weight), 0), [rowsAll]);
  const bestAllOneRm = useMemo(() => rowsAll.reduce((max, row) => Math.max(max, row.oneRm), 0), [rowsAll]);
  const bestAllReps = useMemo(() => rowsAll.reduce((max, row) => Math.max(max, row.reps), 0), [rowsAll]);

  const bestWeightSet = useMemo<ProgressRow | null>(() => {
    if (rowsAll.length === 0) return null;
    return rowsAll.reduce((best, row) => {
      if (row.weight > best.weight) return row;
      if (row.weight < best.weight) return best;
      if (row.reps > best.reps) return row;
      if (row.reps < best.reps) return best;
      return row.createdAtMs > best.createdAtMs ? row : best;
    }, rowsAll[0]);
  }, [rowsAll]);

  const isNewPr = useMemo(() => {
    if (!latestOverall) return false;
    if (rowsAll.length < 2) return false;

    const prior = rowsAll.slice(0, -1);
    const priorBestWeight = prior.reduce((max, row) => Math.max(max, row.weight), 0);
    const priorBestOneRm = prior.reduce((max, row) => Math.max(max, row.oneRm), 0);
    const priorBestReps = prior.reduce((max, row) => Math.max(max, row.reps), 0);

    if (hasWeightData) {
      return (latestOverall.weight > 0 && latestOverall.weight > priorBestWeight) || latestOverall.oneRm > priorBestOneRm;
    }
    return latestOverall.reps > priorBestReps;
  }, [hasWeightData, latestOverall, rowsAll]);

  useEffect(() => {
    if (!isNewPr) return;
    prAnim.setValue(0);
    Animated.spring(prAnim, { toValue: 1, useNativeDriver: true }).start();
  }, [isNewPr, prAnim]);

  const prBadgeStyle = useMemo(() => {
    const scale = prAnim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] });
    const opacity = prAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
    return { transform: [{ scale }], opacity };
  }, [prAnim]);

  const deltaFromPrev = useMemo(() => {
    if (!latestOverall || !prevOverall) return null;
    return metricValue(latestOverall, metric) - metricValue(prevOverall, metric);
  }, [latestOverall, metric, prevOverall]);

  const deltaFromFirst = useMemo(() => {
    if (!latestOverall || !firstOverall) return null;
    return metricValue(latestOverall, metric) - metricValue(firstOverall, metric);
  }, [firstOverall, latestOverall, metric]);

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
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <TouchableOpacity onPress={onBack} hitSlop={12} style={styles.backButton} activeOpacity={0.8}>
          <Text style={styles.back}>{t(language, 'back')}</Text>
        </TouchableOpacity>

        <Text style={styles.title}>{t(language, 'progressScreenTitle')}</Text>
        <Text style={styles.subtitle}>{t(language, 'progressScreenSubtitle')}</Text>

        <Text style={styles.sectionLabel}>{t(language, 'muscleGroups')}</Text>
        <View style={styles.pillRow}>
          {blocks.map((block) => {
            const selected = block.id === selectedBlockId;
            const tone = getBlockTone(block.id);
            return (
              <TouchableOpacity
                key={block.id}
                style={[
                  styles.pill,
                  {
                    borderColor: selected ? tone.accent : '#1F2937',
                    backgroundColor: selected ? tone.soft : '#0B1220',
                  },
                ]}
                onPress={() => {
                  animateNext();
                  setSelectedBlockId(block.id);
                  setSelectedExerciseId(null);
                }}
                activeOpacity={0.9}
              >
                <View style={[styles.pillDot, { backgroundColor: tone.accent }]} />
                <Text style={[styles.pillText, selected && styles.pillTextSelected]}>
                  {labelForBlock(block, language)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.sectionLabel, { marginTop: SPACING.xl }]}>{t(language, 'exercises')}</Text>
        {exercises.length === 0 ? (
          <Text style={styles.emptyText}>{t(language, 'noExercisesInBlock')}</Text>
        ) : (
          <View style={styles.pillRow}>
            {exercises.map((ex) => {
              const selected = ex.id === selectedExerciseId;
              return (
                <TouchableOpacity
                  key={ex.id}
                  style={[
                    styles.pill,
                    {
                      borderColor: selected ? selectedBlockTone.accent : '#1F2937',
                      backgroundColor: selected ? selectedBlockTone.soft : '#0B1220',
                    },
                  ]}
                  onPress={() => {
                    animateNext();
                    setSelectedExerciseId(ex.id);
                  }}
                  activeOpacity={0.9}
                >
                  <View style={[styles.pillDot, { backgroundColor: selectedBlockTone.accent }]} />
                  <Text style={[styles.pillText, selected && styles.pillTextSelected]} numberOfLines={1}>
                    {formatExerciseLabel(ex)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressTitle}>{t(language, 'development')}</Text>
            {isNewPr ? (
              <Animated.View style={[styles.prBadge, prBadgeStyle]}>
                <Text style={styles.prBadgeText}>{t(language, 'progress.newPr')}</Text>
              </Animated.View>
            ) : null}
          </View>

          {selectedExercise && latestOverall ? (
            <>
              <Text style={[styles.progressSubtitle, { color: selectedBlockTone.accent }]} numberOfLines={1}>
                {formatExerciseLabel(selectedExercise)}
              </Text>

              <View style={styles.kpiGrid}>
                <View style={styles.kpiCard}>
                  <Text style={styles.kpiLabel}>{t(language, 'progress.latest')}</Text>
                  <Text style={styles.kpiValue} numberOfLines={1}>
                    {hasWeightData
                      ? `${formatWeight(latestOverall.weight, massUnit, language)} x ${latestOverall.reps}`
                      : `${latestOverall.reps} ${t(language, 'reps')}`}
                  </Text>
                  <Text style={styles.kpiSub}>{latestOverall.dateLabel}</Text>
                </View>

                <View style={styles.kpiCard}>
                  <Text style={styles.kpiLabel}>{t(language, 'progress.pr')}</Text>
                  <Text style={styles.kpiValue} numberOfLines={1}>
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
                  <Text style={styles.kpiLabel}>{t(language, 'progress.change')}</Text>
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
                  {hasWeightData ? (
                    <>
                      <TouchableOpacity
                        onPress={() => {
                          animateNext();
                          setMetric('weight');
                        }}
                        activeOpacity={0.9}
                        style={[styles.segmentButton, metric === 'weight' ? styles.segmentButtonSelected : null]}
                      >
                        <Text style={[styles.segmentText, metric === 'weight' ? styles.segmentTextSelected : null]}>
                          {t(language, 'weight')}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => {
                          animateNext();
                          setMetric('oneRm');
                        }}
                        activeOpacity={0.9}
                        style={[styles.segmentButton, metric === 'oneRm' ? styles.segmentButtonSelected : null]}
                      >
                        <Text style={[styles.segmentText, metric === 'oneRm' ? styles.segmentTextSelected : null]}>
                          {t(language, 'oneRm')}
                        </Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <View style={[styles.segmentButton, styles.segmentButtonSelected]}>
                      <Text style={[styles.segmentText, styles.segmentTextSelected]}>{t(language, 'reps')}</Text>
                    </View>
                  )}
                </View>
              </View>

                <Text style={styles.chartCaption}>
                  {metric === 'weight'
                    ? t(language, 'weightOverTime')
                    : metric === 'oneRm'
                      ? t(language, 'oneRmOverTime')
                      : t(language, 'repsOverTime')}
                </Text>

                {rowsVisible.length === 0 ? (
                  <Text style={styles.emptyText}>{t(language, 'progress.emptyRange')}</Text>
                ) : (
                  <>
                    <View style={styles.chart}>
                      <View style={styles.chartRow}>
                        <View style={styles.chartYAxis}>
                          {chartAxis.ticks.map((tick) => {
                            const y = yForChartValue(tick, chartAxis.min, chartAxis.max);
                            return (
                              <Text key={`y-${tick}`} style={[styles.chartYAxisLabel, { top: y - 7 }]}>
                                {formatChartTick(language, tick, metric, massUnit)}
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
                              <TouchableOpacity
                                key={`pt-${p.id}`}
                                onPress={() => setSelectedPointId((prev) => (prev === p.id ? null : p.id))}
                                activeOpacity={0.85}
                                hitSlop={10}
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
                              <Text style={styles.chartTooltipValue} numberOfLines={1}>
                                {metric === 'reps'
                                  ? `${selectedChartPoint.row.reps} ${t(language, 'reps')}`
                                  : metric === 'oneRm'
                                    ? formatWeight(selectedChartPoint.row.oneRm, massUnit, language)
                                    : `${formatWeight(selectedChartPoint.row.weight, massUnit, language)} x ${selectedChartPoint.row.reps}`}
                              </Text>
                              <Text style={styles.chartTooltipLabel} numberOfLines={1}>
                                {selectedChartPoint.row.dateLabel}
                              </Text>
                            </View>
                          ) : null}

                          <Text style={styles.chartUnit} numberOfLines={1}>
                            {metric === 'reps'
                              ? t(language, 'reps')
                              : t(language, massUnit === 'lb' ? 'units.lb' : 'units.kg')}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.chartXAxis}>
                        <Text style={styles.chartXAxisLabel}>{chartStartLabel}</Text>
                        <Text style={styles.chartXAxisLabel}>{chartEndLabel}</Text>
                      </View>
                    </View>

                    <View style={styles.table}>
                      {hasWeightData ? (
                        <View style={[styles.row, styles.headerRow]}>
                          <Text style={[styles.cell, styles.cellDate]}>{t(language, 'date')}</Text>
                        <Text style={[styles.cell, styles.cellWeight]}>{t(language, 'weight')}</Text>
                        <Text style={[styles.cell, styles.cellReps]}>{t(language, 'reps')}</Text>
                        <Text style={[styles.cell, styles.cellOneRm]}>{t(language, 'oneRmEst')}</Text>
                      </View>
                    ) : (
                      <View style={[styles.row, styles.headerRow]}>
                        <Text style={[styles.cell, styles.cellDate]}>{t(language, 'date')}</Text>
                        <Text style={[styles.cell, styles.cellOneRm]}>{t(language, 'reps')}</Text>
                      </View>
                    )}

                    {[...rowsVisible].reverse().map((r) => {
                      const isLatest = latestOverall?.id === r.id;
                      const rowIsBest =
                        metric === 'reps'
                          ? r.reps === bestAllReps && bestAllReps > 0
                          : metric === 'oneRm'
                            ? r.oneRm === bestAllOneRm && bestAllOneRm > 0
                            : r.weight === bestAllWeight && bestAllWeight > 0;
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
                          {hasWeightData ? (
                            <>
                              <Text style={[styles.cell, styles.cellWeight]}>{formatWeight(r.weight, massUnit, language)}</Text>
                              <Text style={[styles.cell, styles.cellReps]}>{r.reps}</Text>
                              <Text style={[styles.cell, styles.cellOneRm]}>{formatWeight(r.oneRm, massUnit, language)}</Text>
                            </>
                          ) : (
                            <Text style={[styles.cell, styles.cellOneRm]}>{r.reps}</Text>
                          )}
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
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -SPACING.xs,
  },
  pill: {
    flexBasis: '48%',
    flexGrow: 1,
    margin: SPACING.xs,
    minHeight: 54,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#1F2937',
    backgroundColor: '#0B1220',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    gap: SPACING.md,
  },
  pillDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  pillText: {
    color: '#E5E7EB',
    fontSize: TEXT.sm,
    fontWeight: '700',
    flex: 1,
  },
  pillTextSelected: {
    color: '#F9FAFB',
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
    borderColor: '#1F2937',
    padding: SPACING.lg,
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
  prBadge: {
    borderRadius: RADIUS.pill,
    backgroundColor: 'rgba(34, 197, 94, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.28)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  prBadgeText: {
    color: '#BBF7D0',
    fontSize: TEXT.xs,
    fontWeight: '900',
    letterSpacing: 0.4,
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
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  kpiCard: {
    flexGrow: 1,
    flexBasis: '30%',
    minWidth: 140,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#111827',
    backgroundColor: '#020617',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  kpiLabel: {
    color: '#9CA3AF',
    fontSize: TEXT.xs,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  kpiValue: {
    marginTop: 4,
    color: '#F9FAFB',
    fontSize: TEXT.md,
    fontWeight: '900',
  },
  kpiSub: {
    marginTop: 2,
    color: '#9CA3AF',
    fontSize: TEXT.xs,
    fontWeight: '700',
  },
  kpiSubMuted: {
    color: '#6B7280',
    fontWeight: '700',
  },
  deltaUp: {
    color: '#BBF7D0',
  },
  deltaDown: {
    color: '#FDE68A',
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
  chartCaption: {
    marginTop: SPACING.md,
    color: '#9CA3AF',
    fontSize: TEXT.xs,
    marginBottom: SPACING.xs,
  },
  chart: {
    marginBottom: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#111827',
    backgroundColor: '#020617',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
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
  chartTooltipValue: {
    color: '#F9FAFB',
    fontSize: TEXT.xs,
    fontWeight: '900',
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
    flex: 2.6,
  },
  cellWeight: {
    flex: 1.2,
  },
  cellReps: {
    flex: 0.9,
  },
  cellOneRm: {
    flex: 1.4,
    textAlign: 'right',
  },
});
