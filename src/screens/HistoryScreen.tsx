import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NavigationContext, useFocusEffect } from '@react-navigation/native';
import type { AppState, TrainingBlockId } from '../features/workouts';
import { getWorkoutDates, getDailyWorkout, groupDailySets, type GroupedDailySetView } from '../features/workouts';
import { blockLabel, t } from '../shared/i18n/i18n';
import { SPACING, TEXT, SCREEN_PADDING } from '../shared/theme/tokens';
import { getDotColor } from '../shared/theme/blockTone';
import { buildWorkoutTimeline } from '../domain/analytics/insights';
import { PreviousWorkoutsTimeline } from '../features/analytics/ui/PreviousWorkoutsTimeline';
import { listNotes } from '../features/notes';
import type { NoteEntry } from '../domain/workouts/types';
import { formatWeight, fromKg, type MassUnit } from '../shared/utils/units';
import { resolveThemeTokens, type TreasyThemeTokens } from '../shared/theme/themes';
import { ExerciseLabelText } from '../shared/ui/ExerciseLabelText';

type Props = {
  appState: AppState;
  onBack: () => void;
  initialExpandedDateKey?: string | null;
};

type BlockGroup = {
  blockId?: string;
  blockName?: string;
  time: string;
  exercises: GroupedDailySetView[];
};

type GroupSet = GroupedDailySetView['sets'][number];

const fallbackNavigation = {
  addListener: () => () => {},
  isFocused: () => true,
};

const KNOWN_BLOCK_IDS: TrainingBlockId[] = [
  'chest',
  'shoulders',
  'back',
  'arms',
  'core',
  'legs',
  'cardio',
  'bodyweight',
];

