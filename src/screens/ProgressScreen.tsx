import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, LayoutAnimation, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppLanguage } from '../shared/types';
import { AppState, TrainingBlock, Exercise, SetEntry, TrainingBlockId } from '../features/workouts/model/types';
import { getBlockTone } from '../shared/theme/blockTone';
import { formatRelativeDateTime } from '../shared/utils/dateLabels';
import { SPACING, TEXT, RADIUS, SCREEN_PADDING, COLORS } from '../shared/theme/tokens';
import { blockLabel, t, type StringKey } from '../shared/i18n/i18n';
import { formatExerciseLabel } from '../shared/utils/exerciseLabel';
import { formatWeight, toKg, type MassUnit } from '../shared/utils/units';

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

function metricValue(row: ProgressRow, metric: Metric): number {
  if (metric === 'oneRm') return row.oneRm;
  if (metric === 'reps') return row.reps;
  return row.weight;
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

  const rowsVisible: ProgressRow[] = useMemo(() => {
    const days = daysForRange(timeRange);
    if (!days) return rowsAll;
    const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000;
    return rowsAll.filter((row) => row.createdAtMs >= cutoffMs);
  }, [rowsAll, timeRange]);

  const chartMax = rowsVisible.reduce((max, row) => Math.max(max, metricValue(row, metric)), 0);

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
                    <View style={styles.chartBaseline} />
                    {rowsVisible.map((r, index) => {
                      const value = metricValue(r, metric);
                      const height = chartMax > 0 ? Math.max(6, (value / chartMax) * 120) : 6;
                      const isLatest = latestOverall?.id === r.id;
                      const isBestInView = value === chartMax && chartMax > 0;
                      return (
                        <View
                          key={`${r.id}-bar`}
                          style={[
                            styles.chartBar,
                            {
                              height,
                              backgroundColor: isBestInView ? COLORS.success : selectedBlockTone.accent,
                              opacity: isLatest ? 1 : 0.75,
                              borderColor: isLatest ? '#F9FAFB' : 'transparent',
                            },
                          ]}
                        />
                      );
                    })}
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
    height: 120,
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: SPACING.md,
    gap: SPACING.xs,
    paddingBottom: 4,
  },
  chartBaseline: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 4,
    height: 1,
    backgroundColor: '#111827',
  },
  chartBar: {
    width: 10,
    borderRadius: RADIUS.md,
    borderWidth: 1,
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
