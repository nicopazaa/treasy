import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppState } from '../features/workouts/model/types';
import { getWorkoutDates, getDailyWorkout, groupDailySets, GroupedDailySetView } from '../features/workouts/model/workoutService';
import { getBlockTone } from '../shared/theme/blockTone';
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
  groups: GroupedDailySetView[];
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

function formatSetLines(
  language: AppState['language'],
  sets: Array<{ weight: number; reps: number }>
): string[] {
  const repsLabel = t(language ?? 'en', 'reps').toLowerCase();
  return sets.map((s) => `${s.weight} kg x ${s.reps} ${repsLabel}`);
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

    const groups = groupDailySets(getDailyWorkout(appState, key));
    return { dateKey: key, dateLabel, dayLabel, groups };
  });
}

export const HistoryScreen: React.FC<Props> = ({ appState, onBack, initialExpandedDateKey }) => {
  const language = appState.language ?? 'en';
  const days = useMemo(() => buildDayNodes(appState, language), [appState, language]);
  const firstKey = days.length > 0 ? days[0].dateKey : null;
  const [expandedKey, setExpandedKey] = useState<string | null>(() => initialExpandedDateKey ?? firstKey);

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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} hitSlop={12} style={styles.backButton} activeOpacity={0.8}>
            <Text style={styles.backText}>{t(language, 'back')}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t(language, 'historyTitle')}</Text>
        </View>

        <Text style={styles.headerSubtitle}>{t(language, 'historySubtitle')}</Text>
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
                      {day.groups.map((group) => {
                        const tone = getBlockTone(group.blockId ?? group.blockName ?? '');
                        return (
                          <View key={group.id} style={styles.groupRow}>
                            <View style={styles.groupTextColumn}>
                              {group.blockName ? (
                                <Text style={[styles.blockLabel, { color: tone.accent }]}>
                                  {group.blockName}
                                </Text>
                              ) : null}
                              <Text style={styles.exerciseName}>{group.exerciseLabel}</Text>
                              <View style={styles.setList}>
                                {formatSetLines(language, group.sets).map((line, idx) => (
                                  <Text key={`${group.id}-set-${idx}`} style={styles.groupDetail}>
                                    {line}
                                  </Text>
                                ))}
                              </View>
                            </View>
                            <Text style={styles.groupTime}>{group.time}</Text>
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
    gap: SPACING.xs,
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
    color: '#F9FAFB',
    fontSize: TEXT.xl,
    fontWeight: '700',
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
    backgroundColor: '#1F2937',
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
    color: '#F9FAFB',
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
  groupRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: SPACING.xs,
  },
  groupTextColumn: {
    flexShrink: 1,
    paddingRight: SPACING.sm,
  },
  blockLabel: {
    fontSize: TEXT.xs,
    fontWeight: '800',
    marginBottom: 2,
  },
  exerciseName: {
    color: '#F9FAFB',
    fontSize: TEXT.sm,
    fontWeight: '700',
  },
  groupDetail: {
    color: '#9CA3AF',
    fontSize: TEXT.xs,
    marginTop: 2,
  },
  groupTime: {
    color: '#9CA3AF',
    fontSize: TEXT.xs,
  },
});
