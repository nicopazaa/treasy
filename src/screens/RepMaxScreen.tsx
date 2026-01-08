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
import { SPACING, TEXT, SCREEN_PADDING } from '../shared/theme/tokens';
import { blockLabel, t } from '../shared/i18n/i18n';
import { formatExerciseLabel } from '../shared/utils/exerciseLabel';
import { COLORS } from '../shared/theme/tokens';
import { formatWeight } from '../shared/utils/units';

interface Props {
  appState: AppState;
  onBack: () => void;
}

interface RepMaxItem {
  id: string; // exercise id
  exerciseName: string;
  blockId: string;
  bestText: string;
}

interface RepMaxSection {
  title: string;
  blockId: string;
  data: RepMaxItem[];
}

const fallbackNavigation = {
  addListener: () => () => {},
  isFocused: () => true,
};

function pickBestSet(sets: SetEntry[]): SetEntry | null {
  if (!sets?.length) return null;
  return sets.reduce<SetEntry | null>((best, current) => {
    if (!best) return current;
    const bestWeighted = best.setType !== 'bodyweight' && best.setType !== 'cardio' && best.weight > 0;
    const currentWeighted =
      current.setType !== 'bodyweight' && current.setType !== 'cardio' && current.weight > 0;

    if (bestWeighted && currentWeighted) {
      if (current.weight > best.weight) return current;
      if (current.weight < best.weight) return best;
      if (current.reps > best.reps) return current;
      if (current.reps < best.reps) return best;
      return current.createdAt > best.createdAt ? current : best;
    }

    if (bestWeighted) return best;
    if (currentWeighted) return current;

    if (current.reps > best.reps) return current;
    if (current.reps < best.reps) return best;
    return current.createdAt > best.createdAt ? current : best;
  }, null);
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

    for (const block of appState.blocks.filter((b) => b.id !== 'cardio') as TrainingBlock[]) {
      const exercisesForBlock = appState.exercises.filter((ex) => ex.blockId === block.id);
      const items: RepMaxItem[] = [];

      for (const ex of exercisesForBlock as Exercise[]) {
        const sets = getSetsForExercise(appState, ex.id);
        const best = pickBestSet(sets);
        if (!best) continue;

        const isWeighted = best.setType !== 'bodyweight' && best.setType !== 'cardio' && best.weight > 0;
        const bestText = isWeighted ? formatWeight(best.weight, massUnit, language) : `${best.reps} reps`;
        items.push({
          id: ex.id,
          exerciseName: formatExerciseLabel(ex),
          blockId: block.id,
          bestText,
        });
      }

      if (items.length > 0) {
        items.sort((a, b) => a.exerciseName.localeCompare(b.exerciseName));

        res.push({
          title: labelForBlock(block, language),
          blockId: block.id,
          data: items,
        });
      }
    }

    return res;
  }, [appState, language]);

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

        <View style={styles.titleRow}>
          <Text style={styles.badge}>🌟</Text>
          <Text style={styles.title}>{t(language, 'repMaxTitleScreen')}</Text>
          <Text style={styles.clip}>📎</Text>
        </View>
        <Text style={styles.subtitle}>{t(language, 'repMaxSubtitleScreen')}</Text>
      </View>

      {sections.length === 0 ? (
        <Text style={[styles.emptyText, styles.content]}>{t(language, 'noRepMaxYet')}</Text>
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
                onPress={() => toggleBlock(section.blockId)}
              >
                <Text style={[styles.sectionTitle, { color: tone.accent }]}>{section.title}</Text>
                <Text style={styles.chevron}>{isCollapsed ? '>' : 'v'}</Text>
              </TouchableOpacity>
            );
          }}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <View style={styles.rowHeader}>
                  <Text style={styles.exercise} numberOfLines={1} ellipsizeMode="tail">
                    {item.exerciseName}
                  </Text>
                  <Text style={styles.bestIcon}>🌟</Text>
                </View>
                <Text style={styles.detail}>{item.bestText}</Text>
              </View>
            </View>
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
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
  badge: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F9FAFB',
    marginTop: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  clip: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F9FAFB',
    marginTop: 2,
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
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xxl,
    paddingHorizontal: SCREEN_PADDING,
  },
  sectionHeader: {
    paddingVertical: SPACING.xs,
    marginTop: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: '#F9FAFB',
    fontSize: TEXT.sm,
    fontWeight: '700',
  },
  chevron: {
    color: '#9CA3AF',
    fontSize: TEXT.sm,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  bestIcon: {
    fontSize: TEXT.sm,
    color: '#9CA3AF',
    opacity: 0.8,
  },
  exercise: {
    color: '#E5E7EB',
    fontSize: TEXT.md,
    fontWeight: '700',
  },
  detail: {
    color: '#9CA3AF',
    fontSize: TEXT.xs,
  },
  separator: {
    height: 1,
    backgroundColor: '#111827',
  },
});
