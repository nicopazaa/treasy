import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  SectionListData,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NavigationContext, useFocusEffect } from '@react-navigation/native';
import { AppState, TrainingBlock, Exercise, SetEntry, TrainingBlockId } from '../features/workouts/model/types';
import { getSetsForExercise } from '../features/workouts/model/workoutService';
import { getBlockTone } from '../shared/theme/blockTone';
import { formatDate } from '../shared/utils/dateLabels';
import { SPACING, TEXT, SCREEN_PADDING, RADIUS, COLORS } from '../shared/theme/tokens';
import { blockLabel, t } from '../shared/i18n/i18n';
import { formatExerciseLabel } from '../shared/utils/exerciseLabel';
import { formatWeight, type MassUnit } from '../shared/utils/units';

interface Props {
  appState: AppState;
  onBack: () => void;
}

type BestSetParts = {
  isWeighted: boolean;
  weightValue: string;
  weightUnit: string;
  repsValue: number;
};

interface RepMaxItem {
  id: string; // exercise id
  exerciseName: string;
  blockId: string;
  bestSet: SetEntry;
  bestSetParts: BestSetParts;
  bestEst1Rm: number;
  bestSetDateLabel: string;
}

interface RepMaxSection {
  title: string;
  blockId: string;
  data: RepMaxItem[];
  totalCount: number;
  topExerciseId: string;
}

const fallbackNavigation = {
  addListener: () => () => {},
  isFocused: () => true,
};

function estimateOneRm(weight: number, reps: number): number {
  if (reps <= 1) return weight;
  const est = weight * (1 + reps / 30);
  return Math.round(est * 10) / 10;
}

function splitWeightLabel(value: string): { weightValue: string; weightUnit: string } {
  const trimmed = value.trim();
  const lastSpace = trimmed.lastIndexOf(' ');
  if (lastSpace <= 0) return { weightValue: trimmed, weightUnit: '' };
  return {
    weightValue: trimmed.slice(0, lastSpace),
    weightUnit: trimmed.slice(lastSpace + 1),
  };
}

function buildBestSetParts(set: SetEntry, massUnit: MassUnit, language: AppState['language']): BestSetParts {
  const isWeighted = set.setType !== 'bodyweight' && set.setType !== 'cardio' && set.weight > 0;
  if (!isWeighted) {
    return { isWeighted: false, weightValue: '', weightUnit: '', repsValue: set.reps };
  }

  const formatted = formatWeight(set.weight, massUnit, language ?? 'en');
  const { weightValue, weightUnit } = splitWeightLabel(formatted);
  return { isWeighted: true, weightValue, weightUnit, repsValue: set.reps };
}

function pickBestSetByOneRm(
  sets: SetEntry[]
): { set: SetEntry; est1Rm: number } | null {
  if (!sets?.length) return null;

  return sets.reduce<{ set: SetEntry; est1Rm: number } | null>((best, current) => {
    if (current.setType === 'cardio') return best;
    const currentEst = estimateOneRm(current.weight, current.reps);
    if (!best) return { set: current, est1Rm: currentEst };

    if (currentEst > best.est1Rm) return { set: current, est1Rm: currentEst };
    if (currentEst < best.est1Rm) return best;

    if (current.weight > best.set.weight) return { set: current, est1Rm: currentEst };
    if (current.weight < best.set.weight) return best;
    if (current.reps > best.set.reps) return { set: current, est1Rm: currentEst };
    if (current.reps < best.set.reps) return best;

    return current.createdAt > best.set.createdAt ? { set: current, est1Rm: currentEst } : best;
  }, null);
}

function formatSetDateLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return formatDate(date);
}

function labelForBlock(block: TrainingBlock, language: AppState['language']): string {
  const lang = language ?? 'en';
  const id = block.id as TrainingBlockId;
  if (['chest', 'shoulders', 'back', 'arms', 'core', 'legs', 'bodyweight'].includes(id)) {
    return blockLabel(id, lang);
  }
  return block.name;
}

