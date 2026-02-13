import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { AppLanguage } from '../../../shared/types';
import { SPACING, TEXT as TEXT_TOKENS, RADIUS } from '../../../shared/theme/tokens';
import { STAT_NUMBER_STYLE } from '../../../shared/theme/typography';
import { t } from '../../../shared/i18n/i18n';
import { formatRelativeDayLabel } from '../../../shared/utils/dateLabels';
import type { WorkoutTimelineItem } from '../../../domain/analytics/insights';
import type { TreasyThemeTokens } from '../../../shared/theme/themes';

type Props = {
  language: AppLanguage;
  items: WorkoutTimelineItem[];
  resolveBlockLabel: (blockId: string | null) => string | null;
  onPressDay: (dateKey: string) => void;
  theme: Pick<TreasyThemeTokens, 'surfaceAlt' | 'stroke' | 'accent' | 'textMuted'>;
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
  theme,
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
    <View style={[styles.card, { backgroundColor: theme.surfaceAlt, borderColor: theme.stroke }]}>
      <Text style={[styles.title, { color: theme.accent }]}>{t(language, 'analysis.previousWorkouts.title')}</Text>

      {items.length === 0 ? (
        <Text style={[styles.empty, { color: theme.textMuted }]}>{t(language, 'analysis.empty')}</Text>
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
                  <View style={[styles.dot, { backgroundColor: theme.accent }]} />
                  {!isLast ? <View style={[styles.line, { backgroundColor: theme.stroke }]} /> : null}
                </View>

                <View style={styles.textCol}>
                  <Text style={[styles.date, STAT_NUMBER_STYLE, { color: theme.accent }]}>{formatDateLabel(item.dateKey)}</Text>
                  <Text style={[styles.summary, STAT_NUMBER_STYLE, { color: theme.textMuted }]} numberOfLines={2}>
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
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderWidth: 1,
  },
  title: {
    fontSize: TEXT_TOKENS.sm,
    fontWeight: '800',
    marginBottom: SPACING.sm,
  },
  empty: {
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
    marginTop: 6,
  },
  line: {
    flex: 1,
    width: 2,
    marginTop: SPACING.xs,
  },
  textCol: {
    flex: 1,
    paddingLeft: SPACING.xs,
  },
  date: {
    fontSize: TEXT_TOKENS.sm,
    fontWeight: '800',
    marginBottom: 2,
  },
  summary: {
    fontSize: TEXT_TOKENS.xs,
    fontWeight: '700',
  },
});
