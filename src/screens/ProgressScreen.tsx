import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView, Platform } from 'react-native';
import { AppLanguage } from '../shared/types';
import { AppState, TrainingBlock, Exercise, SetEntry, TrainingBlockId } from '../features/workouts/model/types';
import { getBlockTone } from '../shared/theme/blockTone';
import { formatRelativeDateTime } from '../shared/utils/dateLabels';
import { SPACING, TEXT, RADIUS } from '../shared/theme/tokens';
import { blockLabel, t } from '../shared/i18n/i18n';

interface Props {
  appState: AppState;
  onBack: () => void;
}

interface ProgressRow {
  id: string;
  dateLabel: string;
  weight: number;
  reps: number;
  oneRm: number;
}

function estimateOneRm(weight: number, reps: number): number {
  if (reps <= 1) return weight;
  const est = weight * (1 + reps / 30);
  return Math.round(est * 10) / 10;
}

function labelForBlock(block: TrainingBlock, language: AppLanguage): string {
  const id = block.id as TrainingBlockId;
  if (['chest', 'shoulders', 'back', 'arms', 'core', 'legs'].includes(id)) {
    return blockLabel(id, language);
  }
  return block.name;
}

export const ProgressScreen: React.FC<Props> = ({ appState, onBack }) => {
  const language = appState.language ?? 'en';
  const initialBlockId = appState.blocks.find((b) => b.id !== 'cardio')?.id ?? null;
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(initialBlockId);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);

  const blocks = appState.blocks.filter((b) => b.id !== 'cardio') as TrainingBlock[];
  const selectedBlockTone = getBlockTone(selectedBlockId ?? '');

  const exercises = useMemo(() => {
    if (!selectedBlockId) return [] as Exercise[];
    return appState.exercises.filter((e) => e.blockId === selectedBlockId) as Exercise[];
  }, [appState.exercises, selectedBlockId]);

  const progressRows: ProgressRow[] = useMemo(() => {
    if (!selectedExerciseId) return [];

    const setsForExercise = appState.sets
      .filter((s) => s.exerciseId === selectedExerciseId)
      .sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1)) as SetEntry[];

    return setsForExercise.map((s) => {
      const dateLabel = formatRelativeDateTime(new Date(s.createdAt), new Date(), language);
      return {
        id: s.id,
        dateLabel,
        weight: s.weight,
        reps: s.reps,
        oneRm: estimateOneRm(s.weight, s.reps),
      };
    });
  }, [appState.sets, language, selectedExerciseId]);

  const chartMax = progressRows.reduce((max, row) => Math.max(max, row.weight), 0);

  const selectedExercise =
    selectedExerciseId && appState.exercises.find((e) => e.id === selectedExerciseId);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      <TouchableOpacity onPress={onBack} hitSlop={12} style={styles.backButton} activeOpacity={0.8}>
        <Text style={styles.back}>{t(language, 'back')}</Text>
      </TouchableOpacity>

      <Text style={styles.title}>{t(language, 'progressScreenTitle')}</Text>
      <Text style={styles.subtitle}>{t(language, 'progressScreenSubtitle')}</Text>

      <Text style={styles.sectionLabel}>{t(language, 'muscleGroups')}</Text>
      <View style={styles.pillRow}>
        {blocks.map((block) => {
          const selected = block.id === selectedBlockId;
          const tone = getBlockTone(block.id);
          return (
            <TouchableOpacity
              key={block.id}
              style={[
                styles.pill,
                {
                  borderColor: selected ? tone.accent : '#1F2937',
                  backgroundColor: selected ? tone.soft : '#0B1220',
                },
              ]}
              onPress={() => {
                setSelectedBlockId(block.id);
                setSelectedExerciseId(null);
              }}
              activeOpacity={0.9}
            >
              <View style={[styles.pillDot, { backgroundColor: tone.accent }]} />
              <Text style={[styles.pillText, selected && styles.pillTextSelected]}>
                {labelForBlock(block, language)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={[styles.sectionLabel, { marginTop: SPACING.xl }]}>{t(language, 'exercises')}</Text>
      {exercises.length === 0 ? (
        <Text style={styles.emptyText}>{t(language, 'noExercisesInBlock')}</Text>
      ) : (
        <View style={styles.pillRow}>
          {exercises.map((ex) => {
            const selected = ex.id === selectedExerciseId;
            return (
              <TouchableOpacity
                key={ex.id}
                style={[
                  styles.pill,
                  {
                    borderColor: selected ? selectedBlockTone.accent : '#1F2937',
                    backgroundColor: selected ? selectedBlockTone.soft : '#0B1220',
                  },
                ]}
                onPress={() => setSelectedExerciseId(ex.id)}
                activeOpacity={0.9}
              >
                <View style={[styles.pillDot, { backgroundColor: selectedBlockTone.accent }]} />
                <Text style={[styles.pillText, selected && styles.pillTextSelected]} numberOfLines={1}>
                  {ex.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <View style={styles.progressCard}>
        <Text style={styles.progressTitle}>{t(language, 'development')}</Text>
        {selectedExercise && progressRows.length > 0 ? (
          <>
            <Text style={[styles.progressSubtitle, { color: selectedBlockTone.accent }]}>
              {selectedExercise.name}
            </Text>
            <Text style={styles.chartCaption}>{t(language, 'weightOverTime')}</Text>
            <View style={styles.chart}>
              {progressRows.map((r, index) => {
                const height = chartMax > 0 ? Math.max(6, (r.weight / chartMax) * 120) : 0;
                return (
                  <View
                    key={`${r.id}-bar`}
                    style={[
                      styles.chartBar,
                      {
                        height,
                        backgroundColor: selectedBlockTone.accent,
                        opacity: index === progressRows.length - 1 ? 1 : 0.7,
                      },
                    ]}
                  />
                );
              })}
            </View>
            <View style={styles.table}>
              <View style={[styles.row, styles.headerRow]}>
                <Text style={[styles.cell, styles.cellDate]}>{t(language, 'date')}</Text>
                <Text style={[styles.cell, styles.cellWeight]}>{t(language, 'weight')}</Text>
                <Text style={[styles.cell, styles.cellReps]}>{t(language, 'reps')}</Text>
                <Text style={[styles.cell, styles.cellOneRm]}>{t(language, 'oneRmEst')}</Text>
              </View>
              {progressRows.map((r) => (
                <View key={r.id} style={styles.row}>
                  <Text style={[styles.cell, styles.cellDate]}>{r.dateLabel}</Text>
                  <Text style={[styles.cell, styles.cellWeight]}>{r.weight} kg</Text>
                  <Text style={[styles.cell, styles.cellReps]}>{r.reps}</Text>
                  <Text style={[styles.cell, styles.cellOneRm]}>{r.oneRm} kg</Text>
                </View>
              ))}
            </View>
          </>
        ) : (
          <Text style={styles.emptyText}>{t(language, 'chooseExerciseToSee')}</Text>
        )}
      </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Platform.OS === 'web' ? SPACING.xxxl : SPACING.xxl,
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
  sectionLabel: {
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
    color: '#F9FAFB',
    fontSize: TEXT.sm,
    fontWeight: '700',
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -SPACING.xs,
  },
  pill: {
    flexBasis: '48%',
    flexGrow: 1,
    margin: SPACING.xs,
    minHeight: 54,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#1F2937',
    backgroundColor: '#0B1220',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    gap: SPACING.md,
  },
  pillDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  pillText: {
    color: '#E5E7EB',
    fontSize: TEXT.sm,
    fontWeight: '700',
    flex: 1,
  },
  pillTextSelected: {
    color: '#F9FAFB',
  },
  emptyText: {
    color: '#9CA3AF',
    fontSize: TEXT.sm,
  },
  progressCard: {
    marginTop: SPACING.xxl,
    backgroundColor: '#020617',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: SPACING.md,
  },
  progressTitle: {
    color: '#F9FAFB',
    fontSize: TEXT.lg,
    fontWeight: '700',
    marginBottom: SPACING.xs,
  },
  progressSubtitle: {
    color: '#9CA3AF',
    marginBottom: SPACING.sm,
    fontSize: TEXT.sm,
    fontWeight: '700',
  },
  chartCaption: {
    color: '#9CA3AF',
    fontSize: TEXT.xs,
    marginBottom: SPACING.xs,
  },
  chart: {
    height: 120,
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: SPACING.md,
    gap: SPACING.xs,
  },
  chartBar: {
    width: 10,
    borderRadius: RADIUS.md,
  },
  table: {
    marginTop: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: '#1F2937',
  },
  row: {
    flexDirection: 'row',
    paddingVertical: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: '#111827',
  },
  headerRow: {
    backgroundColor: '#020617',
  },
  cell: {
    fontSize: TEXT.xs,
    color: '#E5E7EB',
  },
  cellDate: {
    flex: 2.6,
  },
  cellWeight: {
    flex: 1.2,
  },
  cellReps: {
    flex: 0.9,
  },
  cellOneRm: {
    flex: 1.4,
    textAlign: 'right',
  },
});
