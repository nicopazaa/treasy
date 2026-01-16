import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Pressable, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { AppState, TrainingBlockId } from '../features/workouts';
import type { DerivedCache } from '../app/state/derivedCache';
import { SPACING, TEXT, RADIUS, SCREEN_PADDING, COLORS } from '../shared/theme/tokens';
import { blockLabel, t } from '../shared/i18n/i18n';
import {
  calcPctChange,
  calcTotalVolume,
  countSessions,
  getLastDaysRangesUtc,
  getWorkoutsInRange,
} from '../domain/analytics/insights';
import { fromKg, formatWeight, type MassUnit } from '../shared/utils/units';
import { formatExerciseLabel } from '../shared/utils/exerciseLabel';
import { formatRelativeDateTime } from '../shared/utils/dateLabels';
import {
  computeMuscleGroupStats,
  pickTopMuscleGroup,
  type MuscleGroupStat,
} from '../shared/utils/analytics/computeMuscleGroupStats';
import { computePRHits } from '../shared/utils/analytics/computePRs';
import { computeWeeklyVolumeUtc } from '../shared/utils/analytics/computeWeeklyVolume';

type Props = {
  appState: AppState;
  derivedCache: DerivedCache;
  onBack: () => void;
};

type Language = NonNullable<AppState['language']>;
type TabKey = 'quick' | 'advanced' | 'trends';
type TrendStatus = 'up' | 'down' | 'stable';

const MUSCLE_ORDER: TrainingBlockId[] = ['chest', 'shoulders', 'back', 'arms', 'core', 'legs'];

function localeForLanguage(language: Language): string {
  if (language === 'nb') return 'nb-NO';
  if (language === 'es') return 'es-ES';
  return 'en-US';
}

function trendFromPct(pctChange: number): TrendStatus {
  if (pctChange >= 5) return 'up';
  if (pctChange <= -5) return 'down';
  return 'stable';
}

function arrowForTrend(trend: TrendStatus): string {
  if (trend === 'up') return '↑';
  if (trend === 'down') return '↓';
  return '→';
}

function colorForTrend(trend: TrendStatus): string {
  if (trend === 'up') return COLORS.success;
  if (trend === 'down') return COLORS.warning;
  return COLORS.neutral;
}

function formatPctText(language: Language, pctChange: number): string {
  const rounded = Math.round(pctChange);
  if (Math.abs(rounded) < 1) return t(language, 'analysis.volume.changeFlat');
  if (rounded > 0) return t(language, 'analysis.volume.changeUp', { pct: Math.abs(rounded) });
  return t(language, 'analysis.volume.changeDown', { pct: Math.abs(rounded) });
}

function formatVolume(language: Language, massUnit: MassUnit, volumeKg: number): string {
  const locale = localeForLanguage(language);
  const formatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const converted = fromKg(volumeKg, massUnit);
  const rounded = Number.isFinite(converted) ? Math.round(converted) : 0;
  return `${formatter.format(rounded)} ${massUnit}`;
}

function screenTitle(language: Language): string {
  if (language === 'nb') return 'Analyse';
  if (language === 'es') return 'Análisis';
  return 'Analysis';
}

function screenSubtitle(language: Language): string {
  if (language === 'nb') return 'Innsikt fra treningen din (lokalt beregnet).';
  if (language === 'es') return 'Insights de tu entrenamiento (calculado localmente).';
  return 'Workout insights (computed locally).';
}

function tabLabel(language: Language, tab: TabKey): string {
  if (tab === 'quick') return language === 'nb' ? 'Kjapt' : language === 'es' ? 'Rápido' : 'Quick insights';
  if (tab === 'advanced') return language === 'nb' ? 'Avansert' : language === 'es' ? 'Avanzado' : 'Advanced';
  return language === 'nb' ? 'Trender' : language === 'es' ? 'Tendencias' : 'Trends';
}

function nextBestAction(language: Language, stats: MuscleGroupStat[], order: TrainingBlockId[]): string {
  const withOrder = stats.map((s) => ({
    ...s,
    gap: (s.volumePrev7d ?? 0) - (s.volume7d ?? 0),
    orderIndex: Math.max(0, order.indexOf(s.id as TrainingBlockId)),
  }));

  const behind = withOrder
    .filter((s) => s.volumePrev7d > 0 && s.gap > 0)
    .sort((a, b) => {
      if (b.gap !== a.gap) return b.gap - a.gap;
      return a.orderIndex - b.orderIndex;
    });

  const balanceTarget =
    withOrder
      .slice()
      .sort((a, b) => (a.volume7d !== b.volume7d ? a.volume7d - b.volume7d : a.orderIndex - b.orderIndex))[0]
      ?.id ?? null;

  const targetId = behind[0]?.id ?? balanceTarget;
  const label = targetId
    ? blockLabel(targetId as TrainingBlockId, language)
    : language === 'nb'
      ? 'en muskelgruppe'
      : language === 'es'
        ? 'un grupo'
        : 'a muscle group';

  if (behind.length > 0) {
    if (language === 'nb') return `Logg én ${label}-økt for å slå forrige uke.`;
    if (language === 'es') return `Registra una sesión de ${label} para superar la semana pasada.`;
    return `Log one ${label} session to beat last week.`;
  }

  if (language === 'nb') return `Balanse: legg til litt ${label} denne uka.`;
  if (language === 'es') return `Equilibrio: añade un poco de ${label} esta semana.`;
  return `Balance: add some ${label} this week.`;
}

