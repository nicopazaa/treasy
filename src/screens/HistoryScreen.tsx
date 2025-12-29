import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppState } from '../features/workouts/model/types';
import { getWorkoutDates, getDailyWorkout, groupDailySets, GroupedDailySetView } from '../features/workouts/model/workoutService';
import { getBlockTone, getDotColor } from '../shared/theme/blockTone';
import { formatRelativeDayLabel, formatWeekday, formatDate } from '../shared/utils/dateLabels';
import { SPACING, TEXT, RADIUS, SCREEN_PADDING } from '../shared/theme/tokens';
import { t } from '../shared/i18n/i18n';

type Props = {
  appState: AppState;
  onBack: () => void;
  initialExpandedDateKey?: string | null;
};

type DayNode = {
  dateKey: string;
  dateLabel: string;
  dayLabel: string;
  groups: BlockGroup[];
};

type BlockGroup = {
  blockId?: string;
  blockName?: string;
  time: string;
  exercises: GroupedDailySetView[];
};

function parseDateKey(dateKey: string): Date | null {
  const parts = dateKey.split('-');
  if (parts.length !== 3) return null;

  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);

  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function formatSetParts(
  language: AppState['language'],
  sets: Array<{
    weight: number;
    reps: number;
    isBodyweight?: boolean;
    distanceKm?: number | null;
    durationMin?: number | null;
    setType?: 'weighted' | 'bodyweight' | 'cardio';
  }>
): Array<{
  weightValue: string;
  weightUnit: string;
  repsText: string | null;
  index: number;
}> {
  return sets.map((s, idx) => ({
    weightValue:
      s.setType === 'cardio'
        ? s.distanceKm != null
          ? `${s.distanceKm} km`
          : s.durationMin != null
            ? `${s.durationMin} min`
            : `${s.weight}`
        : s.isBodyweight
          ? 'BW'
          : `${s.weight}`,
    weightUnit: s.setType === 'cardio' ? '' : s.isBodyweight ? '' : 'kg',
    repsText: s.setType === 'cardio' ? null : `${s.reps}r`,
    index: idx + 1,
  }));
}

function groupByBlock(groups: GroupedDailySetView[]): BlockGroup[] {
  const map = new Map<string, BlockGroup>();

  for (const group of groups) {
    const key = group.blockId ?? group.blockName ?? 'unknown';
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        blockId: group.blockId,
        blockName: group.blockName,
        time: group.time,
        exercises: [group],
      });
      continue;
    }
    existing.exercises.push(group);
    if (group.time < existing.time) existing.time = group.time;
  }

  return Array.from(map.values()).sort((a, b) => (a.time > b.time ? 1 : -1));
}

function buildDayNodes(appState: AppState, language: AppState['language']): DayNode[] {
  const keys = getWorkoutDates(appState);
  return keys.map((key) => {
    const dt = parseDateKey(key);
    let dateLabel = key;
    let dayLabel = '';

    if (dt) {
      const relative = formatRelativeDayLabel(dt, new Date(), language ?? 'en');
      dateLabel = formatDate(dt);
      dayLabel = relative ?? formatWeekday(dt, language ?? 'en');
    }

    const groups = groupByBlock(groupDailySets(getDailyWorkout(appState, key)));
    return { dateKey: key, dateLabel, dayLabel, groups };
  });
}

