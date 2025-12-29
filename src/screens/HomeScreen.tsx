import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Image,
  ImageSourcePropType,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppState, TrainingBlock, TrainingBlockId } from '../features/workouts/model/types';
import { getBlockTone, getDotColor } from '../shared/theme/blockTone';
import { SPACING, TEXT, RADIUS, SCREEN_PADDING } from '../shared/theme/tokens';
import { blockLabel, t } from '../shared/i18n/i18n';
import { getWorkoutDates, getDailyWorkout, groupDailySets, GroupedDailySetView } from '../features/workouts/model/workoutService';
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
  onStartCardio: () => void;
  onAddNote: (text: string) => void;
};

const ORDER: TrainingBlockId[] = ['chest', 'shoulders', 'back', 'arms', 'core', 'legs'];
const BLOCK_ICONS: Partial<Record<TrainingBlockId, ImageSourcePropType>> = {
  chest: require('../assets/chest.png'),
  shoulders: require('../assets/shoulder.png'),
  back: require('../assets/back.png'),
  arms: require('../assets/arms.png'),
  core: require('../assets/core.png'),
  legs: require('../assets/leggs.png'),
  cardio: require('../assets/cardio.png'),
  bodyweight: require('../assets/bodyweight.png'),
};

type LastWorkoutState =
  | { status: 'empty'; message: string }
  | {
      status: 'ready';
      dateLabel: string;
      exercise: {
        id: string;
        name: string;
        volumeLabel: string;
        setsLabel: string | null;
        tone: ReturnType<typeof getBlockTone>;
      };
    };

const lastWorkoutTitle = (language: AppState['language']): string => {
  if (language === 'nb') return 'Siste økt';
  if (language === 'es') return 'Última sesión';
  return 'Last session';
};

const openLogLabel = (language: AppState['language']): string => {
  if (language === 'nb') return 'Åpne logg';
  if (language === 'es') return 'Abrir registro';
  return 'Open log';
};

const formatLastWorkoutDate = (dateKey: string, language: AppState['language']): string => {
  const safeDate = new Date(`${dateKey}T12:00:00`);
  const locale = language === 'nb' ? 'nb-NO' : language === 'es' ? 'es-ES' : 'en-US';
  return safeDate.toLocaleDateString(locale, {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  });
};

const selectMainExercise = (groups: GroupedDailySetView[]): GroupedDailySetView | null => {
  if (!groups.length) return null;
  // Deterministic rule: keep the first exercise in the session order (groupDailySets preserves chronological order).
  return groups[0];
};

const calculateGroupVolume = (group: GroupedDailySetView): number => {
  // Per-exercise volume: sum weight*reps, treating missing/bodyweight weight as 0 to stay consistent with the existing set model.
  return group.sets.reduce((total, set) => {
    if (set.setType === 'cardio') return total;
    if (!Number.isFinite(set.reps) || set.reps <= 0) return total;
    const weight = Number.isFinite(set.weight) && set.weight >= 0 ? set.weight : 0;
    return total + weight * set.reps;
  }, 0);
};

const formatVolumeLabel = (language: AppState['language'], volume: number): string => {
  const locale = language === 'nb' ? 'nb-NO' : language === 'es' ? 'es-ES' : 'en-US';
  const formatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const unit = t(language ?? 'en', 'units.kg');
  return `${t(language ?? 'en', 'analysis.volume.title')}: ${formatter.format(Math.round(volume))} ${unit}`;
};