export const AnalysisScreen: React.FC<Props> = ({ appState, derivedCache, onBack }) => {
  const language: Language = appState.language ?? 'en';
  const massUnit = appState.massUnit ?? 'kg';

  const [tab, setTab] = useState<TabKey>('quick');

  const data = useMemo(() => {
    const now = new Date();
    const { current, previous } = getLastDaysRangesUtc(7, now);
    const sets7d = getWorkoutsInRange(appState, current.start, current.end);
    const setsPrev7d = getWorkoutsInRange(appState, previous.start, previous.end);

    const sessions7d = countSessions(sets7d);
    const setCount7d = sets7d.length;
    const volume7d = calcTotalVolume(sets7d);
    const volumePrev7d = calcTotalVolume(setsPrev7d);
    const volumePct = calcPctChange(volume7d, volumePrev7d, { clampAbs: 999 });

    const muscleIds = MUSCLE_ORDER as unknown as string[];
    const muscleStats = computeMuscleGroupStats(appState, sets7d, setsPrev7d, muscleIds);
    const topMuscleId = pickTopMuscleGroup(muscleStats, muscleIds);

    const prHits = computePRHits(derivedCache.setsByExerciseId, { limit: 5 });
    const weekly = computeWeeklyVolumeUtc(appState, 8, now);

    const fatigueBadge = volumePrev7d > 0 && volumePct > 40;
    const action = nextBestAction(language, muscleStats, MUSCLE_ORDER);

    return {
      now,
      sessions7d,
      setCount7d,
      volume7d,
      volumePrev7d,
      volumePct,
      muscleStats,
      topMuscleId,
      prHits,
      weekly,
      fatigueBadge,
      action,
    };
  }, [appState, derivedCache.setsByExerciseId, language]);

  const topMuscleLabel = data.topMuscleId ? blockLabel(data.topMuscleId as TrainingBlockId, language) : null;
  const volumeTrend = trendFromPct(data.volumePct);
  const volumeTrendColor = colorForTrend(volumeTrend);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <TouchableOpacity onPress={onBack} hitSlop={12} style={styles.backButton} activeOpacity={0.8}>
          <Text style={styles.backLabel}>{t(language, 'back')}</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.title}>{screenTitle(language)}</Text>
          <Text style={styles.subtitle}>{screenSubtitle(language)}</Text>
        </View>

        <View style={styles.tabs}>
          {(['quick', 'advanced', 'trends'] as const).map((key) => {
            const active = tab === key;
            return (
              <Pressable
                key={key}
                onPress={() => setTab(key)}
                style={[styles.tabButton, active && styles.tabButtonActive]}
                hitSlop={8}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{tabLabel(language, key)}</Text>
              </Pressable>
            );
          })}
        </View>

        {tab === 'quick' ? (
          <View style={styles.section}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                {language === 'nb' ? 'Siste 7 dager' : language === 'es' ? 'Últimos 7 días' : 'Last 7 days'}
              </Text>

              <View style={styles.statRow}>
                <Text style={styles.statLabel}>{language === 'nb' ? 'Økter' : language === 'es' ? 'Sesiones' : 'Sessions'}</Text>
                <Text style={styles.statValue}>{String(data.sessions7d)}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>{language === 'nb' ? 'Sett' : language === 'es' ? 'Series' : 'Sets'}</Text>
                <Text style={styles.statValue}>{String(data.setCount7d)}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>{language === 'nb' ? 'Volum' : language === 'es' ? 'Volumen' : 'Volume'}</Text>
                <Text style={styles.statValue}>{formatVolume(language, massUnit, data.volume7d)}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>{language === 'nb' ? 'Topp muskel' : language === 'es' ? 'Top grupo' : 'Top muscle'}</Text>
                <Text style={styles.statValue}>{topMuscleLabel ?? '—'}</Text>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>{language === 'nb' ? 'Konsistens' : language === 'es' ? 'Constancia' : 'Consistency'}</Text>
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>{language === 'nb' ? 'Aktive dager' : language === 'es' ? 'Días activos' : 'Active days'}</Text>
                <Text style={styles.statValue}>{`${data.sessions7d}/7`}</Text>
              </View>
              <Text style={styles.muted}>
                {language === 'nb'
                  ? 'En aktiv dag = minst ett sett.'
                  : language === 'es'
                    ? 'Un día activo = al menos una serie.'
                    : 'An active day = at least one set.'}
              </Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>{language === 'nb' ? 'Neste beste tiltak' : language === 'es' ? 'Siguiente acción' : 'Next best action'}</Text>
              <Text style={styles.actionText}>{data.action}</Text>
            </View>
          </View>
        ) : null}

        {tab === 'advanced' ? (
          <View style={styles.section}>
            <View style={styles.card}>
              <View style={styles.cardTitleRow}>
                <Text style={styles.cardTitle}>{language === 'nb' ? 'Status' : language === 'es' ? 'Estado' : 'Status'}</Text>
                {data.fatigueBadge ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{language === 'nb' ? 'Høy belastning' : language === 'es' ? 'Carga alta' : 'High load spike'}</Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.trendRow}>
                <Text style={styles.statLabel}>
                  {language === 'nb' ? 'Uke vs uke volum' : language === 'es' ? 'Volumen semana a semana' : 'Week-over-week volume'}
                </Text>
                <View style={styles.trendRight}>
                  <Text style={[styles.trendArrow, { color: volumeTrendColor }]}>{arrowForTrend(volumeTrend)}</Text>
                  <Text style={[styles.trendText, { color: volumeTrendColor }]}>{formatPctText(language, data.volumePct)}</Text>
                </View>
              </View>
              <Text style={styles.muted}>
                {language === 'nb'
                  ? `Forrige: ${formatVolume(language, massUnit, data.volumePrev7d)}`
                  : language === 'es'
                    ? `Previo: ${formatVolume(language, massUnit, data.volumePrev7d)}`
                    : `Previous: ${formatVolume(language, massUnit, data.volumePrev7d)}`}
              </Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                {language === 'nb' ? 'Per muskelgruppe' : language === 'es' ? 'Por grupo muscular' : 'Per muscle group'}
              </Text>

              {data.muscleStats.map((stat, idx) => {
                const trend = trendFromPct(stat.pctChange);
                const color = colorForTrend(trend);
                const label = blockLabel(stat.id as TrainingBlockId, language);
                return (
                  <View key={stat.id} style={[styles.tableRow, idx === 0 && styles.tableRowFirst]}>
                    <Text style={styles.tableLeft} numberOfLines={1}>
                      {label}
                    </Text>
                    <View style={styles.tableRight}>
                      <Text style={[styles.tableArrow, { color }]}>{arrowForTrend(trend)}</Text>
                      <Text style={[styles.tablePct, { color }]}>{formatPctText(language, stat.pctChange)}</Text>
                      <Text style={styles.tableValue}>{formatVolume(language, massUnit, stat.volume7d)}</Text>
                    </View>
                  </View>
                );
              })}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>{language === 'nb' ? 'PR-er' : language === 'es' ? 'PRs' : 'PRs'}</Text>
              {data.prHits.length === 0 ? (
                <Text style={styles.muted}>
                  {language === 'nb'
                    ? 'Ingen nye toppvekter ennå.'
                    : language === 'es'
                      ? 'Aún no hay nuevos récords.'
                      : 'No new top weights yet.'}
                </Text>
              ) : (
                data.prHits.map((hit, idx) => {
                  const exercise = derivedCache.exerciseById.get(hit.exerciseId);
                  const name = exercise ? formatExerciseLabel(exercise) : hit.exerciseId;
                  const dt = new Date(hit.createdAt);
                  const dateLabel = Number.isFinite(dt.getTime())
                    ? formatRelativeDateTime(dt, data.now, language)
                    : String(hit.createdAt ?? '').slice(0, 10);
                  return (
                    <View key={`${hit.exerciseId}-${hit.createdAt}-${hit.weightKg}`} style={[styles.prRow, idx === 0 && styles.tableRowFirst]}>
                      <View style={styles.prLeft}>
                        <Text style={styles.prName} numberOfLines={1}>
                          {name}
                        </Text>
                        <Text style={styles.prDate}>{dateLabel}</Text>
                      </View>
                      <Text style={styles.prWeight}>{formatWeight(hit.weightKg, massUnit, language)}</Text>
                    </View>
                  );
                })
              )}
            </View>
          </View>
        ) : null}

        {tab === 'trends' ? (
          <View style={styles.section}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{language === 'nb' ? 'Siste 8 uker' : language === 'es' ? 'Últimas 8 semanas' : 'Last 8 weeks'}</Text>

              {data.weekly.map((week, idx) => {
                const prev = data.weekly.find((w) => w.index === week.index + 1) ?? null;
                const pct = prev ? calcPctChange(week.volumeKg, prev.volumeKg, { clampAbs: 999 }) : 0;
                const trend = prev ? trendFromPct(pct) : 'stable';
                const color = colorForTrend(trend);
                const startLabel = week.start.toISOString().slice(0, 10);
                return (
                  <View key={week.index} style={[styles.tableRow, idx === 0 && styles.tableRowFirst]}>
                    <Text style={styles.tableLeft}>{startLabel}</Text>
                    <View style={styles.tableRight}>
                      <Text style={[styles.tableArrow, { color }]}>{arrowForTrend(trend)}</Text>
                      <Text style={[styles.tablePct, { color }]}>{prev ? formatPctText(language, pct) : '—'}</Text>
                      <Text style={styles.tableValue}>{formatVolume(language, massUnit, week.volumeKg)}</Text>
                      <Text style={styles.tableMeta}>
                        {`${week.sessions} ${language === 'nb' ? 'økter' : language === 'es' ? 'sesiones' : 'sessions'}`}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        <View style={{ height: Platform.OS === 'web' ? 24 : 48 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.treasyNavy,
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
  backLabel: {
    color: COLORS.blue1,
    fontSize: TEXT.sm,
    fontWeight: '800',
  },
  header: {
    gap: SPACING.xs,
    marginBottom: SPACING.md,
  },
  title: {
    color: '#F9FAFB',
    fontSize: TEXT.xxl,
    fontWeight: '900',
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: TEXT.sm,
    fontWeight: '600',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#0B1220',
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: 4,
    gap: 4,
    marginBottom: SPACING.md,
  },
  tabButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.sm,
  },
  tabButtonActive: {
    backgroundColor: '#111827',
  },
  tabText: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: TEXT.xs,
    fontWeight: '800',
  },
  tabTextActive: {
    color: '#F9FAFB',
  },
  section: {
    gap: SPACING.md,
  },
  card: {
    backgroundColor: '#0B1220',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  cardTitle: {
    color: '#F9FAFB',
    fontSize: TEXT.md,
    fontWeight: '900',
  },
  muted: {
    color: 'rgba(255, 255, 255, 0.65)',
    fontSize: TEXT.xs,
    fontWeight: '600',
    lineHeight: 18,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.md,
  },
  statLabel: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: TEXT.sm,
    fontWeight: '700',
  },
  statValue: {
    color: '#F9FAFB',
    fontSize: TEXT.sm,
    fontWeight: '900',
  },
  actionText: {
    color: '#F9FAFB',
    fontSize: TEXT.sm,
    fontWeight: '800',
    lineHeight: 20,
  },
  badge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: RADIUS.pill,
    backgroundColor: 'rgba(245, 158, 11, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
  },
  badgeText: {
    color: COLORS.warning,
    fontSize: TEXT.xs,
    fontWeight: '900',
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.md,
  },
  trendRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trendArrow: {
    fontSize: TEXT.md,
    fontWeight: '900',
  },
  trendText: {
    fontSize: TEXT.sm,
    fontWeight: '900',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.md,
    paddingVertical: SPACING.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  tableRowFirst: {
    borderTopWidth: 0,
  },
  tableLeft: {
    flex: 1,
    color: '#E5E7EB',
    fontSize: TEXT.sm,
    fontWeight: '800',
  },
  tableRight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  tableArrow: {
    fontSize: TEXT.sm,
    fontWeight: '900',
  },
  tablePct: {
    fontSize: TEXT.xs,
    fontWeight: '900',
    width: 52,
    textAlign: 'right',
  },
  tableValue: {
    color: '#F9FAFB',
    fontSize: TEXT.xs,
    fontWeight: '900',
    width: 88,
    textAlign: 'right',
  },
  tableMeta: {
    color: 'rgba(255, 255, 255, 0.55)',
    fontSize: TEXT.xs,
    fontWeight: '700',
    width: 64,
    textAlign: 'right',
  },
  prRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.md,
    paddingVertical: SPACING.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
  },
  prLeft: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  prName: {
    color: '#F9FAFB',
    fontSize: TEXT.sm,
    fontWeight: '800',
  },
  prDate: {
    color: 'rgba(255, 255, 255, 0.55)',
    fontSize: TEXT.xs,
    fontWeight: '700',
  },
  prWeight: {
    color: COLORS.success,
    fontSize: TEXT.sm,
    fontWeight: '900',
  },
});