const RepMaxScreenContent: React.FC<Props> = ({ appState, onBack }) => {
  const language = appState.language ?? 'en';
  const massUnit = appState.massUnit ?? 'kg';
  const [collapsedBlocks, setCollapsedBlocks] = useState<Set<string>>(new Set());

  const sections: RepMaxSection[] = useMemo(() => {
    const res: RepMaxSection[] = [];
    // Build a single best-set summary per exercise based on max estimated 1RM.
    for (const block of appState.blocks.filter((b) => b.id !== 'cardio') as TrainingBlock[]) {
      const exercisesForBlock = appState.exercises.filter((ex) => ex.blockId === block.id);
      const items: RepMaxItem[] = [];

      for (const ex of exercisesForBlock as Exercise[]) {
        const sets = getSetsForExercise(appState, ex.id);
        const best = pickBestSetByOneRm(sets);
        if (!best) continue;

        const bestSetParts = buildBestSetParts(best.set, massUnit, language);

        items.push({
          id: ex.id,
          exerciseName: formatExerciseLabel(ex),
          blockId: block.id,
          bestSet: best.set,
          bestSetParts,
          bestEst1Rm: best.est1Rm,
          bestSetDateLabel: formatSetDateLabel(best.set.createdAt),
        });
      }

      if (items.length > 0) {
        items.sort(
          (a, b) => b.bestEst1Rm - a.bestEst1Rm || a.exerciseName.localeCompare(b.exerciseName)
        );

        res.push({
          title: labelForBlock(block, language),
          blockId: block.id,
          data: items,
          totalCount: items.length,
          topExerciseId: items[0].id,
        });
      }
    }

    return res;
  }, [appState, language, massUnit]);

  const sectionIds = useMemo(() => sections.map((section) => section.blockId), [sections]);

  useFocusEffect(
    useCallback(() => {
      setCollapsedBlocks(new Set(sectionIds));
    }, [sectionIds])
  );

  useEffect(() => {
    setCollapsedBlocks((prev) => {
      if (sectionIds.length === 0) return new Set();
      const next = new Set<string>();
      for (const id of prev) {
        if (sectionIds.includes(id)) next.add(id);
      }
      return next;
    });
  }, [sectionIds]);

  const toggleBlock = (blockId: string) => {
    setCollapsedBlocks((prev) => {
      const next = new Set(prev);
      if (next.has(blockId)) {
        next.delete(blockId);
      } else {
        next.add(blockId);
      }
      return next;
    });
  };

  const visibleSections = sections.map((section) =>
    collapsedBlocks.has(section.blockId) ? { ...section, data: [] } : section
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <TouchableOpacity onPress={onBack} hitSlop={12} style={styles.backButton} activeOpacity={0.8}>
          <Text style={styles.back}>{t(language, 'back')}</Text>
        </TouchableOpacity>

        <Text style={styles.title}>{t(language, 'repmax.title')}</Text>
        <Text style={styles.subtitle}>{t(language, 'repmax.subtitle')}</Text>
      </View>

      {sections.length === 0 ? (
        <Text style={[styles.emptyText, styles.content]}>{t(language, 'repmax.noLifts')}</Text>
      ) : (
        <SectionList
          sections={visibleSections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderSectionHeader={({
            section,
          }: {
            section: SectionListData<RepMaxItem, RepMaxSection>;
          }) => {
            const tone = getBlockTone(section.blockId);
            const isCollapsed = collapsedBlocks.has(section.blockId);
            return (
              <TouchableOpacity
                style={styles.sectionHeader}
                activeOpacity={0.8}
                hitSlop={8}
                onPress={() => toggleBlock(section.blockId)}
              >
                <View style={styles.sectionTitleRow}>
                  <View style={[styles.sectionAccent, { backgroundColor: tone.accent }]} />
                  <Text style={styles.sectionTitle}>{section.title}</Text>
                </View>
                <View style={styles.sectionMeta}>
                  <Text style={styles.sectionCount}>
                    {t(language, 'repmax.liftsCount', { count: section.totalCount })}
                  </Text>
                  <Text style={styles.sectionChevron}>{isCollapsed ? '>' : 'v'}</Text>
                </View>
              </TouchableOpacity>
            );
          }}
          renderItem={({ item, section }) => {
            const isGroupTop = section.topExerciseId === item.id;
            const parts = item.bestSetParts;
            return (
              <View style={[styles.card, isGroupTop ? styles.cardTop : null]}>
                <View style={[styles.cardAccent, isGroupTop ? styles.cardAccentTop : null]} />
                <View style={styles.cardBody}>
                  <View style={styles.cardHeaderRow}>
                    <Text style={styles.exerciseName} numberOfLines={1} ellipsizeMode="tail">
                      {item.exerciseName}
                    </Text>
                    <Text style={[styles.star, isGroupTop ? styles.starTop : null]}>⭐</Text>
                  </View>
                  <Text style={styles.bestSet} numberOfLines={1}>
                    {parts.isWeighted ? (
                      <>
                        <Text style={isGroupTop ? styles.bestSetValueTop : styles.bestSetValue}>
                          {parts.weightValue}
                        </Text>
                        {parts.weightUnit ? <Text style={styles.bestSetUnit}> {parts.weightUnit}</Text> : null}
                        <Text style={styles.bestSetDivider}> × </Text>
                        <Text style={isGroupTop ? styles.bestSetValueTop : styles.bestSetValue}>
                          {parts.repsValue}
                        </Text>
                        <Text style={styles.bestSetUnit}> {t(language, 'repmax.reps')}</Text>
                      </>
                    ) : (
                      <>
                        <Text style={isGroupTop ? styles.bestSetValueTop : styles.bestSetValue}>{parts.repsValue}</Text>
                        <Text style={styles.bestSetUnit}> {t(language, 'repmax.reps')}</Text>
                      </>
                    )}
                  </Text>
                  <Text style={styles.est1rm}>
                    {t(language, 'repmax.est1rm')}: {formatWeight(item.bestEst1Rm, massUnit, language)}
                  </Text>
                  <Text style={styles.setOn}>
                    {t(language, 'repmax.setOn')}: {item.bestSetDateLabel}
                  </Text>
                </View>
              </View>
            );
          }}
          ItemSeparatorComponent={() => <View style={styles.itemSpacer} />}
          stickySectionHeadersEnabled={false}
        />
      )}
    </SafeAreaView>
  );
};

export const RepMaxScreen: React.FC<Props> = (props) => {
  const navigation = useContext(NavigationContext);
  if (navigation) {
    return <RepMaxScreenContent {...props} />;
  }
  return (
    <NavigationContext.Provider value={fallbackNavigation as any}>
      <RepMaxScreenContent {...props} />
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
  backButton: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  back: {
    color: '#93C5FD',
    fontSize: TEXT.sm,
    fontWeight: '600',
  },
  title: {
    fontSize: TEXT.xl,
    fontWeight: '800',
    color: '#F9FAFB',
    marginTop: SPACING.xs,
  },
  subtitle: {
    marginTop: SPACING.xs,
    color: '#9CA3AF',
    fontSize: TEXT.sm,
  },
  emptyText: {
    marginTop: SPACING.lg,
    color: '#9CA3AF',
    fontSize: TEXT.sm,
  },
  listContent: {
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xxxl,
    paddingHorizontal: SCREEN_PADDING,
  },
  sectionHeader: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#111827',
    backgroundColor: '#0B1220',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: COLORS.blue2,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  sectionAccent: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  sectionTitle: {
    color: '#F9FAFB',
    fontSize: TEXT.sm,
    fontWeight: '700',
  },
  sectionMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  sectionCount: {
    color: '#94A3B8',
    fontSize: TEXT.xs,
    fontWeight: '700',
  },
  sectionChevron: {
    color: '#94A3B8',
    fontSize: TEXT.sm,
    fontWeight: '700',
  },
  card: {
    flexDirection: 'row',
    gap: SPACING.md,
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#111827',
    backgroundColor: '#0B1220',
    shadowColor: COLORS.blue2,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardTop: {
    borderColor: 'rgba(251, 191, 36, 0.35)',
    shadowColor: '#FBBF24',
    shadowOpacity: 0.14,
  },
  cardAccent: {
    width: 3,
    borderRadius: 999,
    backgroundColor: COLORS.blue2,
    alignSelf: 'stretch',
  },
  cardAccentTop: {
    backgroundColor: '#FBBF24',
  },
  cardBody: {
    flex: 1,
    gap: SPACING.sm,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  exerciseName: {
    color: '#CBD5F5',
    fontSize: TEXT.md,
    fontWeight: '600',
  },
  star: {
    color: 'rgba(251, 191, 36, 0.55)',
    fontSize: TEXT.sm,
  },
  starTop: {
    color: '#FBBF24',
  },
  bestSet: {
    color: '#F9FAFB',
    fontSize: TEXT.xl,
    fontWeight: '800',
  },
  bestSetValue: {
    color: '#F9FAFB',
  },
  bestSetValueTop: {
    color: '#FBBF24',
  },
  bestSetUnit: {
    color: '#94A3B8',
    fontSize: TEXT.md,
    fontWeight: '600',
  },
  bestSetDivider: {
    color: '#94A3B8',
    fontWeight: '700',
  },
  est1rm: {
    color: '#E2E8F0',
    fontSize: TEXT.sm,
    fontWeight: '700',
  },
  setOn: {
    color: '#64748B',
    fontSize: TEXT.xs,
    fontWeight: '600',
  },
  itemSpacer: {
    height: SPACING.sm,
  },
});
