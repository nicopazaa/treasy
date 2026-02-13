import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import type { AppLanguage } from '../../../shared/types';
import { fromKg } from '../../../shared/utils/units';
import { SPACING, TEXT as TEXT_TOKENS, RADIUS } from '../../../shared/theme/tokens';
import { STAT_NUMBER_STYLE } from '../../../shared/theme/typography';
import { t } from '../../../shared/i18n/i18n';
import { formatRelativeDayLabel } from '../../../shared/utils/dateLabels';
import type { WorkoutTimelineItem } from '../../../domain/analytics/insights';
import type { TreasyThemeTokens } from '../../../shared/theme/themes';

type Props = {
  language: AppLanguage;
  massUnit: 'kg' | 'lb';
  items: WorkoutTimelineItem[];
  resolveBlockLabel: (blockId: string | null) => string | null;
  resolveBlockColor: (blockId: string) => string;
  notesByDate?: Record<string, string>;
  onPressDay?: (dateKey: string) => void;
  theme: Pick<TreasyThemeTokens, 'surface' | 'stroke' | 'accent' | 'textMuted' | 'text'>;
  borderless?: boolean;
  scrollY?: Animated.Value;
  heroTopCount?: number;
  expandedDateKey?: string | null;
  renderExpandedContent?: (dateKey: string) => React.ReactNode;
  titleColor?: string;
  lineOpacity?: number;
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

function noteLabel(language: AppLanguage): string {
  if (language === 'nb') return 'Notat';
  if (language === 'es') return 'Nota';
  return 'Note';
}

const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);
const BASE_ROW_MIN_HEIGHT = 104;
const BASE_ROW_PADDING = SPACING.md;