const formatSetsLabel = (
  language: AppState['language'],
  sets: GroupedDailySetView['sets']
): string | null => {
  const repSets = sets.filter((s) => s.setType !== 'cardio' && Number.isFinite(s.reps) && s.reps > 0);
  if (!repSets.length) return null;

  const reps = repSets.map((s) => s.reps);
  const setCount = reps.length;
  const allEqual = reps.every((r) => r === reps[0]);
  if (allEqual) return `${setCount} × ${reps[0]}`;

  const totalReps = reps.reduce((acc, cur) => acc + cur, 0);
  const setLabel = language === 'nb' ? 'sett' : language === 'es' ? 'series' : 'sets';
  return `${setCount} ${setLabel} • ${totalReps} reps`;
};

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
  onStartCardio,
  onAddNote,
}) => {
  const language = appState.language ?? 'en';
  const [analysisOpen, setAnalysisOpen] = useState(true);
  const [noteText, setNoteText] = useState('');
  const isWeb = Platform.OS === 'web';

  const { primaryBlocks, otherBlocks } = useMemo(() => {
    const byId: Record<string, TrainingBlock> = {};
    for (const b of appState.blocks) byId[b.id] = b;

    const ordered: TrainingBlock[] = [];
    for (const id of ORDER) {
      const block = byId[id];
      if (block) ordered.push(block);
    }

    const other = appState.blocks.filter((b) => ['cardio', 'bodyweight'].includes(b.id));
    return { primaryBlocks: ordered, otherBlocks: other };
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
      changePct: analytics.pctChange,
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

  const resolveBlockIcon = (blockId: string): ImageSourcePropType | null => {
    const id = blockId as TrainingBlockId;
    return BLOCK_ICONS[id] ?? null;
  };

  const lastWorkout = useMemo<LastWorkoutState>(() => {
    const noWorkouts: LastWorkoutState = {
      status: 'empty',
      message: 'Ingen økter registrert ennå.',
    };

    const dates = getWorkoutDates(appState);
    if (dates.length === 0) return noWorkouts;

    const dateKey = dates[0];
    const grouped = groupDailySets(getDailyWorkout(appState, dateKey));
    if (!grouped.length) {
      return { status: 'empty', message: 'Ingen øvelser registrert på denne økten.' };
    }

    const mainExercise = selectMainExercise(grouped);
    if (!mainExercise) {
      return { status: 'empty', message: 'Ingen øvelser registrert på denne økten.' };
    }

    const tone = getBlockTone(mainExercise.blockId ?? 'other');
    const name = mainExercise.exerciseLabel || mainExercise.exerciseName;
    const volume = calculateGroupVolume(mainExercise);
    const setsLabel = formatSetsLabel(language, mainExercise.sets);

    return {
      status: 'ready',
      dateLabel: formatLastWorkoutDate(dateKey, language),
      exercise: {
        id: mainExercise.id,
        name,
        volumeLabel: formatVolumeLabel(language, volume),
        setsLabel,
        tone,
      },
    };
  }, [appState, language]);

  const lastWorkoutCard = (
    <View style={styles.lastWorkoutCard}>
      <Text style={styles.lastWorkoutTitle}>{lastWorkoutTitle(language)}</Text>
      {lastWorkout.status === 'ready' ? (
        <>
          <Text style={styles.lastWorkoutDate}>{lastWorkout.dateLabel}</Text>
          <View style={styles.lastWorkoutList}>
            <View style={styles.lastWorkoutRow}>
              <View style={[styles.lastDot, { backgroundColor: lastWorkout.exercise.tone.accent }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.lastWorkoutName}>{lastWorkout.exercise.name}</Text>
                <Text style={styles.lastWorkoutDetail}>{lastWorkout.exercise.volumeLabel}</Text>
                {lastWorkout.exercise.setsLabel ? (
                  <Text style={styles.lastWorkoutDetail}>{lastWorkout.exercise.setsLabel}</Text>
                ) : null}
              </View>
            </View>
          </View>
        </>
      ) : (
        <Text style={styles.lastWorkoutEmpty}>{lastWorkout.message}</Text>
      )}
      <TouchableOpacity onPress={onOpenHistory} activeOpacity={0.85} hitSlop={8}>
        <Text style={styles.lastWorkoutLink}>{openLogLabel(language)}</Text>
      </TouchableOpacity>
    </View>
  );

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
          <Text style={styles.quickLogTitle}>{t(language, 'home.quickLog.title')}</Text>
          <Text style={styles.quickLogText}>{t(language, 'quickLogExample')}</Text>
        </TouchableOpacity>

        <View style={styles.groupsWrapper}>
          <Text style={styles.groupsTitle}>{t(language, 'muscleGroups')}</Text>

          <View style={styles.groupsLayout}>
            <View style={styles.groupsColumn}>
              <View style={styles.groupsList}>
                {primaryBlocks.map((block) => {
                  const tone = getBlockTone(block.id);
                  const icon = resolveBlockIcon(block.id);
                  return (
                    <TouchableOpacity
                      key={block.id}
                      style={styles.groupRow}
                      onPress={() => onSelectBlock(block.id)}
                      activeOpacity={0.9}
                    >
                      <View style={[styles.groupDotSmall, { backgroundColor: getDotColor(block.id) }]} />
                      <Text style={styles.groupRowText}>{labelForBlock(block)}</Text>
                      {block.id === 'cardio' ? (
                        <TouchableOpacity
                          onPress={(e) => {
                            e.stopPropagation();
                            onStartCardio();
                          }}
                          style={[styles.groupAction, { backgroundColor: tone.accent }]}
                          activeOpacity={0.9}
                        >
                          <Text style={styles.groupActionText}>Start</Text>
                        </TouchableOpacity>
                      ) : null}
                      <View
                        style={[styles.groupIconWrap, { borderColor: '#1F2937', backgroundColor: '#0F172A' }]}
                      >
                        {icon ? (
                          <Image
                            source={icon}
                            style={[styles.groupIcon, { tintColor: '#3B82F6' }]}
                            resizeMode="contain"
                          />
                        ) : (
                          <View style={[styles.groupDot, { backgroundColor: '#3B82F6' }]} />
                        )}
                      </View>
                      <View style={[styles.groupDotSmall, { backgroundColor: getDotColor(block.id) }]} />
                    </TouchableOpacity>
                  );
                })}
              </View>

              {otherBlocks.length > 0 ? (
                <>
                  <Text style={styles.groupsTitle}>{t(language, 'otherSectionTitle')}</Text>
                  <View style={styles.groupsList}>
                    {otherBlocks.map((block) => {
                      const tone = getBlockTone(block.id);
                      const icon = resolveBlockIcon(block.id);
                      return (
                        <TouchableOpacity
                          key={block.id}
                          style={styles.groupRow}
                          onPress={() => onSelectBlock(block.id)}
                          activeOpacity={0.9}
                        >
                          <View style={[styles.groupDotSmall, { backgroundColor: getDotColor(block.id) }]} />
                          <Text style={styles.groupRowText}>{labelForBlock(block)}</Text>
                          <View
                            style={[styles.groupIconWrap, { borderColor: '#1F2937', backgroundColor: '#0F172A' }]}
                          >
                            {icon ? (
                              <Image
                                source={icon}
                                style={[styles.groupIcon, { tintColor: '#3B82F6' }]}
                                resizeMode="contain"
                              />
                            ) : (
                              <View style={[styles.groupDot, { backgroundColor: '#3B82F6' }]} />
                            )}
                          </View>
                          <View style={[styles.groupDotSmall, { backgroundColor: getDotColor(block.id) }]} />
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              ) : null}
            </View>

            {isWeb ? (
              <View style={styles.sideColumn}>{lastWorkoutCard}</View>
            ) : (
              <View style={styles.sideColumn}>
                {lastWorkoutCard}

                <View style={styles.notesCard}>
                  <Text style={styles.notesTitle}>{language === 'nb' ? 'Notater' : 'Notes'}</Text>
                  <TextInput
                    style={styles.notesInput}
                    placeholder={language === 'nb' ? 'Benkpress 50x15' : 'Bench press 50x15'}
                    placeholderTextColor="#6B7280"
                    value={noteText}
                    onChangeText={setNoteText}
                    multiline
                  />
                  <TouchableOpacity
                    style={[styles.notesButton, noteText.trim() ? null : styles.notesButtonDisabled]}
                    onPress={() => {
                      if (!noteText.trim()) return;
                      onAddNote(noteText.trim());
                      setNoteText('');
                    }}
                    activeOpacity={0.9}
                  >
                    <Text style={styles.notesButtonText}>{language === 'nb' ? 'Lagre' : 'Save'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
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
                changePct={volumeCardProps.changePct}
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
    paddingHorizontal: SCREEN_PADDING,
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
  groupsLayout: {
    gap: SPACING.lg,
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: SPACING.lg,
    rowGap: SPACING.lg,
    alignItems: 'flex-start',
  },
  groupsColumn: {
    flex: 1,
    minWidth: '58%',
    maxWidth: '60%',
  },
  sideColumn: {
    flex: 1,
    minWidth: '36%',
    maxWidth: '38%',
    gap: SPACING.md,
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
    gap: SPACING.sm,
    backgroundColor: '#0B1220',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#1F2937',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    minHeight: 48,
    width: '100%',
    alignSelf: 'stretch',
  },
  groupIconWrap: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: SPACING.md,
    borderWidth: 1,
  },
  groupIcon: {
    width: 22,
    height: 22,
  },
  groupDotSmall: {
    width: 10,
    height: 10,
    borderRadius: 999,
    opacity: 0.7,
  },
  groupDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  groupRowText: {
    flex: 1,
    color: '#F9FAFB',
    fontSize: TEXT.md,
    fontWeight: '700',
    marginHorizontal: SPACING.xs,
  },
  groupAction: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.md,
    marginRight: SPACING.sm,
  },
  groupActionText: {
    color: '#0B1220',
    fontWeight: '800',
    fontSize: TEXT.sm,
  },
  lastWorkoutCard: {
    backgroundColor: '#0B1220',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: SPACING.lg,
    gap: SPACING.sm,
    width: '100%',
  },
  lastWorkoutTitle: {
    color: '#E5E7EB',
    fontSize: TEXT.md,
    fontWeight: '700',
  },
  lastWorkoutDate: {
    color: '#9CA3AF',
    fontSize: TEXT.sm,
    fontWeight: '600',
  },
  lastWorkoutList: {
    gap: SPACING.sm,
  },
  lastWorkoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  lastDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  lastWorkoutName: {
    color: '#F9FAFB',
    fontWeight: '700',
    fontSize: TEXT.sm,
  },
  lastWorkoutDetail: {
    color: '#9CA3AF',
    fontSize: TEXT.xs,
    marginTop: 2,
  },
  lastWorkoutEmpty: {
    color: '#9CA3AF',
    fontSize: TEXT.xs,
    fontWeight: '600',
  },
  lastWorkoutLink: {
    color: '#60A5FA',
    fontSize: TEXT.sm,
    fontWeight: '700',
  },
  notesCard: {
    backgroundColor: '#0B1220',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: SPACING.lg,
    gap: SPACING.sm,
    width: '100%',
    minHeight: 180,
  },
  notesTitle: {
    color: '#E5E7EB',
    fontSize: TEXT.md,
    fontWeight: '700',
  },
  notesInput: {
    backgroundColor: '#0F172A',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#1F2937',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    color: '#F9FAFB',
    minHeight: 96,
    textAlignVertical: 'top',
  },
  notesButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
  },
  notesButtonDisabled: {
    opacity: 0.5,
  },
  notesButtonText: {
    color: '#F9FAFB',
    fontWeight: '800',
    fontSize: TEXT.md,
  },
  cardioCard: {
    backgroundColor: '#0A1A33',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#113268',
    padding: SPACING.lg,
    gap: SPACING.sm,
    width: '100%',
  },
  cardioTitle: {
    color: '#E5E7EB',
    fontSize: TEXT.md,
    fontWeight: '700',
  },
  cardioSubtitle: {
    color: '#9CA3AF',
    fontSize: TEXT.sm,
    fontWeight: '600',
  },
  cardioButton: {
    backgroundColor: '#2E7CF6',
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
  },
  cardioButtonText: {
    color: '#F9FAFB',
    fontSize: TEXT.md,
    fontWeight: '700',
  },
  cardioHint: {
    color: '#9CA3AF',
    fontSize: TEXT.xs,
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
    backgroundColor: '#0A1023',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#1F2A44',
    padding: SPACING.md,
    shadowColor: '#0B1220',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
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
