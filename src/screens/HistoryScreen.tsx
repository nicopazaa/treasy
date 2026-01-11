import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  TextInput,
  FlatList,
  LayoutAnimation,
  UIManager,
  Animated,
  Easing,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NavigationContext, useFocusEffect } from '@react-navigation/native';
import type { AppState, TrainingBlockId } from '../features/workouts';
import { getWorkoutDates, getDailyWorkout, groupDailySets, type GroupedDailySetView } from '../features/workouts';
import { getBlockTone, getDotColor } from '../shared/theme/blockTone';
import { formatRelativeDayLabel, formatWeekday, formatDate } from '../shared/utils/dateLabels';
import { SPACING, TEXT, RADIUS, SCREEN_PADDING, COLORS } from '../shared/theme/tokens';
import { blockLabel, t } from '../shared/i18n/i18n';
import { formatWeight, type MassUnit } from '../shared/utils/units';

function splitLabelParentheses(label: string): { main: string; parentheses: string | null } {
  const idx = label.indexOf('(');
  if (idx <= 0) return { main: label, parentheses: null };
  const main = label.slice(0, idx).trimEnd();
  const parentheses = label.slice(idx).trim();
  return parentheses.startsWith('(') && parentheses.length > 0 ? { main, parentheses } : { main: label, parentheses: null };
}

type Props = {
  appState: AppState;
  onBack: () => void;
  initialExpandedDateKey?: string | null;
};

type DayNode = {
  dateKey: string;
  dateMs: number;
  dateLabel: string;
  dayLabel: string;
  groups: BlockGroup[];
};

type BlockGroup = {
  blockId?: string;
  blockName?: string;
  time: string;
  exercises: GroupedDailySetView[];
};

type HistoryRange = 'all' | '7d' | '30d' | '90d';
type SetTypeFilter = 'all' | 'weighted' | 'bodyweight' | 'cardio';

type BlockFilterOption = {
  key: string;
  label: string;
  accent: string;
  dotColor: string;
};

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

function isKnownBlockId(value?: string): value is TrainingBlockId {
  return Boolean(value && KNOWN_BLOCK_IDS.includes(value as TrainingBlockId));
}

function blockKeyForGroup(block: BlockGroup): string {
  return block.blockId ?? block.blockName ?? block.exercises[0]?.id ?? 'block';
}

function blockTitleForGroup(block: BlockGroup, language: AppState['language']): string {
  const id = isKnownBlockId(block.blockId) ? block.blockId : undefined;
  if (id) return blockLabel(id, language ?? 'en');
  return block.blockName ?? block.blockId ?? '';
}

