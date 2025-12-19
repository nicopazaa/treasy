import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, SafeAreaView, Image } from 'react-native';
import { AppState, TrainingBlock, TrainingBlockId } from '../features/workouts/model/types';
import { getBlockTone } from '../shared/theme/blockTone';
import { SPACING, TEXT, RADIUS } from '../shared/theme/tokens';
import { blockLabel, t } from '../shared/i18n/i18n';
import {
  buildWorkoutTimeline,
  calcPctChange,
  calcTotalVolume,
  calcVolumeByMuscle,
  countSessions,
  getLastDaysRangesUtc,
  getMomentumStatus,
  getWorkoutsInRange,
} from '../features/analytics/model/insights';
import { MomentumCard } from '../features/analytics/ui/MomentumCard';
import { PreviousWorkoutsTimeline } from '../features/analytics/ui/PreviousWorkoutsTimeline';
import { VolumeCard, type VolumeByMuscleRow } from '../features/analytics/ui/VolumeCard';

type Props = {
  appState: AppState;
  onSelectBlock: (blockId: string) => void;
  onOpenAI: () => void;
  onOpenQuickLog: () => void;
  onOpenHistory: () => void;
  onOpenHistoryForDate?: (dateKey: string) => void;
  onOpenProgress: () => void;
  onOpenRepMax: () => void;
  onOpenProfile: () => void;
};

const ORDER: TrainingBlockId[] = [
  'chest',
  'shoulders',
  'back',
  'arms',
  'core',
  'legs',
];

