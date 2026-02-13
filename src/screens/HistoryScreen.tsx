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
import { formatWeight, type MassUnit } from '../shared/utils/units';

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

const TIMELINE_THEME = {
  surface: '#020617',
  stroke: '#1F2937',
  accent: '#60A5FA',
  textMuted: '#94A3B8',
  text: '#E2E8F0',
} as const;

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

function formatSetLine(
  language: AppState['language'],
  massUnit: MassUnit,
  set: GroupSet,
  index: number
): string {
  const setType = inferSetType(set);

  if (setType === 'cardio') {
    const cardioParts: string[] = [];
    if (set.distanceKm != null) cardioParts.push(`${set.distanceKm} km`);
    if (set.durationMin != null) cardioParts.push(`${set.durationMin} min`);
    if (set.pauseSec != null) cardioParts.push(`${t(language ?? 'en', 'pauseShort')} ${set.pauseSec}s`);
    if (cardioParts.length === 0) cardioParts.push(`${set.weight ?? 0}`);
    return `${index}) ${cardioParts.join(' / ')}`;
  }

  const isBodyweight = setType === 'bodyweight' || set.isBodyweight === true || set.weight === 0;
  const reps = Number.isFinite(set.reps) && set.reps > 0 ? Math.round(set.reps) : 0;
  const weightPart = isBodyweight ? 'BW' : formatWeight(set.weight ?? 0, massUnit, language ?? 'en');
  return `${index}) ${weightPart} x ${reps} reps`;
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
                    <Text style={styles.blockLabel}>{blockTitle || 'Unknown'}</Text>
                  </View>
                  <Text style={styles.blockSummary}>{`Sett: ${blockSetCount} ${blockIsExpanded ? 'v' : '>'}`}</Text>
                </TouchableOpacity>

                {blockIsExpanded ? (
                  <View style={styles.blockExercises}>
                    {block.exercises.map((group) => {
                      const exerciseKey = `${dateKey}::${group.id}`;
                      const exerciseIsExpanded = expandedExercises.has(exerciseKey);
                      const exerciseColor = getDotColor(group.blockId ?? block.blockId ?? block.blockName ?? '');

                      return (
                        <View key={exerciseKey} style={styles.exerciseRowWrap}>
                          <TouchableOpacity
                            onPress={() => toggleExerciseExpanded(exerciseKey)}
                            activeOpacity={0.85}
                            style={styles.exerciseRow}
                          >
                            <View style={styles.exerciseHeaderLeft}>
                              <View style={[styles.exerciseDot, { backgroundColor: exerciseColor }]} />
                              <Text style={styles.exerciseName}>{group.exerciseLabel}</Text>
                            </View>
                            <Text style={styles.exerciseSummary}>{`Sett: ${group.sets.length} ${exerciseIsExpanded ? 'v' : '>'}`}</Text>
                          </TouchableOpacity>

                          {exerciseIsExpanded ? (
                            <View style={styles.setList}>
                              {group.sets.map((set, setIndex) => (
                                <Text key={`${exerciseKey}-set-${setIndex}`} style={styles.groupDetail}>
                                  {formatSetLine(language, massUnit, set, setIndex + 1)}
                                </Text>
                              ))}
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
    [expandedBlocks, expandedExercises, groupsByDate, language, massUnit, toggleBlockExpanded, toggleExerciseExpanded]
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
          theme={TIMELINE_THEME}
          titleColor="#F8FAFC"
          lineOpacity={0.72}
          borderless
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
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
    color: '#60A5FA',
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
    color: '#E2E8F0',
    fontSize: TEXT.sm,
    fontWeight: '800',
  },
  blockSummary: {
    color: 'rgba(148, 163, 184, 0.85)',
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
    borderColor: 'rgba(148, 163, 184, 0.18)',
    backgroundColor: 'rgba(15, 23, 42, 0.28)',
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
    color: '#F8FAFC',
    fontSize: TEXT.sm,
    fontWeight: '800',
    letterSpacing: 0.1,
    flexShrink: 1,
  },
  exerciseSummary: {
    color: '#A9B7CA',
    fontSize: TEXT.xs,
    fontWeight: '700',
  },
  setList: {
    marginTop: SPACING.xs,
    gap: 1,
    paddingLeft: SPACING.sm,
  },
  groupDetail: {
    color: 'rgba(226, 232, 240, 0.76)',
    fontSize: TEXT.xs + 1,
    fontWeight: '600',
    lineHeight: TEXT.xs + 7,
  },
});
