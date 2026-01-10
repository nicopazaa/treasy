import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { AppLanguage } from '../../../shared/types';
import { SPACING, TEXT as TEXT_TOKENS, RADIUS } from '../../../shared/theme/tokens';
import { t } from '../../../shared/i18n/i18n';
import { formatRelativeDayLabel } from '../../../shared/utils/dateLabels';
import type { WorkoutTimelineItem } from '../../../domain/analytics/insights';

type Props = {
  language: AppLanguage;
  items: WorkoutTimelineItem[];
  resolveBlockLabel: (blockId: string | null) => string | null;
  onPressDay: (dateKey: string) => void;
};

function localeForLanguage(language: AppLanguage): string {
  if (language === 'nb') return 'nb-NO';
  if (language === 'es') return 'es-ES';
  return 'en-US';
}

function parseDateKey(dateKey: string): Date | null {
  const parts = dateKey.split('-');
  if (parts.length !== 3) return null;
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

type PreviousWorkoutsPluralBaseKey =
  | 'analysis.previousWorkouts.exercises'
  | 'analysis.previousWorkouts.sets';

type PreviousWorkoutsPluralKey = `${PreviousWorkoutsPluralBaseKey}.${'one' | 'other'}`;

function pluralKey(base: PreviousWorkoutsPluralBaseKey, count: number): PreviousWorkoutsPluralKey {
  return `${base}.${count === 1 ? 'one' : 'other'}` as PreviousWorkoutsPluralKey;
}

export const PreviousWorkoutsTimeline: React.FC<Props> = ({
  language,
  items,
  resolveBlockLabel,
  onPressDay,
}) => {
  const formatDateLabel = (dateKey: string): string => {
    const dt = parseDateKey(dateKey);
    if (!dt) return dateKey;
    const relative = formatRelativeDayLabel(dt, new Date(), language);
    if (relative) return relative;
    return dt.toLocaleDateString(localeForLanguage(language), {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatSummary = (item: WorkoutTimelineItem): string => {
    const block = resolveBlockLabel(item.dominantBlockId);
    const exercises = t(language, pluralKey('analysis.previousWorkouts.exercises', item.exerciseCount), {
      count: item.exerciseCount,
    });
    const sets = t(language, pluralKey('analysis.previousWorkouts.sets', item.setCount), {
      count: item.setCount,
    });

    const parts = [];
    if (block) parts.push(block);
    parts.push(exercises, sets);
    return parts.join(' · ');
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t(language, 'analysis.previousWorkouts.title')}</Text>

      {items.length === 0 ? (
        <Text style={styles.empty}>{t(language, 'analysis.empty')}</Text>
      ) : (
        <View style={styles.list}>
          {items.map((item, index) => {
            const isLast = index === items.length - 1;
            return (
              <TouchableOpacity
                key={item.dateKey}
                style={styles.row}
                onPress={() => onPressDay(item.dateKey)}
                activeOpacity={0.85}
                hitSlop={8}
              >
                <View style={styles.timelineCol}>
                  <View style={styles.dot} />
                  {!isLast ? <View style={styles.line} /> : null}
                </View>

                <View style={styles.textCol}>
                  <Text style={styles.date}>{formatDateLabel(item.dateKey)}</Text>
                  <Text style={styles.summary} numberOfLines={2}>
                    {formatSummary(item)}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#0B1220',
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  title: {
    color: '#E5E7EB',
    fontSize: TEXT_TOKENS.sm,
    fontWeight: '800',
    marginBottom: SPACING.sm,
  },
  empty: {
    color: '#9CA3AF',
    fontSize: TEXT_TOKENS.sm,
    fontWeight: '600',
  },
  list: {
    marginTop: SPACING.xs,
  },
  row: {
    flexDirection: 'row',
    minHeight: 56,
    paddingVertical: SPACING.xs,
  },
  timelineCol: {
    width: 28,
    alignItems: 'center',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3B82F6',
    marginTop: 6,
  },
  line: {
    flex: 1,
    width: 2,
    backgroundColor: '#1F2937',
    marginTop: SPACING.xs,
  },
  textCol: {
    flex: 1,
    paddingLeft: SPACING.xs,
  },
  date: {
    color: '#3B82F6',
    fontSize: TEXT_TOKENS.sm,
    fontWeight: '800',
    marginBottom: 2,
  },
  summary: {
    color: '#9CA3AF',
    fontSize: TEXT_TOKENS.xs,
    fontWeight: '700',
  },
});
