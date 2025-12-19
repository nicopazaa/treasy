import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { AppState } from '../types';
import { getWorkoutDates, getDailyWorkout, groupDailySets, GroupedDailySetView } from '../services/workoutService';
import { getBlockTone } from '../utils/blockTone';
import { formatRelativeDayLabel, formatWeekday, formatDate } from '../utils/dateLabels';
import { SPACING, TEXT, RADIUS } from '../theme/tokens';
import { t } from '../i18n/i18n';

type Props = {
  appState: AppState;
  onBack: () => void;
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

function formatSetSummary(sets: Array<{ weight: number; reps: number }>): string {
  return sets.map((s) => `${s.weight} kg x ${s.reps}`).join(', ');
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

export const HistoryScreen: React.FC<Props> = ({ appState, onBack }) => {
  const language = appState.language ?? 'en';
  const days = useMemo(() => buildDayNodes(appState, language), [appState, language]);
  const [expandedKey, setExpandedKey] = useState<string | null>(
    days.length > 0 ? days[0].dateKey : null
  );

  const toggle = (key: string) => {
    setExpandedKey((prev) => (prev === key ? null : key));
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={8}>
          <Text style={styles.backText}>{t(language, 'back')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t(language, 'historyTitle')}</Text>
      </View>

      <Text style={styles.headerSubtitle}>{t(language, 'historySubtitle')}</Text>

      {days.length === 0 ? (
        <View style={styles.emptyContainer}>
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
                              <Text style={styles.groupTitle}>
                                <Text style={styles.exerciseName}>{group.exerciseName}</Text>
                                {group.blockName ? (
                                  <Text style={[styles.blockName, { color: tone.accent }]}>
                                    {' '}
                                    ({group.blockName})
                                  </Text>
                                ) : null}
                              </Text>
                              <Text style={styles.groupDetail}>{formatSetSummary(group.sets)}</Text>
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xxxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  backText: {
    color: '#60A5FA',
    fontSize: TEXT.sm,
    marginRight: SPACING.lg,
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
  groupTitle: {
    fontSize: TEXT.sm,
    fontWeight: '600',
  },
  exerciseName: {
    color: '#F9FAFB',
  },
  blockName: {
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