function stripDiacritics(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizeSearch(text: string): string {
  return stripDiacritics(text)
    .toLowerCase()
    .replace(/[.,!?;:()\\[\\]\"']/g, ' ')
    .replace(/\\s+/g, ' ')
    .trim();
}

function tokenize(query: string): string[] {
  const normalized = normalizeSearch(query);
  return normalized ? normalized.split(' ').filter(Boolean) : [];
}

function matchesAllTokens(haystack: string, tokens: string[]): boolean {
  if (tokens.length === 0) return true;
  const h = normalizeSearch(haystack);
  return tokens.every((token) => h.includes(token));
}

function daysForRange(range: HistoryRange): number | null {
  if (range === '7d') return 7;
  if (range === '30d') return 30;
  if (range === '90d') return 90;
  return null;
}

function inferSetType(set: {
  weight: number;
  reps: number;
  isBodyweight?: boolean;
  distanceKm?: number | null;
  durationMin?: number | null;
  pauseSec?: number | null;
  setType?: 'weighted' | 'bodyweight' | 'cardio';
}): Exclude<SetTypeFilter, 'all'> {
  if (set.setType) return set.setType;
  const isCardio = set.distanceKm != null || set.durationMin != null || set.pauseSec != null;
  if (isCardio) return 'cardio';
  if (set.isBodyweight || set.weight === 0) return 'bodyweight';
  return 'weighted';
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

function formatSetParts(
  language: AppState['language'],
  massUnit: MassUnit,
  sets: Array<{
    weight: number;
    reps: number;
    isBodyweight?: boolean;
    distanceKm?: number | null;
    durationMin?: number | null;
    pauseSec?: number | null;
    setType?: 'weighted' | 'bodyweight' | 'cardio';
  }>
): Array<{
  weightValue: string;
  weightUnit: string;
  repsValue: string | null;
  index: number;
}> {
  const lang = language ?? 'en';
  const parts = sets.map((s, idx) => {
    const cardioParts: string[] = [];
    if (s.distanceKm != null) cardioParts.push(`${s.distanceKm} km`);
    if (s.durationMin != null) cardioParts.push(`${s.durationMin} min`);
    if (s.pauseSec != null) cardioParts.push(`${t(language ?? 'en', 'pauseShort')} ${s.pauseSec}s`);
    const formattedWeight = formatWeight(s.weight ?? 0, massUnit, lang);
    const lastSpace = formattedWeight.lastIndexOf(' ');
    const weightValue = lastSpace > 0 ? formattedWeight.slice(0, lastSpace) : formattedWeight;
    const weightUnit = lastSpace > 0 ? formattedWeight.slice(lastSpace + 1) : '';
    return {
      weightValue:
        s.setType === 'cardio'
          ? cardioParts.length
            ? cardioParts.join(' / ')
            : `${s.weight}`
          : s.isBodyweight
            ? 'BW'
            : weightValue,
      weightUnit: s.setType === 'cardio' ? '' : s.isBodyweight ? '' : weightUnit,
      repsValue: s.setType === 'cardio' ? null : `${s.reps}`,
      index: idx + 1,
    };
  });
  return parts.reverse();
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

function buildDayNodes(appState: AppState, language: AppState['language']): DayNode[] {
  const keys = getWorkoutDates(appState);
  return keys.map((key) => {
    const dt = parseDateKey(key);
    let dateLabel = key;
    let dayLabel = '';
    const dateMs = dt ? dt.getTime() : 0;

    if (dt) {
      const relative = formatRelativeDayLabel(dt, new Date(), language ?? 'en');
      dateLabel = formatDate(dt);
      dayLabel = relative ?? formatWeekday(dt, language ?? 'en');
    }

    const groups = groupByBlock(groupDailySets(getDailyWorkout(appState, key)));
    return { dateKey: key, dateMs, dateLabel, dayLabel, groups };
  });
}

type FilterHeaderProps = {
  expanded: boolean;
  count: number;
  label: string;
  onToggle: () => void;
};

const FilterHeader: React.FC<FilterHeaderProps> = ({ expanded, count, label, onToggle }) => {
  const rotateAnim = useRef(new Animated.Value(expanded ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(rotateAnim, {
      toValue: expanded ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [expanded, rotateAnim]);

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '90deg'],
  });

  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.filterHeaderContainer,
        expanded ? styles.filterHeaderContainerExpanded : null,
        pressed ? styles.filterHeaderPressed : null,
      ]}
    >
      <Text style={styles.filterHeaderTitle}>{label}</Text>
      <View style={styles.filterHeaderMeta}>
        <View style={styles.filterHeaderBadge}>
          <Text style={styles.filterHeaderBadgeText}>{count}</Text>
        </View>
        <Animated.View style={[styles.filterHeaderChevron, { transform: [{ rotate: rotation }] }]}>
          <Text style={[styles.filterHeaderChevronText, expanded ? styles.filterHeaderChevronTextOpen : null]}>
            {'>'}
          </Text>
        </Animated.View>
      </View>
    </Pressable>
  );
};

const HistoryScreenContent: React.FC<Props> = ({ appState, onBack, initialExpandedDateKey }) => {
  const language = appState.language ?? 'en';
  const massUnit = appState.massUnit ?? 'kg';
  const days = useMemo(() => buildDayNodes(appState, language), [appState, language]);
  const [range, setRange] = useState<HistoryRange>('all');
  const [blockFilterKey, setBlockFilterKey] = useState<string>('all');
  const [setTypeFilter, setSetTypeFilter] = useState<SetTypeFilter>('all');
  const [query, setQuery] = useState('');
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [collapsedBlocks, setCollapsedBlocks] = useState<Set<string>>(new Set());
  const [collapsedExercises, setCollapsedExercises] = useState<Set<string>>(new Set());

  const queryTokens = useMemo(() => tokenize(query), [query]);

  const daysInRange = useMemo(() => {
    const windowDays = daysForRange(range);
    if (!windowDays) return days;
    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - (windowDays - 1));
    const cutoffMs = cutoff.getTime();
    return days.filter((day) => day.dateMs >= cutoffMs);
  }, [days, range]);

  const blockOptions = useMemo<BlockFilterOption[]>(() => {
    const map = new Map<string, BlockFilterOption>();
    for (const day of daysInRange) {
      for (const block of day.groups) {
        const key = blockKeyForGroup(block);
        if (!key || map.has(key)) continue;
        const label = blockTitleForGroup(block, language);
        if (!label) continue;

        const toneKey = block.blockId ?? block.blockName ?? '';
        const tone = getBlockTone(toneKey);
        map.set(key, {
          key,
          label,
          accent: tone.accent,
          dotColor: getDotColor(toneKey),
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [daysInRange, language]);

  useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  useEffect(() => {
    if (blockFilterKey === 'all') return;
    const exists = blockOptions.some((opt) => opt.key === blockFilterKey);
    if (!exists) setBlockFilterKey('all');
  }, [blockFilterKey, blockOptions]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (range !== 'all') count += 1;
    if (blockFilterKey !== 'all') count += 1;
    if (setTypeFilter !== 'all') count += 1;
    if (queryTokens.length > 0) count += 1;
    return count;
  }, [range, blockFilterKey, setTypeFilter, queryTokens.length]);

  const hasActiveFilters = activeFilterCount > 0;

  const resetFilters = () => {
    setRange('all');
    setBlockFilterKey('all');
    setSetTypeFilter('all');
    setQuery('');
  };

  const toggleFiltersExpanded = () => {
    if (Platform.OS !== 'web') {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setFiltersExpanded((prev) => !prev);
  };

  const visibleDays = useMemo<DayNode[]>(() => {
    const res: DayNode[] = [];

    for (const day of daysInRange) {
      const nextGroups: BlockGroup[] = [];

      for (const block of day.groups) {
        const key = blockKeyForGroup(block);
        if (blockFilterKey !== 'all' && key !== blockFilterKey) continue;

        const blockTitle = blockTitleForGroup(block, language);
        const blockMatchesQuery = matchesAllTokens(blockTitle, queryTokens);

        const nextExercises: GroupedDailySetView[] = [];
        let minTime = block.time;

        for (const group of block.exercises) {
          const filteredSets =
            setTypeFilter === 'all'
              ? group.sets
              : group.sets.filter((s) => inferSetType(s) === setTypeFilter);

          if (filteredSets.length === 0) continue;

          if (queryTokens.length > 0 && !blockMatchesQuery && !matchesAllTokens(group.exerciseLabel, queryTokens)) {
            continue;
          }

          nextExercises.push({ ...group, sets: filteredSets });
          if (group.time < minTime) minTime = group.time;
        }

        if (nextExercises.length === 0) continue;
        nextGroups.push({ ...block, time: minTime, exercises: nextExercises });
      }

      if (nextGroups.length === 0) continue;
      res.push({ ...day, groups: nextGroups });
    }

    return res;
  }, [blockFilterKey, daysInRange, language, queryTokens, setTypeFilter]);

  const allBlockKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const day of days) {
      for (const block of day.groups) {
        keys.add(blockKeyForGroup(block));
      }
    }
    return Array.from(keys);
  }, [days]);

  const allExerciseIds = useMemo(() => {
    const keys = new Set<string>();
    for (const day of days) {
      for (const block of day.groups) {
        for (const group of block.exercises) {
          keys.add(group.id);
        }
      }
    }
    return Array.from(keys);
  }, [days]);

  useFocusEffect(
    useCallback(() => {
      setExpandedKey(null);
      setCollapsedBlocks(new Set(allBlockKeys));
      setCollapsedExercises(new Set(allExerciseIds));
    }, [allBlockKeys, allExerciseIds])
  );

  useEffect(() => {
    setCollapsedBlocks((prev) => {
      if (allBlockKeys.length === 0) return new Set();
      const next = new Set<string>();
      for (const key of prev) {
        if (allBlockKeys.includes(key)) next.add(key);
      }
      return next;
    });
    setCollapsedExercises((prev) => {
      if (allExerciseIds.length === 0) return new Set();
      const next = new Set<string>();
      for (const key of prev) {
        if (allExerciseIds.includes(key)) next.add(key);
      }
      return next;
    });
  }, [allBlockKeys, allExerciseIds]);

  const toggle = (key: string) => {
    setExpandedKey((prev) => (prev === key ? null : key));
  };

  const toggleBlockCollapsed = (blockKey: string) => {
    setCollapsedBlocks((prev) => {
      const next = new Set(prev);
      if (next.has(blockKey)) next.delete(blockKey);
      else next.add(blockKey);
      return next;
    });
  };

  const toggleExerciseCollapsed = (exerciseId: string) => {
    setCollapsedExercises((prev) => {
      const next = new Set(prev);
      if (next.has(exerciseId)) next.delete(exerciseId);
      else next.add(exerciseId);
      return next;
    });
  };

  const renderDayItem = ({ item: day, index }: { item: DayNode; index: number }) => {
    const isLast = index === visibleDays.length - 1;
    const isExpanded = expandedKey === day.dateKey;

    return (
      <View style={styles.row}>
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
              {day.groups.map((block) => {
                const toneKey = block.blockId ?? block.blockName ?? '';
                const tone = getBlockTone(toneKey);
                const dotColor = getDotColor(toneKey);
                const blockKey = blockKeyForGroup(block);
                const blockSetCount = block.exercises.reduce((sum, ex) => sum + ex.sets.length, 0);
                const isBlockCollapsed = collapsedBlocks.has(blockKey);
                const blockTitle = blockTitleForGroup(block, language);
                return (
                  <View key={blockKey} style={styles.blockGroup}>
                    {blockTitle ? (
                      <TouchableOpacity
                        style={styles.blockHeaderRow}
                        onPress={() => toggleBlockCollapsed(blockKey)}
                        activeOpacity={0.85}
                      >
                        <Text style={[styles.blockLabel, { color: dotColor }]}>
                          {blockTitle}
                        </Text>
                        <Text style={styles.blockSummary}>
                          Sett: {blockSetCount} {isBlockCollapsed ? '>' : 'v'}
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                    {!isBlockCollapsed && (
                      <View style={styles.blockExercises}>
                        {block.exercises.map((group) => {
                          const isExerciseCollapsed = collapsedExercises.has(group.id);
                          return (
                            <View key={group.id} style={styles.groupRow}>
                              <View
                                style={[
                                  styles.blockLine,
                                  {
                                    backgroundColor: tone.soft,
                                    top: SPACING.xs * -1,
                                    bottom:
                                      group === block.exercises[block.exercises.length - 1]
                                        ? 16
                                        : -SPACING.xs,
                                  },
                                ]}
                              />
                              {group === block.exercises[block.exercises.length - 1] ? (
                                <View style={[styles.blockLineEnd, { backgroundColor: tone.soft }]} />
                              ) : null}
                              <View style={styles.groupTextColumn}>
                                <TouchableOpacity
                                  onPress={() => toggleExerciseCollapsed(group.id)}
                                  activeOpacity={0.85}
                                  style={styles.exerciseRow}
                                >
                                  <View style={styles.exerciseTitleColumn}>
                                    <View style={styles.exerciseTitleRow}>
                                      <View style={[styles.exerciseDot, { backgroundColor: dotColor }]} />
                                      {(() => {
                                        const label = group.exerciseLabel;
                                        const split = splitLabelParentheses(label);
                                        return split.parentheses ? (
                                          <Text style={styles.exerciseName} numberOfLines={2}>
                                            <Text style={styles.exerciseNameMain}>{split.main}</Text>
                                            {'\n'}
                                            <Text style={styles.exerciseNameParen}>{split.parentheses}</Text>
                                          </Text>
                                        ) : (
                                          <Text style={styles.exerciseName} numberOfLines={1}>
                                            {label}
                                          </Text>
                                        );
                                      })()}
                                    </View>
                                    <View style={[styles.exerciseDivider, { backgroundColor: dotColor }]} />
                                  </View>
                                  <Text style={styles.exerciseSummary}>
                                    Sett: {group.sets.length} {isExerciseCollapsed ? '>' : 'v'}
                                  </Text>
                                </TouchableOpacity>
                                    {!isExerciseCollapsed && (
                                      <View style={styles.setList}>
                                        {formatSetParts(language, massUnit, group.sets).map((line, idx) => (
                                          <Text key={`${group.id}-set-${idx}`} style={styles.groupDetail}>
                                            <Text style={styles.indexText}>[{line.index}] </Text>
                                            <Text style={styles.setValueText}>{line.weightValue}</Text>
                                            {line.weightUnit ? (
                                              <>
                                                <Text style={styles.setUnitText}> </Text>
                                                <Text style={styles.setUnitText}>{line.weightUnit}</Text>
                                              </>
                                            ) : null}
                                            {line.repsValue ? (
                                              <>
                                                <Text style={styles.setUnitText}> x </Text>
                                                <Text style={styles.setValueText}>{line.repsValue}</Text>
                                                <Text style={styles.setUnitText}> reps</Text>
                                              </>
                                            ) : null}
                                          </Text>
                                        ))}
                                      </View>
                                    )}
                              </View>
                              <Text style={styles.groupTime}>{group.time}</Text>
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  // Filters live in the FlatList header so the history list stays one scroll surface.
  const filterHeader = (
    <View style={styles.filterWrapper}>
      <FilterHeader
        expanded={filtersExpanded}
        count={activeFilterCount}
        label={t(language, 'historyFilters')}
        onToggle={toggleFiltersExpanded}
      />

      {filtersExpanded && (
        <View style={styles.filterBody}>
          <View style={styles.filterDivider} />
          <View style={styles.filterBodyContent}>
            <View style={styles.searchRow}>
              <Text style={styles.searchIcon}>{'\u{1F50D}'}</Text>
              <TextInput
                style={styles.searchInput}
                value={query}
                onChangeText={setQuery}
                placeholder={t(language, 'historyFilterPlaceholder')}
                placeholderTextColor="#6B7280"
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
              />
              {query.trim() ? (
                <TouchableOpacity onPress={() => setQuery('')} activeOpacity={0.85} hitSlop={8} style={styles.clearButton}>
                  <Text style={styles.clearText}>{'\u00D7'}</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            <View style={styles.filterRow}>
              <View style={styles.segment}>
                {(['all', '7d', '30d', '90d'] as HistoryRange[]).map((r) => {
                  const selected = range === r;
                  const label = r === 'all' ? t(language, 'progress.range.all') : r;
                  return (
                    <TouchableOpacity
                      key={r}
                      style={[styles.segmentButton, selected ? styles.segmentButtonSelected : null]}
                      onPress={() => setRange(r)}
                      activeOpacity={0.9}
                    >
                      <Text style={[styles.segmentText, selected ? styles.segmentTextSelected : null]}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.segment}>
                {[
                  { key: 'all' as const, label: t(language, 'progress.range.all') },
                  { key: 'weighted' as const, label: t(language, 'weight') },
                  { key: 'bodyweight' as const, label: blockLabel('bodyweight', language) },
                  { key: 'cardio' as const, label: blockLabel('cardio', language) },
                ].map((opt) => {
                  const selected = setTypeFilter === opt.key;
                  return (
                    <TouchableOpacity
                      key={opt.key}
                      style={[styles.segmentButton, selected ? styles.segmentButtonSelected : null]}
                      onPress={() => setSetTypeFilter(opt.key)}
                      activeOpacity={0.9}
                    >
                      <Text style={[styles.segmentText, selected ? styles.segmentTextSelected : null]} numberOfLines={1}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.chipRow}>
              <TouchableOpacity
                style={[styles.chip, blockFilterKey === 'all' ? styles.chipSelected : null]}
                onPress={() => setBlockFilterKey('all')}
                activeOpacity={0.9}
              >
                <Text style={[styles.chipText, blockFilterKey === 'all' ? styles.chipTextSelected : null]}>
                  {t(language, 'progress.range.all')}
                </Text>
              </TouchableOpacity>
              {blockOptions.map((opt) => {
                const selected = opt.key === blockFilterKey;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[
                      styles.chip,
                      {
                        borderColor: selected ? opt.accent : '#1F2937',
                        backgroundColor: selected ? getBlockTone(opt.key).soft : '#020617',
                      },
                    ]}
                    onPress={() => setBlockFilterKey(opt.key)}
                    activeOpacity={0.9}
                  >
                    <View style={[styles.chipDot, { backgroundColor: opt.dotColor }]} />
                    <Text style={[styles.chipText, selected ? styles.chipTextSelected : null]} numberOfLines={1}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.filterFooter}>
              <Text style={styles.filterMeta}>{t(language, 'historyFilterResults', { count: visibleDays.length })}</Text>
              {hasActiveFilters ? (
                <TouchableOpacity onPress={resetFilters} activeOpacity={0.9} style={styles.resetButton}>
                  <Text style={styles.resetText}>{t(language, 'historyFilterReset')}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} hitSlop={12} style={styles.backButton} activeOpacity={0.8}>
            <Text style={styles.backText}>{t(language, 'back')}</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.headerTitle}>{t(language, 'historyTitle')}</Text>
      </View>

      {days.length === 0 ? (
        <View style={[styles.emptyContainer, styles.content]}>
          <Text style={styles.emptyTitle}>{t(language, 'historyEmptyTitle')}</Text>
          <Text style={styles.emptyText}>{t(language, 'historyEmptyText')}</Text>
        </View>
      ) : (
        <FlatList
          data={visibleDays}
          keyExtractor={(item) => item.dateKey}
          renderItem={renderDayItem}
          ListHeaderComponent={filterHeader}
          ListEmptyComponent={
            <View style={styles.emptyContainerList}>
              <Text style={styles.emptyTitle}>{t(language, 'historyFilterNoResultsTitle')}</Text>
              <Text style={styles.emptyText}>{t(language, 'historyFilterNoResultsText')}</Text>
            </View>
          }
          contentContainerStyle={styles.scrollContent}
          style={styles.list}
          keyboardShouldPersistTaps="handled"
        />
      )}
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
  setList: {
    gap: SPACING.sm,
    paddingLeft: SPACING.xl,
  },
  content: {
    paddingHorizontal: SCREEN_PADDING,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
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
  headerTitle: {
    color: '#F9FAFB',
    fontSize: TEXT.xl,
    fontWeight: '700',
    marginLeft: SPACING.sm,
  },
  headerSubtitle: {
    color: '#9CA3AF',
    fontSize: TEXT.sm,
    marginBottom: SPACING.xl,
  },
  list: {
    flex: 1,
  },
  filterWrapper: {
    marginTop: SPACING.md,
    marginBottom: SPACING.xxl,
  },
  filterHeaderContainer: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
    backgroundColor: '#0B1220',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  filterHeaderContainerExpanded: {
    borderColor: 'rgba(148, 163, 184, 0.3)',
  },
  filterHeaderPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },
  filterHeaderTitle: {
    color: '#DDE6F5',
    fontSize: TEXT.sm,
    fontWeight: '700',
  },
  filterHeaderMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  filterHeaderBadge: {
    minWidth: 22,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: SPACING.xs,
    backgroundColor: 'rgba(148, 163, 184, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterHeaderBadgeText: {
    color: '#E2E8F0',
    fontSize: TEXT.xs,
    fontWeight: '800',
  },
  filterHeaderChevron: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterHeaderChevronText: {
    color: '#64748B',
    fontSize: TEXT.sm,
    fontWeight: '800',
  },
  filterHeaderChevronTextOpen: {
    color: '#CBD5F5',
  },
  filterBody: {
    marginTop: SPACING.xs,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.12)',
    backgroundColor: '#0B1220',
    overflow: 'hidden',
  },
  filterDivider: {
    height: 1,
    backgroundColor: 'rgba(148, 163, 184, 0.14)',
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
  },
  filterBodyContent: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    paddingTop: SPACING.sm,
    gap: SPACING.sm,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#111827',
    backgroundColor: '#020617',
    paddingHorizontal: SPACING.sm,
    minHeight: 44,
    gap: SPACING.xs,
  },
  searchIcon: {
    color: '#9CA3AF',
    fontSize: TEXT.sm,
  },
  searchInput: {
    flex: 1,
    color: '#F9FAFB',
    fontSize: TEXT.sm,
    paddingVertical: 0,
  },
  clearButton: {
    minWidth: 32,
    minHeight: 32,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearText: {
    color: '#9CA3AF',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 22,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  segment: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: '#1F2937',
    backgroundColor: '#020617',
    overflow: 'hidden',
  },
  segmentButton: {
    minHeight: 34,
    paddingHorizontal: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentButtonSelected: {
    backgroundColor: '#0B1220',
  },
  segmentText: {
    color: '#9CA3AF',
    fontSize: TEXT.xs,
    fontWeight: '800',
  },
  segmentTextSelected: {
    color: '#F9FAFB',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -SPACING.xs,
  },
  chip: {
    margin: SPACING.xs,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: '#1F2937',
    backgroundColor: '#020617',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  chipSelected: {
    borderColor: '#3B82F6',
    backgroundColor: 'rgba(59, 130, 246, 0.14)',
  },
  chipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  chipText: {
    color: '#E5E7EB',
    fontSize: TEXT.xs,
    fontWeight: '800',
  },
  chipTextSelected: {
    color: '#F9FAFB',
  },
  filterFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.md,
  },
  filterMeta: {
    color: '#9CA3AF',
    fontSize: TEXT.xs,
    fontWeight: '700',
  },
  resetButton: {
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: '#1F2937',
    backgroundColor: '#020617',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetText: {
    color: '#93C5FD',
    fontSize: TEXT.xs,
    fontWeight: '900',
  },
  emptyContainer: {
    marginTop: SPACING.xxl,
    paddingHorizontal: SCREEN_PADDING,
  },
  emptyContainerList: {
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
    paddingHorizontal: SCREEN_PADDING,
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
    backgroundColor: '#2563EB',
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
    color: '#60A5FA',
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
  blockGroup: {
    marginBottom: SPACING.md,
  },
  blockHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: SPACING.sm,
  },
  blockExercises: {
    gap: SPACING.md,
    paddingLeft: SPACING.lg,
    position: 'relative',
  },
  blockLine: {
    position: 'absolute',
    left: SPACING.sm,
    top: 0,
    bottom: 0,
    width: 2,
    borderRadius: 999,
  },
  blockLineEnd: {
    position: 'absolute',
    left: SPACING.sm,
    width: 16,
    height: 2,
    bottom: 16,
  },
  groupRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: SPACING.xs,
    paddingLeft: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  groupTextColumn: {
    flexShrink: 1,
    paddingRight: SPACING.sm,
  },
  blockLabel: {
    fontSize: TEXT.md,
    fontWeight: '800',
    marginBottom: 2,
  },
  blockSummary: {
    color: 'rgba(148,163,184,0.75)',
    fontSize: 11,
    fontWeight: '600',
  },
    exerciseRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: SPACING.sm,
      paddingRight: SPACING.sm,
      ...(Platform.OS === 'web' ? ({ outlineStyle: 'none', outlineWidth: 0 } as any) : {}),
    },
  exerciseTitleColumn: {
    flexShrink: 1,
    alignSelf: 'flex-start',
  },
  exerciseTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  exerciseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  exerciseName: {
    color: '#F9FAFB',
    fontSize: TEXT.sm,
    fontWeight: '700',
    letterSpacing: 0.15,
  },
  exerciseNameMain: {
    color: '#F9FAFB',
  },
  exerciseNameParen: {
    color: COLORS.textSecondaryGray,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  exerciseSummary: {
    color: 'rgba(148,163,184,0.75)',
    fontSize: 11,
    fontWeight: '600',
    marginLeft: SPACING.xs,
  },
  exerciseDivider: {
    height: StyleSheet.hairlineWidth,
    width: 182,
    alignSelf: 'flex-start',
    marginLeft: SPACING.sm + 8,
    marginTop: SPACING.xs,
    marginBottom: SPACING.xs + 2,
    opacity: 0.62,
    borderRadius: 999,
  },
  groupDetail: {
    color: '#9CA3AF',
    fontSize: TEXT.xs,
    fontWeight: '700',
  },
  setCountAbove: {
    marginLeft: SPACING.lg,
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
  },
  goldText: {
    color: '#E5E7EB',
    fontWeight: '800',
    fontSize: TEXT.xs,
  },
  whiteText: {
    color: '#9CA3AF',
    fontWeight: '700',
    fontSize: TEXT.xs,
  },
  setValueText: {
    color: '#F9FAFB',
    fontWeight: '800',
    fontSize: TEXT.xs,
  },
  setUnitText: {
    color: COLORS.textSecondaryGray,
    fontWeight: '700',
    fontSize: TEXT.xs,
  },
  indexText: {
    color: '#9CA3AF',
    fontWeight: '800',
    fontSize: TEXT.sm,
  },
  mutedText: {
    color: '#9CA3AF',
    fontWeight: '700',
  },
  greenText: {
    color: '#10B981',
    fontWeight: '800',
  },
  groupTime: {
    color: '#9CA3AF',
    fontSize: TEXT.xs,
  },
});
