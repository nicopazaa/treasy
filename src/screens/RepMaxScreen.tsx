import React, { useMemo } from 'react';
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
import { AppState, TrainingBlock, Exercise, SetEntry, TrainingBlockId } from '../features/workouts/model/types';
import { getSetsForExercise } from '../features/workouts/model/workoutService';
import { getBlockTone } from '../shared/theme/blockTone';
import { SPACING, TEXT, SCREEN_PADDING } from '../shared/theme/tokens';
import { blockLabel, t } from '../shared/i18n/i18n';

interface Props {
  appState: AppState;
  onBack: () => void;
}

interface RepMaxItem {
  id: string; // exercise id
  exerciseName: string;
  blockId: string;
  weight: number;
  reps: number;
  oneRm: number;
  date: string;
  time: string;
}

interface RepMaxSection {
  title: string;
  blockId: string;
  data: RepMaxItem[];
}

function pickBestSet(sets: SetEntry[]): SetEntry | null {
  if (sets.length === 0) return null;
  return sets.reduce<SetEntry | null>((best, current) => {
    if (!best) return current;
    if (current.weight > best.weight) return current;
    if (current.weight < best.weight) return best;
    if (current.reps > best.reps) return current;
    if (current.reps < best.reps) return best;
    return current.createdAt > best.createdAt ? current : best;
  }, null);
}

function estimateOneRm(weight: number, reps: number): number {
  if (reps <= 1) return weight;
  const est = weight * (1 + reps / 30);
  return Math.round(est * 10) / 10;
}

function labelForBlock(block: TrainingBlock, language: AppState['language']): string {
  const lang = language ?? 'en';
  const id = block.id as TrainingBlockId;
  if (['chest', 'shoulders', 'back', 'arms', 'core', 'legs'].includes(id)) {
    return blockLabel(id, lang);
  }
  return block.name;
}

export const RepMaxScreen: React.FC<Props> = ({ appState, onBack }) => {
  const language = appState.language ?? 'en';

  const sections: RepMaxSection[] = useMemo(() => {
    const res: RepMaxSection[] = [];

    for (const block of appState.blocks.filter((b) => b.id !== 'cardio') as TrainingBlock[]) {
      const exercisesForBlock = appState.exercises.filter((ex) => ex.blockId === block.id);
      const items: RepMaxItem[] = [];

      for (const ex of exercisesForBlock as Exercise[]) {
        const sets = getSetsForExercise(appState, ex.id);
        const best = pickBestSet(sets);
        if (!best) continue;

        const dt = new Date(best.createdAt);
        const date = dt.toLocaleDateString('nb-NO', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });
        const time = dt.toLocaleTimeString('nb-NO', {
          hour: '2-digit',
          minute: '2-digit',
        });

        items.push({
          id: ex.id,
          exerciseName: ex.name,
          blockId: block.id,
          weight: best.weight,
          reps: best.reps,
          oneRm: estimateOneRm(best.weight, best.reps),
          date,
          time,
        });
      }

      if (items.length > 0) {
        items.sort((a, b) => {
          if (a.weight !== b.weight) return b.weight - a.weight;
          if (a.reps !== b.reps) return b.reps - a.reps;
          return a.exerciseName.localeCompare(b.exerciseName);
        });

        res.push({
          title: labelForBlock(block, language),
          blockId: block.id,
          data: items,
        });
      }
    }

    return res;
  }, [appState, language]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <TouchableOpacity onPress={onBack} hitSlop={12} style={styles.backButton} activeOpacity={0.8}>
          <Text style={styles.back}>{t(language, 'back')}</Text>
        </TouchableOpacity>

        <Text style={styles.title}>{t(language, 'repMaxTitleScreen')}</Text>
        <Text style={styles.subtitle}>{t(language, 'repMaxSubtitleScreen')}</Text>
      </View>

      {sections.length === 0 ? (
        <Text style={[styles.emptyText, styles.content]}>{t(language, 'noRepMaxYet')}</Text>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderSectionHeader={({
            section,
          }: {
            section: SectionListData<RepMaxItem, RepMaxSection>;
          }) => {
            const tone = getBlockTone(section.blockId);
            return (
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: tone.accent }]}>{section.title}</Text>
              </View>
            );
          }}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.exercise}>{item.exerciseName}</Text>
                <Text style={styles.detail}>
                  {item.weight} kg x {item.reps} {t(language, 'reps').toLowerCase()}
                </Text>
                <Text style={styles.estimate}>
                  {t(language, 'oneRmEst')}: {item.oneRm} kg
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.date}>{item.date}</Text>
                <Text style={styles.time}>{item.time}</Text>
              </View>
            </View>
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </SafeAreaView>
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
    fontWeight: '700',
    color: '#F9FAFB',
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
  },
  sectionTitle: {
    color: '#F9FAFB',
    fontSize: TEXT.sm,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
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
  estimate: {
    color: '#9CA3AF',
    fontSize: TEXT.xs,
    marginTop: SPACING.xs,
  },
  date: {
    color: '#9CA3AF',
    fontSize: TEXT.xs,
  },
  time: {
    color: '#9CA3AF',
    fontSize: TEXT.xs,
  },
  separator: {
    height: 1,
    backgroundColor: '#111827',
  },
});
