import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { AppState } from '../types';
import {
  getWorkoutDates,
  getDailyWorkout,
  DailySetView,
} from '../services/workoutService';
import { getBlockTone } from '../utils/blockTone';
import { formatRelativeDayLabel, formatWeekday, formatDate } from '../utils/dateLabels';
import { SPACING, TEXT, RADIUS } from '../theme/tokens';

type Props = {
  appState: AppState;
  onBack: () => void;
};

type DayNode = {
  dateKey: string;
  dateLabel: string;
  dayLabel: string;
  sets: DailySetView[];
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

function buildDayNodes(appState: AppState): DayNode[] {
  const keys = getWorkoutDates(appState); // forventes sortert nyeste fA,rst
  return keys.map((key) => {
    const dt = parseDateKey(key);
    let dateLabel = key;
    let dayLabel = '';

    if (dt) {
      const relative = formatRelativeDayLabel(dt);
      dateLabel = formatDate(dt);
      dayLabel = relative ?? formatWeekday(dt);
    }

    const sets = getDailyWorkout(appState, key);
    return {
      dateKey: key,
      dateLabel,
      dayLabel,
      sets,
    };
  });
}

export const HistoryScreen: React.FC<Props> = ({ appState, onBack }) => {
  const days = useMemo(() => buildDayNodes(appState), [appState]);
  const [expandedKey, setExpandedKey] = useState<string | null>(
    days.length > 0 ? days[0].dateKey : null
  );

  const toggle = (key: string) => {
    setExpandedKey((prev) => (prev === key ? null : key));
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.backText}>{'< Tilbake'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tidligere A,kter</Text>
      </View>

      <Text style={styles.headerSubtitle}>
        Bla i treningsdagboken din. Hver dato viser alle A,velser og sett du logget den dagen.
      </Text>

      {days.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>Ingen A,kter enda</Text>
          <Text style={styles.emptyText}>
            Logg noen A,kter fA,rst, sA dukker de opp her pA tidslinjen.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {days.map((day, index) => {
            const isLast = index === days.length - 1;
            const isExpanded = expandedKey === day.dateKey;

            return (
              <View key={day.dateKey} style={styles.row}>
                {/* Tidslinje-kolonne */}
                <View style={styles.timelineColumn}>
                  <View style={styles.timelineDot} />
                  {!isLast && <View style={styles.timelineLine} />}
                </View>

                {/* Kort for selve dagen */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => toggle(day.dateKey)}
                  style={[styles.card, isExpanded && styles.cardExpanded]}
                >
                  <View style={styles.cardHeader}>
                    <View>
                      <Text style={styles.dayLabel}>{day.dayLabel}</Text>
                      <Text style={styles.dateLabel}>{day.dateLabel}</Text>
                    </View>
                    <Text style={styles.chevron}>{isExpanded ? 'ƒ-ý' : 'ƒ-¬'}</Text>
                  </View>

                  {isExpanded && (
                    <View style={styles.setList}>
                      {day.sets.map((set) => {
                        const tone = getBlockTone(set.blockId ?? set.blockName ?? '');
                        return (
                          <View key={set.id} style={styles.setRow}>
                            <View style={styles.setTextColumn}>
                              <Text style={styles.setTitle}>
                                <Text style={styles.exerciseName}>{set.exerciseName}</Text>
                                {set.blockName ? (
                                  <Text style={[styles.blockName, { color: tone.accent }]}> ({set.blockName})</Text>
                                ) : null}
                              </Text>
                              <Text style={styles.setDetail}>
                                {set.weight} kg x {set.reps} reps
                              </Text>
                            </View>
                            <Text style={styles.setTime}>{set.time}</Text>
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
    fontWeight: '600',
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
    backgroundColor: '#020617',
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
    fontWeight: '600',
  },
  chevron: {
    color: '#9CA3AF',
    fontSize: TEXT.sm,
  },
  setList: {
    marginTop: SPACING.sm,
  },
  setRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: SPACING.xs,
  },
  setTextColumn: {
    flexShrink: 1,
    paddingRight: SPACING.sm,
  },
  setTitle: {
    fontSize: TEXT.sm,
    fontWeight: '500',
  },
  exerciseName: {
    color: '#F9FAFB',
  },
  blockName: {
    color: '#93C5FD',
    fontWeight: '600',
  },
  setDetail: {
    color: '#9CA3AF',
    fontSize: TEXT.xs,
  },
  setTime: {
    color: '#9CA3AF',
    fontSize: TEXT.xs,
  },
});