function toRgba(color: string, alpha: number): string {
  const safeAlpha = Math.max(0, Math.min(1, alpha));
  const hex = color.replace('#', '').trim();
  const normalized = hex.length === 3 ? hex.split('').map((part) => `${part}${part}`).join('') : hex.padEnd(6, '0').slice(0, 6);
  const int = Number.parseInt(normalized, 16);
  if (!Number.isFinite(int)) return `rgba(0,0,0,${safeAlpha})`;
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r},${g},${b},${safeAlpha})`;
}

function isKnownBlockId(value?: string): value is TrainingBlockId {
  return Boolean(value && KNOWN_BLOCK_IDS.includes(value as TrainingBlockId));
}

function blockTitleForGroup(block: BlockGroup, language: AppState['language']): string {
  const id = isKnownBlockId(block.blockId) ? block.blockId : undefined;
  if (id) return blockLabel(id, language ?? 'en');
  return block.blockName ?? block.blockId ?? '';
}

function blockKeyForGroup(block: BlockGroup): string {
  return block.blockId ?? block.blockName ?? block.exercises[0]?.id ?? 'block';
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

function inferSetType(set: GroupSet): 'weighted' | 'bodyweight' | 'cardio' {
  if (set.setType) return set.setType;
  const isCardio = set.distanceKm != null || set.durationMin != null || set.pauseSec != null;
  if (isCardio) return 'cardio';
  if (set.isBodyweight || set.weight === 0) return 'bodyweight';
  return 'weighted';
}

function localeForLanguage(language: AppState['language']): string {
  if (language === 'nb') return 'nb-NO';
  if (language === 'es') return 'es-ES';
  return 'en-US';
}

function formatLocalizedNumber(
  language: AppState['language'],
  value: number,
  options?: { maximumFractionDigits?: number }
): string {
  const safeValue = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat(localeForLanguage(language), {
    maximumFractionDigits: options?.maximumFractionDigits ?? 0,
  }).format(safeValue);
}

function formatWholeNumber(language: AppState['language'], value: number): string {
  return formatLocalizedNumber(language, Math.round(value), { maximumFractionDigits: 0 });
}

function splitWeightParts(valueKg: number, massUnit: MassUnit, language: AppState['language']): { value: string; unit: string } {
  const formatted = formatWeight(valueKg, massUnit, language ?? 'en');
  const match = formatted.match(/^(.*)\s+(\S+)$/);
  if (!match) return { value: formatted, unit: massUnit };
  return { value: match[1], unit: match[2] };
}

function countTotalVolumeKg(sets: GroupSet[]): number {
  return sets.reduce((total, set) => {
    if (!Number.isFinite(set.weight) || !Number.isFinite(set.reps)) return total;
    if (set.weight < 0 || set.reps <= 0) return total;
    return total + set.weight * set.reps;
  }, 0);
}

function formatVolumeParts(
  language: AppState['language'],
  massUnit: MassUnit,
  totalVolumeKg: number
): { value: string; unit: string } {
  const converted = fromKg(totalVolumeKg, massUnit);
  const value = formatWholeNumber(language, converted);
  const unit = t(language ?? 'en', massUnit === 'lb' ? 'units.lb' : 'units.kg');
  return { value, unit };
}

function renderSummaryMetric(
  label: string,
  value: string,
  styles: ReturnType<typeof createStyles>,
  suffix?: string
): React.ReactElement {
  return (
    <Text style={styles.exerciseDetailSummary}>
      <Text style={styles.groupDetailMuted}>{`${label}: `}</Text>
      <Text style={styles.groupDetailValue}>{value}</Text>
      {suffix ? <Text style={styles.groupDetailMuted}>{` ${suffix}`}</Text> : null}
    </Text>
  );
}

function renderSetLine(
  language: AppState['language'],
  massUnit: MassUnit,
  set: GroupSet,
  index: number,
  styles: ReturnType<typeof createStyles>
): React.ReactElement {
  const locale = language ?? 'en';
  const setType = inferSetType(set);

  if (setType === 'cardio') {
    const cardioParts: Array<{ label?: string; value: string; suffix?: string }> = [];
    if (set.distanceKm != null) cardioParts.push({ value: formatLocalizedNumber(locale, set.distanceKm, { maximumFractionDigits: 1 }), suffix: 'km' });
    if (set.durationMin != null) cardioParts.push({ value: formatWholeNumber(locale, set.durationMin), suffix: 'min' });
    if (set.pauseSec != null) cardioParts.push({ label: t(locale, 'pauseShort'), value: formatWholeNumber(locale, set.pauseSec), suffix: 's' });
    if (cardioParts.length === 0) cardioParts.push({ value: formatWholeNumber(locale, set.weight ?? 0) });

    return (
      <Text style={styles.groupDetail}>
        <Text style={styles.groupDetailValue}>{index}</Text>
        <Text style={styles.groupDetailMuted}>{') '}</Text>
        {cardioParts.map((part, partIndex) => (
          <React.Fragment key={`cardio-part-${index}-${partIndex}`}>
            {partIndex > 0 ? <Text style={styles.groupDetailMuted}>{' / '}</Text> : null}
            {part.label ? <Text style={styles.groupDetailMuted}>{`${part.label} `}</Text> : null}
            <Text style={styles.groupDetailValue}>{part.value}</Text>
            {part.suffix ? <Text style={styles.groupDetailMuted}>{` ${part.suffix}`}</Text> : null}
          </React.Fragment>
        ))}
      </Text>
    );
  }

  const isBodyweight = setType === 'bodyweight' || set.isBodyweight === true || set.weight === 0;
  const reps = Number.isFinite(set.reps) && set.reps > 0 ? Math.round(set.reps) : 0;
  const repsLabel = t(locale, 'repmax.reps');
  const weightParts = isBodyweight ? null : splitWeightParts(set.weight ?? 0, massUnit, locale);

  return (
    <Text style={styles.groupDetail}>
      <Text style={styles.groupDetailValue}>{index}</Text>
      <Text style={styles.groupDetailMuted}>{') '}</Text>
      {isBodyweight ? (
        <Text style={styles.groupDetailMuted}>{'BW'}</Text>
      ) : (
        <>
          <Text style={styles.groupDetailValue}>{weightParts?.value}</Text>
          <Text style={styles.groupDetailMuted}>{` ${weightParts?.unit}`}</Text>
        </>
      )}
      <Text style={styles.groupDetailMuted}>{' x '}</Text>
      <Text style={styles.groupDetailValue}>{reps}</Text>
      <Text style={styles.groupDetailMuted}>{` ${repsLabel}`}</Text>
    </Text>
  );
}

function countTotalReps(sets: GroupSet[]): number {
  return sets.reduce((total, set) => {
    if (!Number.isFinite(set.reps) || set.reps <= 0) return total;
    return total + Math.round(set.reps);
  }, 0);
}

function toTimelineNotesByDate(notes: NoteEntry[]): Record<string, string> {
  const byDate: Record<string, string> = {};
  const sorted = notes
    .filter((note) => note.text.trim().length > 0 && typeof note.createdAt === 'string' && note.createdAt.length >= 10)
    .slice()
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  for (const note of sorted) {
    const dateKey = note.createdAt.slice(0, 10);
    if (!byDate[dateKey]) {
      byDate[dateKey] = note.text.trim();
    }
  }
  return byDate;
}

const HistoryScreenContent: React.FC<Props> = ({ appState, onBack, initialExpandedDateKey: _initialExpandedDateKey }) => {
  const language = appState.language ?? 'en';
  const massUnit = appState.massUnit ?? 'kg';
  const setsLabel = t(language, 'setsLabel');
  const unknownLabel = t(language, 'common.unknown');
  const themeTokens = useMemo(() => resolveThemeTokens(appState.theme), [appState.theme]);
  const styles = useMemo(() => createStyles(themeTokens), [themeTokens]);
  const timelineTheme = useMemo(
    () => ({
      surface: themeTokens.bg,
      stroke: themeTokens.stroke,
      accent: themeTokens.accent,
      textMuted: themeTokens.textMuted,
      text: themeTokens.text,
    }),
    [themeTokens.accent, themeTokens.bg, themeTokens.stroke, themeTokens.text, themeTokens.textMuted]
  );
  const timelineExpandedRowBackgroundColor = useMemo(
    () => toRgba(themeTokens.accent, themeTokens.id === 'calmLight' ? 0.08 : 0.14),
    [themeTokens.accent, themeTokens.id]
  );
  const isMountedRef = useRef(true);
  const scrollY = useRef(new Animated.Value(0)).current;
  const [allNotes, setAllNotes] = useState<NoteEntry[]>([]);
  const [expandedDateKey, setExpandedDateKey] = useState<string | null>(null);
  const [expandedBlocks, setExpandedBlocks] = useState<Set<string>>(new Set());
  const [expandedExercises, setExpandedExercises] = useState<Set<string>>(new Set());

  useEffect(
    () => () => {
      isMountedRef.current = false;
    },
    []
  );

  const timelineItems = useMemo(
    () => buildWorkoutTimeline(appState, { limit: Number.MAX_SAFE_INTEGER }),
    [appState]
  );

  const groupsByDate = useMemo(() => {
    const map = new Map<string, BlockGroup[]>();
    const dateKeys = getWorkoutDates(appState);
    for (const dateKey of dateKeys) {
      const groups = groupByBlock(groupDailySets(getDailyWorkout(appState, dateKey)));
      map.set(dateKey, groups);
    }
    return map;
  }, [appState]);

  const refreshNotes = useCallback(async () => {
    try {
      const notes = await listNotes();
      if (!isMountedRef.current) return;
      setAllNotes(notes);
    } catch (error) {
      console.warn('Failed to load notes for history timeline', error);
    }
  }, []);

  useEffect(() => {
    void refreshNotes();
  }, [refreshNotes]);

  useFocusEffect(
    useCallback(() => {
      void refreshNotes();
      setExpandedDateKey(null);
      setExpandedBlocks(new Set());
      setExpandedExercises(new Set());
      return () => {
        setExpandedDateKey(null);
        setExpandedBlocks(new Set());
        setExpandedExercises(new Set());
      };
    }, [refreshNotes])
  );

  const timelineNotesByDate = useMemo(() => toTimelineNotesByDate(allNotes), [allNotes]);

  const resolveBlockLabel = useMemo(() => {
    const known = new Set<string>(KNOWN_BLOCK_IDS);
    const byId = new Map(appState.blocks.map((b) => [b.id, b.name] as const));
    return (blockId: string | null): string | null => {
      if (!blockId) return null;
      if (known.has(blockId)) return blockLabel(blockId as TrainingBlockId, language);
      return byId.get(blockId) ?? null;
    };
  }, [appState.blocks, language]);

  const toggleDayExpanded = useCallback((dateKey: string) => {
    setExpandedBlocks(new Set());
    setExpandedExercises(new Set());
    setExpandedDateKey((prev) => (prev === dateKey ? null : dateKey));
  }, []);

  const toggleBlockExpanded = useCallback((blockKey: string) => {
    setExpandedBlocks((prev) => {
      const next = new Set(prev);
      if (next.has(blockKey)) next.delete(blockKey);
      else next.add(blockKey);
      return next;
    });
  }, []);

  const toggleExerciseExpanded = useCallback((exerciseKey: string) => {
    setExpandedExercises((prev) => {
      const next = new Set(prev);
      if (next.has(exerciseKey)) next.delete(exerciseKey);
      else next.add(exerciseKey);
      return next;
    });
  }, []);

  const renderExpandedContent = useCallback(
    (dateKey: string) => {
      const groups = groupsByDate.get(dateKey) ?? [];
      if (!groups.length) return null;

      return (
        <View style={styles.expandedSection}>
          {groups.map((block) => {
            const blockColor = getDotColor(block.blockId ?? block.blockName ?? '');
            const blockTitle = blockTitleForGroup(block, language);
            const blockSetCount = block.exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
            const blockKey = `${dateKey}::${blockKeyForGroup(block)}`;
            const blockIsExpanded = expandedBlocks.has(blockKey);

            return (
              <View key={blockKey} style={styles.blockGroup}>
                <TouchableOpacity style={styles.blockHeaderRow} onPress={() => toggleBlockExpanded(blockKey)} activeOpacity={0.85}>
                  <View style={styles.blockHeaderLeft}>
                    <View style={[styles.blockDot, { backgroundColor: blockColor }]} />
                    <Text style={styles.blockLabel}>{blockTitle || unknownLabel}</Text>
                  </View>
                  <Text style={styles.blockSummary}>{`${setsLabel}: ${blockSetCount} ${blockIsExpanded ? 'v' : '>'}`}</Text>
                </TouchableOpacity>

                {blockIsExpanded ? (
                  <View style={styles.blockExercises}>
                    {block.exercises.map((group) => {
                      const exerciseKey = `${dateKey}::${group.id}`;
                      const exerciseIsExpanded = expandedExercises.has(exerciseKey);
                      const exerciseColor = getDotColor(group.blockId ?? block.blockId ?? block.blockName ?? '');
                      const totalExerciseReps = countTotalReps(group.sets);
                      const totalExerciseVolumeKg = countTotalVolumeKg(group.sets);
                      const totalVolumeParts = formatVolumeParts(language, massUnit, totalExerciseVolumeKg);

                      return (
                        <View key={exerciseKey} style={styles.exerciseRowWrap}>
                          <TouchableOpacity
                            onPress={() => toggleExerciseExpanded(exerciseKey)}
                            activeOpacity={0.85}
                            style={styles.exerciseRow}
                          >
                            <View style={styles.exerciseHeaderLeft}>
                              <View style={[styles.exerciseDot, { backgroundColor: exerciseColor }]} />
                              <ExerciseLabelText
                                label={group.exerciseLabel}
                                style={styles.exerciseNameWrap}
                                mainStyle={styles.exerciseName}
                                secondaryStyle={styles.exerciseNameMeta}
                              />
                            </View>
                            <Text style={styles.exerciseSummary}>
                              <Text style={styles.groupDetailMuted}>{`${setsLabel}: `}</Text>
                              <Text style={styles.groupDetailValue}>{group.sets.length}</Text>
                              <Text style={styles.groupDetailMuted}>{` ${exerciseIsExpanded ? 'v' : '>'}`}</Text>
                            </Text>
                          </TouchableOpacity>

                          {exerciseIsExpanded ? (
                            <View style={styles.setList}>
                              {group.sets.map((set, setIndex) => (
                                <React.Fragment key={`${exerciseKey}-set-${setIndex}`}>
                                  {renderSetLine(language, massUnit, set, setIndex + 1, styles)}
                                </React.Fragment>
                              ))}
                              {totalExerciseReps > 0 ? (
                                renderSummaryMetric(
                                  t(language, 'analysis.previousWorkouts.totalReps'),
                                  formatWholeNumber(language, totalExerciseReps),
                                  styles
                                )
                              ) : null}
                              {totalExerciseVolumeKg > 0
                                ? renderSummaryMetric(
                                    t(language, 'analysis.previousWorkouts.totalVolume'),
                                    totalVolumeParts.value,
                                    styles,
                                    totalVolumeParts.unit
                                  )
                                : null}
                            </View>
                          ) : null}
                        </View>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      );
    },
    [expandedBlocks, expandedExercises, groupsByDate, language, massUnit, setsLabel, toggleBlockExpanded, toggleExerciseExpanded, unknownLabel]
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} hitSlop={12} style={styles.backButton} activeOpacity={0.8}>
            <Text style={styles.backText}>{t(language, 'back')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Animated.ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: false,
        })}
      >
        <PreviousWorkoutsTimeline
          language={language}
          massUnit={massUnit}
          items={timelineItems}
          resolveBlockLabel={resolveBlockLabel}
          resolveBlockColor={getDotColor}
          notesByDate={timelineNotesByDate}
          onPressDay={toggleDayExpanded}
          theme={timelineTheme}
          titleColor={themeTokens.text}
          expandedRowBackgroundColor={timelineExpandedRowBackgroundColor}
          lineOpacity={0.72}
          borderless
          includeRepCountInSummary
          scrollY={scrollY}
          heroTopCount={3}
          expandedDateKey={expandedDateKey}
          renderExpandedContent={renderExpandedContent}
        />
      </Animated.ScrollView>
    </SafeAreaView>
  );
};

export const HistoryScreen: React.FC<Props> = (props) => {
  const navigation = useContext(NavigationContext);
  if (navigation) {
    return <HistoryScreenContent {...props} />;
  }
  return (
    <NavigationContext.Provider value={fallbackNavigation as any}>
      <HistoryScreenContent {...props} />
    </NavigationContext.Provider>
  );
};

function createStyles(themeTokens: TreasyThemeTokens) {
  const isLightTheme = themeTokens.id === 'calmLight';
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: themeTokens.bg,
      paddingTop: Platform.OS === 'ios' ? SPACING.sm : SPACING.xxxl,
      ...Platform.select({
        web: { width: '100%', maxWidth: 720, alignSelf: 'center' },
      }),
    },
    content: {
      paddingHorizontal: SCREEN_PADDING,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: SPACING.xs,
    },
    backButton: {
      minWidth: 44,
      minHeight: 44,
      justifyContent: 'center',
      marginRight: SPACING.lg,
    },
    backText: {
      color: themeTokens.link,
      fontSize: TEXT.sm,
      fontWeight: '600',
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: SPACING.xxxl,
    },
    expandedSection: {
      marginTop: SPACING.sm,
      gap: SPACING.sm,
    },
    blockGroup: {
      paddingBottom: SPACING.xs,
    },
    blockHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: SPACING.sm,
      minHeight: 32,
      paddingVertical: 2,
    },
    blockHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.xs,
      flex: 1,
      minWidth: 0,
    },
    blockDot: {
      width: 8,
      height: 8,
      borderRadius: 999,
    },
    blockLabel: {
      color: themeTokens.text,
      fontSize: TEXT.sm,
      fontWeight: '800',
    },
    blockSummary: {
      color: toRgba(themeTokens.textMuted, 0.95),
      fontSize: TEXT.xs,
      fontWeight: '700',
    },
    blockExercises: {
      marginTop: SPACING.xs,
      gap: SPACING.xs,
      paddingLeft: SPACING.md,
    },
    exerciseRowWrap: {
      borderWidth: 1,
      borderColor: toRgba(themeTokens.stroke, isLightTheme ? 0.86 : 0.36),
      backgroundColor: toRgba(themeTokens.surfaceAlt, isLightTheme ? 0.82 : 0.26),
      borderRadius: 8,
      paddingHorizontal: SPACING.sm,
      paddingVertical: SPACING.xs,
    },
    exerciseRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: SPACING.sm,
      minHeight: 30,
    },
    exerciseHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.xs,
      flex: 1,
      minWidth: 0,
    },
    exerciseDot: {
      width: 7,
      height: 7,
      borderRadius: 999,
    },
    exerciseName: {
      color: themeTokens.text,
      fontSize: TEXT.sm,
      fontWeight: '800',
      letterSpacing: 0.1,
      flexShrink: 1,
    },
    exerciseNameWrap: {
      flex: 1,
      minWidth: 0,
    },
    exerciseNameMeta: {
      color: themeTokens.textMuted,
      fontSize: TEXT.xs,
      fontWeight: '700',
      marginTop: 2,
    },
    exerciseSummary: {
      color: themeTokens.textMuted,
      fontSize: TEXT.xs,
      fontWeight: '700',
    },
    setList: {
      marginTop: SPACING.xs,
      gap: 1,
      paddingLeft: SPACING.sm,
    },
    groupDetail: {
      fontSize: TEXT.xs + 1,
      fontWeight: '600',
      lineHeight: TEXT.xs + 7,
    },
    groupDetailMuted: {
      color: toRgba(themeTokens.text, isLightTheme ? 0.78 : 0.76),
      fontWeight: '600',
    },
    groupDetailValue: {
      color: isLightTheme ? toRgba(themeTokens.text, 0.96) : toRgba(themeTokens.text, 0.92),
      fontWeight: '800',
    },
    exerciseDetailSummary: {
      fontSize: TEXT.xs,
      marginTop: SPACING.xs,
    },
  });
}