export const PreviousWorkoutsTimeline: React.FC<Props> = ({
  language,
  massUnit,
  items,
  resolveBlockLabel,
  resolveBlockColor,
  notesByDate,
  onPressDay,
  theme,
  borderless = false,
  scrollY,
  heroTopCount = 0,
  expandedDateKey,
  renderExpandedContent,
  titleColor,
  lineOpacity = 1,
}) => {
  const heroRows = scrollY ? Math.max(0, Math.floor(heroTopCount)) : 0;
  const safeLineOpacity = Number.isFinite(lineOpacity) ? Math.max(0, Math.min(1, lineOpacity)) : 1;

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
    const exercises = t(language, pluralKey('analysis.previousWorkouts.exercises', item.exerciseCount), {
      count: item.exerciseCount,
    });
    const sets = t(language, pluralKey('analysis.previousWorkouts.sets', item.setCount), {
      count: item.setCount,
    });
    return `${exercises} - ${sets}`;
  };

  const formatVolumeValue = (item: WorkoutTimelineItem): string => {
    const locale = localeForLanguage(language);
    const formatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
    const converted = fromKg(item.totalVolumeKg, massUnit);
    const unit = t(language, massUnit === 'lb' ? 'units.lb' : 'units.kg');
    return `${formatter.format(Math.round(converted))} ${unit}`;
  };

  const noteTitle = noteLabel(language);

  return (
    <View style={[styles.card, borderless ? styles.cardBorderless : null, { backgroundColor: theme.surface, borderColor: theme.stroke }]}>
      <Text style={[styles.title, { color: titleColor ?? theme.accent }]}>{t(language, 'analysis.previousWorkouts.title')}</Text>

      {items.length === 0 ? (
        <Text style={[styles.empty, { color: theme.textMuted }]}>{t(language, 'analysis.empty')}</Text>
      ) : (
        <View style={styles.list}>
          {items.map((item, index) => {
            const isLast = index === items.length - 1;
            const dailyNote = notesByDate?.[item.dateKey] ?? null;
            const isExpanded = expandedDateKey === item.dateKey && Boolean(renderExpandedContent);
            const isHeroRow = heroRows > 0 && index < heroRows;
            const heroWeight = isHeroRow ? heroRows - index : 0;
            const heroScrollDistance = 160 + index * 64;
            const heroRowStyle =
              isHeroRow && scrollY
                ? ({
                    minHeight: scrollY.interpolate({
                      inputRange: [0, heroScrollDistance],
                      outputRange: [BASE_ROW_MIN_HEIGHT + heroWeight * 18, BASE_ROW_MIN_HEIGHT],
                      extrapolate: 'clamp',
                    }),
                    paddingTop: scrollY.interpolate({
                      inputRange: [0, heroScrollDistance],
                      outputRange: [BASE_ROW_PADDING + heroWeight * 4, BASE_ROW_PADDING],
                      extrapolate: 'clamp',
                    }),
                    paddingBottom: scrollY.interpolate({
                      inputRange: [0, heroScrollDistance],
                      outputRange: [BASE_ROW_PADDING + heroWeight * 4, BASE_ROW_PADDING],
                      extrapolate: 'clamp',
                    }),
                  } as const)
                : null;
            const heroDateStyle =
              isHeroRow && scrollY
                ? ({
                    fontSize: scrollY.interpolate({
                      inputRange: [0, heroScrollDistance],
                      outputRange: [TEXT_TOKENS.sm + heroWeight * 2, TEXT_TOKENS.sm],
                      extrapolate: 'clamp',
                    }),
                  } as const)
                : null;

            return (
              <AnimatedTouchableOpacity
                key={item.dateKey}
                style={[styles.row, styles.rowDefaultSpacing, heroRowStyle, isExpanded ? styles.rowExpanded : null]}
                onPress={() => onPressDay?.(item.dateKey)}
                activeOpacity={onPressDay ? 0.85 : 1}
                hitSlop={8}
                disabled={!onPressDay}
              >
                <View style={styles.timelineCol}>
                  <View style={[styles.dot, { backgroundColor: theme.accent }]} />
                  {!isLast ? <View style={[styles.line, { backgroundColor: theme.stroke, opacity: safeLineOpacity }]} /> : null}
                </View>

                <View style={styles.textCol}>
                  <Animated.Text style={[styles.date, STAT_NUMBER_STYLE, { color: theme.textMuted }, heroDateStyle]}>
                    {formatDateLabel(item.dateKey)}
                  </Animated.Text>

                  {item.blockIds.length ? (
                    <View style={styles.groupsRow}>
                      {item.blockIds.map((blockId) => (
                        <View key={`${item.dateKey}-${blockId}`} style={styles.groupInline}>
                          <View style={[styles.groupDot, { backgroundColor: resolveBlockColor(blockId) }]} />
                          <Text style={[styles.groupInlineText, { color: theme.text }]} numberOfLines={1}>
                            {resolveBlockLabel(blockId) ?? blockId}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : null}

                  <Text style={[styles.summary, STAT_NUMBER_STYLE, { color: theme.text }]} numberOfLines={1}>
                    {formatSummary(item)}
                  </Text>

                  <Text style={[styles.volume, STAT_NUMBER_STYLE, { color: theme.text }]} numberOfLines={1}>
                    <Text style={[styles.metricLabel, { color: theme.accent }]}>{`${t(language, 'analysis.volume.title')}: `}</Text>
                    {formatVolumeValue(item)}
                  </Text>

                  {dailyNote ? (
                    <Text style={[styles.note, { color: theme.text }]} numberOfLines={2}>
                      <Text style={[styles.metricLabel, { color: theme.accent }]}>{`${noteTitle}: `}</Text>
                      {dailyNote}
                    </Text>
                  ) : null}

                  {isExpanded ? <View style={styles.expandedContent}>{renderExpandedContent?.(item.dateKey)}</View> : null}
                </View>
              </AnimatedTouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 0,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderLeftWidth: 0,
    borderRightWidth: 0,
  },
  cardBorderless: {
    borderTopWidth: 0,
    borderBottomWidth: 0,
  },
  title: {
    fontSize: TEXT_TOKENS.sm,
    fontWeight: '800',
    marginBottom: SPACING.md,
  },
  empty: {
    fontSize: TEXT_TOKENS.sm,
    fontWeight: '600',
  },
  list: {
    marginTop: SPACING.sm,
  },
  row: {
    flexDirection: 'row',
  },
  rowDefaultSpacing: {
    minHeight: 104,
    paddingVertical: SPACING.md,
  },
  rowExpanded: {
    backgroundColor: 'rgba(15, 23, 42, 0.3)',
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm,
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
    marginTop: SPACING.sm,
  },
  textCol: {
    flex: 1,
    paddingLeft: SPACING.xs,
    gap: SPACING.xs,
  },
  date: {
    fontSize: TEXT_TOKENS.sm,
    fontWeight: '800',
    marginBottom: SPACING.sm,
  },
  groupsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  groupInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  groupDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
  },
  groupInlineText: {
    fontSize: TEXT_TOKENS.xs,
    fontWeight: '700',
  },
  summary: {
    fontSize: TEXT_TOKENS.xs,
    fontWeight: '700',
    marginTop: 2,
  },
  volume: {
    marginTop: 4,
    fontSize: TEXT_TOKENS.xs,
    fontWeight: '700',
  },
  metricLabel: {
    fontWeight: '800',
  },
  note: {
    marginTop: 4,
    fontSize: TEXT_TOKENS.xs,
    fontWeight: '600',
    lineHeight: 20,
  },
  expandedContent: {
    marginTop: SPACING.sm,
  },
});