export const HomeScreen: React.FC<Props> = ({
  appState,
  onSelectBlock,
  onOpenAI,
  onOpenQuickLog,
  onOpenHistory,
  onOpenHistoryForDate,
  onOpenProgress,
  onOpenRepMax,
  onOpenProfile,
}) => {
  const language = appState.language ?? 'en';
  const [analysisOpen, setAnalysisOpen] = useState(true);

  const blocks = useMemo(() => {
    const byId: Record<string, TrainingBlock> = {};
    for (const b of appState.blocks) byId[b.id] = b;

    const ordered: TrainingBlock[] = [];
    for (const id of ORDER) {
      const block = byId[id];
      if (block) ordered.push(block);
    }

    const rest = appState.blocks.filter(
      (b) => !ORDER.includes(b.id as TrainingBlockId) && b.id !== 'cardio'
    );
    return [...ordered, ...rest];
  }, [appState.blocks]);

  const nickname = appState.nickname?.trim() ?? '';

  const labelForBlock = (block: TrainingBlock): string => {
    const id = block.id as TrainingBlockId;
    return ORDER.includes(id) ? blockLabel(id, language) : block.name;
  };

  const analytics = useMemo(() => {
    const { current, previous } = getLastDaysRangesUtc(7, new Date());
    const sets7d = getWorkoutsInRange(appState, current.start, current.end);
    const setsPrev7d = getWorkoutsInRange(appState, previous.start, previous.end);

    const sessions7d = countSessions(sets7d);
    const sessionsPrev7d = countSessions(setsPrev7d);

    const volume7d = calcTotalVolume(sets7d);
    const volumePrev7d = calcTotalVolume(setsPrev7d);

    const hasData = sessions7d > 0 || sessionsPrev7d > 0;
    const momentum = getMomentumStatus({ sessions7d, sessionsPrev7d, volume7d, volumePrev7d });
    const pctChange = calcPctChange(volume7d, volumePrev7d, { clampAbs: 999 });

    const muscleIds = ORDER as unknown as string[];
    const volumeByMuscle7d = calcVolumeByMuscle(appState, sets7d, muscleIds);
    const volumeByMusclePrev7d = calcVolumeByMuscle(appState, setsPrev7d, muscleIds);

    const timeline = buildWorkoutTimeline(appState, { limit: 5 });

    return {
      hasData,
      momentum,
      volume7d,
      pctChange,
      volumeByMuscle7d,
      volumeByMusclePrev7d,
      timeline,
    };
  }, [appState]);

  const volumeCardProps = useMemo(() => {
    const locale = language === 'nb' ? 'nb-NO' : language === 'es' ? 'es-ES' : 'en-US';
    const formatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
    const unit = t(language, 'units.kg');

    const roundedPct = Math.round(analytics.pctChange);
    const changeLabel =
      roundedPct > 0
        ? t(language, 'analysis.volume.changeUp', { pct: Math.abs(roundedPct) })
        : roundedPct < 0
          ? t(language, 'analysis.volume.changeDown', { pct: Math.abs(roundedPct) })
          : t(language, 'analysis.volume.changeFlat');

    const volumeLabel = `${formatter.format(Math.round(analytics.volume7d))} ${unit}`;

    const rows: VolumeByMuscleRow[] = ORDER.map((id) => {
      const label = blockLabel(id, language);
      const current = analytics.volumeByMuscle7d[id] ?? 0;
      const prev = analytics.volumeByMusclePrev7d[id] ?? 0;
      const pct = calcPctChange(current, prev, { clampAbs: 999 });
      return { id, label, volume7d: current, pctChange: pct };
    });

    return {
      totalLabel: t(language, 'analysis.volume.total7d'),
      changeLabel,
      volumeLabel,
      rows,
    };
  }, [analytics, language]);

  const resolveBlockLabel = useMemo(() => {
    const known = new Set<string>([...ORDER, 'cardio']);
    const byId = new Map(appState.blocks.map((b) => [b.id, b.name] as const));
    return (blockId: string | null): string | null => {
      if (!blockId) return null;
      if (known.has(blockId)) return blockLabel(blockId as any, language);
      return byId.get(blockId) ?? null;
    };
  }, [appState.blocks, language]);

  const openHistoryForDate = (dateKey: string) => {
    if (onOpenHistoryForDate) {
      onOpenHistoryForDate(dateKey);
      return;
    }
    onOpenHistory();
  };

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} bounces>
        <View style={styles.headerRow}>
          <View style={styles.brandColumn}>
            <Image
              source={require('../assets/treasy-logo.png')}
              style={styles.logo}
              resizeMode="contain"
              accessibilityLabel="Treasy"
            />
            <Text style={styles.subtitle}>{t(language, 'homeSubtitle')}</Text>
          </View>

          <View style={styles.profileColumn}>
            <View style={styles.headerButtonsRow}>
              <TouchableOpacity onPress={onOpenProfile} hitSlop={8} style={styles.profileButton}>
                <Text style={styles.profileLink}>{t(language, 'profile')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={onOpenAI}
                hitSlop={8}
                style={styles.helpButton}
                activeOpacity={0.85}
                accessibilityLabel={t(language, 'home.help')}
              >
                <Text style={styles.helpIcon}>{'?'}</Text>
              </TouchableOpacity>
            </View>
            {nickname ? <Text style={styles.nickname}>{nickname}</Text> : null}
          </View>
        </View>

        <TouchableOpacity style={styles.quickLogCard} onPress={onOpenQuickLog} activeOpacity={0.9}>
          <Text style={styles.quickLogTitle}>{t(language, 'quickLogTitle')}</Text>
          <Text style={styles.quickLogText}>{t(language, 'quickLogExample')}</Text>
        </TouchableOpacity>

        <View style={styles.groupsWrapper}>
          <Text style={styles.groupsTitle}>{t(language, 'muscleGroups')}</Text>

          <View style={styles.groupsList}>
            {blocks.map((block) => {
              const tone = getBlockTone(block.id);
              return (
                <TouchableOpacity
                  key={block.id}
                  style={styles.groupRow}
                  onPress={() => onSelectBlock(block.id)}
                  activeOpacity={0.9}
                >
                  <View style={[styles.groupDot, { backgroundColor: tone.accent }]} />
                  <Text style={styles.groupRowText}>{labelForBlock(block)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.analysisWrapper}>
          <TouchableOpacity
            style={styles.analysisHeaderRow}
            onPress={() => setAnalysisOpen((v) => !v)}
            activeOpacity={0.8}
          >
            <Text style={styles.analysisTitle}>{t(language, 'analysis.sectionTitle')}</Text>
            <Text style={styles.chevron}>{analysisOpen ? 'v' : '>'}</Text>
          </TouchableOpacity>

          {analysisOpen && (
            <View style={styles.analysisCards}>
              <MomentumCard
                language={language}
                hasData={analytics.hasData}
                status={analytics.momentum}
                onPress={onOpenProgress}
              />

              <VolumeCard
                language={language}
                hasData={analytics.hasData}
                totalLabel={volumeCardProps.totalLabel}
                changeLabel={volumeCardProps.changeLabel}
                volumeLabel={volumeCardProps.volumeLabel}
                rows={volumeCardProps.rows}
              />

              <PreviousWorkoutsTimeline
                language={language}
                items={analytics.timeline}
                resolveBlockLabel={resolveBlockLabel}
                onPressDay={openHistoryForDate}
              />

              <TouchableOpacity style={styles.analysisCard} onPress={onOpenRepMax} activeOpacity={0.9}>
                <Text style={styles.cardTitle}>{t(language, 'analysis.bestLifts.title')}</Text>
                <Text style={styles.cardText}>{t(language, 'analysis.bestLifts.subtitle')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={{ height: Platform.OS === 'web' ? 32 : 48 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#020617',
    ...Platform.select({
      web: { width: '100%', maxWidth: 720, alignSelf: 'center' },
    }),
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Platform.OS === 'web' ? SPACING.xxxl : SPACING.xxl,
    paddingTop: Platform.OS === 'ios' ? SPACING.xs : SPACING.xxl,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: SPACING.xl,
  },
  brandColumn: {
    flex: 1,
    paddingRight: SPACING.lg,
  },
  logo: {
    height: 28,
    width: 120,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: TEXT.sm,
    color: '#9CA3AF',
  },
  profileColumn: {
    alignItems: 'flex-end',
  },
  headerButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  profileButton: {
    minWidth: 44,
    minHeight: 44,
    paddingHorizontal: SPACING.sm,
    paddingTop: SPACING.xs,
    alignItems: 'flex-end',
  },
  profileLink: {
    fontSize: TEXT.sm,
    color: '#60A5FA',
    fontWeight: '600',
  },
  nickname: {
    marginTop: 2,
    color: '#9CA3AF',
    fontSize: TEXT.xs,
    fontWeight: '600',
  },
  helpButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#1F2937',
    backgroundColor: '#0B1220',
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpIcon: {
    color: '#9CA3AF',
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 18,
  },
  sectionTitle: {
    color: '#E5E7EB',
    fontSize: TEXT.sm,
    fontWeight: '700',
    marginBottom: SPACING.sm,
  },
  section: {
    gap: SPACING.md,
    marginBottom: SPACING.xxl,
  },
  quickLogCard: {
    backgroundColor: '#0B1220',
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    borderWidth: 1,
    borderColor: '#1F2937',
    marginBottom: SPACING.xxl,
  },
  quickLogTitle: {
    color: '#F9FAFB',
    fontSize: TEXT.lg,
    fontWeight: '700',
    marginBottom: SPACING.xs,
  },
  quickLogText: {
    color: '#9CA3AF',
    fontSize: TEXT.sm,
  },
  blockButton: {
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    justifyContent: 'center',
    borderWidth: 1,
    minHeight: 52,
  },
  blockLabel: {
    fontSize: TEXT.lg,
    fontWeight: '600',
  },
  groupsWrapper: {
    marginBottom: SPACING.xxl,
  },
  groupsTitle: {
    color: '#E5E7EB',
    fontSize: TEXT.sm,
    fontWeight: '700',
    marginBottom: SPACING.sm,
  },
  groupsList: {
    gap: SPACING.sm,
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0B1220',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#1F2937',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    minHeight: 52,
  },
  groupDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    marginRight: SPACING.md,
  },
  groupRowText: {
    flex: 1,
    color: '#F9FAFB',
    fontSize: TEXT.md,
    fontWeight: '700',
  },
  analysisWrapper: {
    marginTop: SPACING.sm,
    marginBottom: SPACING.xxl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#1F2937',
    paddingTop: SPACING.lg,
  },
  analysisHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  analysisTitle: {
    fontSize: TEXT.lg,
    fontWeight: '700',
    color: '#F9FAFB',
  },
  chevron: {
    fontSize: TEXT.md,
    color: '#9CA3AF',
    fontWeight: '700',
  },
  analysisCards: {
    gap: SPACING.md,
  },
  analysisCard: {
    backgroundColor: '#0B1220',
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderWidth: 1,
    borderColor: '#1F2937',
    minHeight: 72,
  },
  cardTitle: {
    fontSize: TEXT.md,
    fontWeight: '700',
    color: '#F9FAFB',
    marginBottom: SPACING.xs,
  },
  cardText: {
    fontSize: TEXT.xs,
    color: '#9CA3AF',
  },
});