export const HistoryScreen: React.FC<Props> = ({ appState, onBack, initialExpandedDateKey }) => {
  const language = appState.language ?? 'en';
  const days = useMemo(() => buildDayNodes(appState, language), [appState, language]);
  const firstKey = days.length > 0 ? days[0].dateKey : null;
  const [expandedKey, setExpandedKey] = useState<string | null>(() => initialExpandedDateKey ?? firstKey);
  const [collapsedBlocks, setCollapsedBlocks] = useState<Set<string>>(new Set());
  const [collapsedExercises, setCollapsedExercises] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (initialExpandedDateKey != null) {
      setExpandedKey(initialExpandedDateKey);
    }
  }, [initialExpandedDateKey]);

  useEffect(() => {
    if (expandedKey == null && firstKey != null) {
      setExpandedKey(firstKey);
    }
  }, [expandedKey, firstKey]);

  const toggle = (key: string) => {
    setExpandedKey((prev) => (prev === key ? null : key));
  };

  const toggleBlockCollapsed = (blockKey: string) => {
    setCollapsedBlocks((prev) => {
      const next = new Set(prev);
      if (next.has(blockKey)) next.delete(blockKey);
      else next.add(blockKey);
      return next;
    });
  };

  const toggleExerciseCollapsed = (exerciseId: string) => {
    setCollapsedExercises((prev) => {
      const next = new Set(prev);
      if (next.has(exerciseId)) next.delete(exerciseId);
      else next.add(exerciseId);
      return next;
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} hitSlop={12} style={styles.backButton} activeOpacity={0.8}>
            <Text style={styles.backText}>{t(language, 'back')}</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.headerTitle}>{t(language, 'historyTitle')}</Text>
      </View>

      {days.length === 0 ? (
        <View style={[styles.emptyContainer, styles.content]}>
          <Text style={styles.emptyTitle}>{t(language, 'historyEmptyTitle')}</Text>
          <Text style={styles.emptyText}>{t(language, 'historyEmptyText')}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {days.map((day, index) => {
            const isLast = index === days.length - 1;
            const isExpanded = expandedKey === day.dateKey;

            return (
              <View key={day.dateKey} style={styles.row}>
                <View style={styles.timelineColumn}>
                  <View style={styles.timelineDot} />
                  {!isLast && <View style={styles.timelineLine} />}
                </View>

                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => toggle(day.dateKey)}
                  style={[styles.card, isExpanded && styles.cardExpanded]}
                >
                  <View style={styles.cardHeader}>
                    <View>
                      <Text style={styles.dayLabel}>{day.dayLabel}</Text>
                      <Text style={styles.dateLabel}>{day.dateLabel}</Text>
                    </View>
                    <Text style={styles.chevron}>{isExpanded ? 'v' : '>'}</Text>
                  </View>

                  {isExpanded && (
                    <View style={styles.groupList}>
                      {day.groups.map((block) => {
                        const tone = getBlockTone(block.blockId ?? block.blockName ?? '');
                        const dotColor = getDotColor(block.blockId ?? block.blockName ?? '');
                        const blockKey = block.blockId ?? block.blockName ?? block.exercises[0]?.id ?? 'block';
                        const blockSetCount = block.exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
                        const isBlockCollapsed = collapsedBlocks.has(blockKey);
                        return (
                          <View key={blockKey} style={styles.blockGroup}>
                            {block.blockName ? (
                              <TouchableOpacity
                                style={styles.blockHeaderRow}
                                onPress={() => toggleBlockCollapsed(blockKey)}
                                activeOpacity={0.85}
                              >
                                <Text style={[styles.blockLabel, { color: dotColor }]}>
                                  {block.blockName}
                                </Text>
                                <Text style={styles.blockSummary}>
                                  Sett: {blockSetCount} {isBlockCollapsed ? '>' : 'v'}
                                </Text>
                              </TouchableOpacity>
                            ) : null}
                            {!isBlockCollapsed && (
                              <View style={styles.blockExercises}>
                                {block.exercises.map((group) => {
                                  const isExerciseCollapsed = collapsedExercises.has(group.id);
                                  return (
                                    <View key={group.id} style={styles.groupRow}>
                                      <View
                                        style={[
                                          styles.blockLine,
                                          {
                                            backgroundColor: tone.soft,
                                            top: SPACING.xs * -1,
                                            bottom:
                                              group === block.exercises[block.exercises.length - 1]
                                                ? 16
                                                : -SPACING.xs,
                                          },
                                        ]}
                                      />
                                      {group === block.exercises[block.exercises.length - 1] ? (
                                        <View
                                          style={[
                                            styles.blockLineEnd,
                                            { backgroundColor: tone.soft },
                                          ]}
                                        />
                                      ) : null}
                                      <View style={styles.groupTextColumn}>
                                        <TouchableOpacity
                                          onPress={() => toggleExerciseCollapsed(group.id)}
                                          activeOpacity={0.85}
                                          style={styles.exerciseRow}
                                        >
                                          <View style={styles.exerciseTitleColumn}>
                                            <View style={styles.exerciseTitleRow}>
                                              <View style={[styles.exerciseDot, { backgroundColor: dotColor }]} />
                                              <Text style={styles.exerciseName}>{group.exerciseLabel}</Text>
                                            </View>
                                            <View
                                              style={[
                                                styles.exerciseDivider,
                                                { backgroundColor: dotColor },
                                              ]}
                                            />
                                          </View>
                                          <Text style={styles.exerciseSummary}>
                                            Sett: {group.sets.length} {isExerciseCollapsed ? '>' : 'v'}
                                          </Text>
                                        </TouchableOpacity>
                                        {!isExerciseCollapsed && (
                                          <View style={styles.setList}>
                                            {formatSetParts(language, group.sets).map((line, idx) => (
                                              <Text
                                                key={`${group.id}-set-${idx}`}
                                                style={styles.groupDetail}
                                              >
                                                <Text style={styles.indexText}>[{line.index}] </Text>
                                                <Text style={styles.goldText}>{line.weightValue}</Text>
                                                {line.weightUnit ? <Text style={styles.whiteText}>{line.weightUnit}</Text> : null}
                                                {line.repsText ? (
                                                  <>
                                                    <Text style={styles.mutedText}> x </Text>
                                                    <Text style={styles.goldText}>{line.repsText}</Text>
                                                  </>
                                                ) : null}
                                              </Text>
                                            ))}
                                          </View>
                                        )}
                                      </View>
                                      <Text style={styles.groupTime}>{group.time}</Text>
                                    </View>
                                  );
                                })}
                              </View>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
    paddingTop: Platform.OS === 'ios' ? SPACING.sm : SPACING.xxxl,
    ...Platform.select({
      web: { width: '100%', maxWidth: 720, alignSelf: 'center' },
    }),
  },
  setList: {
    gap: SPACING.sm,
    paddingLeft: SPACING.xl,
  },
  content: {
    paddingHorizontal: SCREEN_PADDING,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  backButton: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    marginRight: SPACING.lg,
  },
  backText: {
    color: '#60A5FA',
    fontSize: TEXT.sm,
    fontWeight: '600',
  },
  headerTitle: {
    color: '#3B82F6',
    fontSize: TEXT.xl,
    fontWeight: '700',
    marginLeft: SPACING.sm,
  },
  headerSubtitle: {
    color: '#9CA3AF',
    fontSize: TEXT.sm,
    marginBottom: SPACING.xl,
  },
  emptyContainer: {
    marginTop: SPACING.xxl,
    paddingHorizontal: SCREEN_PADDING,
  },
  emptyTitle: {
    color: '#F9FAFB',
    fontSize: TEXT.md,
    fontWeight: '700',
    marginBottom: SPACING.xs,
  },
  emptyText: {
    color: '#9CA3AF',
    fontSize: TEXT.sm,
  },
  scrollContent: {
    paddingHorizontal: SCREEN_PADDING,
    paddingBottom: SPACING.xxxl,
  },
  row: {
    flexDirection: 'row',
    marginBottom: SPACING.xxl,
  },
  timelineColumn: {
    width: 32,
    alignItems: 'center',
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#3B82F6',
    marginTop: SPACING.xs,
  },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: '#2563EB',
    marginTop: SPACING.xs,
  },
  card: {
    flex: 1,
    backgroundColor: '#020617',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#111827',
    padding: SPACING.md,
  },
  cardExpanded: {
    borderColor: '#3B82F6',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dayLabel: {
    color: '#9CA3AF',
    fontSize: TEXT.sm,
    textTransform: 'capitalize',
  },
  dateLabel: {
    color: '#60A5FA',
    fontSize: TEXT.md,
    fontWeight: '700',
  },
  chevron: {
    color: '#9CA3AF',
    fontSize: TEXT.sm,
    fontWeight: '700',
  },
  groupList: {
    marginTop: SPACING.sm,
  },
  blockGroup: {
    marginBottom: SPACING.md,
  },
  blockHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: SPACING.sm,
  },
  blockExercises: {
    gap: SPACING.md,
    paddingLeft: SPACING.lg,
    position: 'relative',
  },
  blockLine: {
    position: 'absolute',
    left: SPACING.sm,
    top: 0,
    bottom: 0,
    width: 2,
    borderRadius: 999,
  },
  blockLineEnd: {
    position: 'absolute',
    left: SPACING.sm,
    width: 16,
    height: 2,
    bottom: 16,
  },
  groupRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: SPACING.xs,
    paddingLeft: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  groupTextColumn: {
    flexShrink: 1,
    paddingRight: SPACING.sm,
  },
  blockLabel: {
    fontSize: TEXT.md,
    fontWeight: '800',
    marginBottom: 2,
  },
  blockSummary: {
    color: 'rgba(148,163,184,0.75)',
    fontSize: 11,
    fontWeight: '600',
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    paddingRight: SPACING.sm,
    outlineStyle: 'none',
    outlineWidth: 0,
  },
  exerciseTitleColumn: {
    flexShrink: 1,
    alignSelf: 'flex-start',
  },
  exerciseTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  exerciseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  exerciseName: {
    color: '#F9FAFB',
    fontSize: TEXT.sm,
    fontWeight: '700',
    letterSpacing: 0.15,
  },
  exerciseSummary: {
    color: 'rgba(148,163,184,0.75)',
    fontSize: 11,
    fontWeight: '600',
    marginLeft: SPACING.xs,
  },
  exerciseDivider: {
    height: StyleSheet.hairlineWidth,
    width: 182,
    alignSelf: 'flex-start',
    marginLeft: SPACING.sm + 8,
    marginTop: SPACING.xs,
    marginBottom: SPACING.xs + 2,
    opacity: 0.62,
    borderRadius: 999,
  },
  groupDetail: {
    color: '#9CA3AF',
    fontSize: TEXT.xs,
    fontWeight: '700',
  },
  setCountAbove: {
    marginLeft: SPACING.lg,
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
  },
  goldText: {
    color: '#E5E7EB',
    fontWeight: '800',
    fontSize: TEXT.xs,
  },
  whiteText: {
    color: '#9CA3AF',
    fontWeight: '700',
    fontSize: TEXT.xs,
  },
  indexText: {
    color: '#9CA3AF',
    fontWeight: '800',
    fontSize: TEXT.sm,
  },
  mutedText: {
    color: '#9CA3AF',
    fontWeight: '700',
  },
  greenText: {
    color: '#10B981',
    fontWeight: '800',
  },
  groupTime: {
    color: '#9CA3AF',
    fontSize: TEXT.xs,
  },
});
