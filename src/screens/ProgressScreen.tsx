import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { AppState, TrainingBlock, Exercise, SetEntry } from '../types';

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
  return Math.round(est * 10) / 10; // én desimal
}

export const ProgressScreen: React.FC<Props> = ({ appState, onBack }) => {
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(
    appState.blocks[0]?.id ?? null
  );
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(
    null
  );

  const blocks = appState.blocks as TrainingBlock[];

  const exercises = useMemo(() => {
    if (!selectedBlockId) return [] as Exercise[];
    return appState.exercises.filter(
      (e) => e.blockId === selectedBlockId
    ) as Exercise[];
  }, [appState.exercises, selectedBlockId]);

  const progressRows: ProgressRow[] = useMemo(() => {
    if (!selectedExerciseId) return [];

    const setsForExercise = appState.sets
      .filter((s) => s.exerciseId === selectedExerciseId)
      .sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1)) as SetEntry[];

    return setsForExercise.map((s) => {
      const d = new Date(s.createdAt);
      const dateLabel = d.toLocaleDateString('nb-NO', {
        day: '2-digit',
        month: '2-digit',
      });
      const timeLabel = d.toLocaleTimeString('nb-NO', {
        hour: '2-digit',
        minute: '2-digit',
      });

      return {
        id: s.id,
        dateLabel: `${dateLabel}. ${timeLabel}`,
        weight: s.weight,
        reps: s.reps,
        oneRm: estimateOneRm(s.weight, s.reps),
      };
    });
  }, [appState.sets, selectedExerciseId]);

  const selectedExercise =
    selectedExerciseId &&
    appState.exercises.find((e) => e.id === selectedExerciseId);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
    >
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.back}>{'< Tilbake'}</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Progressive overload</Text>
      <Text style={styles.subtitle}>
        Velg muskelgruppe og øvelse for å se utviklingen din over tid.
      </Text>

      {/* Muskelgrupper */}
      <Text style={styles.sectionLabel}>Muskelgrupper</Text>
      <View style={styles.pillRow}>
        {blocks.map((block) => {
          const selected = block.id === selectedBlockId;
          return (
            <TouchableOpacity
              key={block.id}
              style={[
                styles.pill,
                selected && styles.pillSelected,
              ]}
              onPress={() => {
                setSelectedBlockId(block.id);
                setSelectedExerciseId(null);
              }}
            >
              <Text
                style={[
                  styles.pillText,
                  selected && styles.pillTextSelected,
                ]}
              >
                {block.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Øvelser */}
      <Text style={[styles.sectionLabel, { marginTop: 24 }]}>Øvelser</Text>
      {exercises.length === 0 ? (
        <Text style={styles.emptyText}>
          Ingen øvelser i denne blokken enda. Legg til øvelser først.
        </Text>
      ) : (
        <View style={styles.pillRow}>
          {exercises.map((ex) => {
            const selected = ex.id === selectedExerciseId;
            return (
              <TouchableOpacity
                key={ex.id}
                style={[
                  styles.pill,
                  selected && styles.pillSelected,
                ]}
                onPress={() => setSelectedExerciseId(ex.id)}
              >
                <Text
                  style={[
                    styles.pillText,
                    selected && styles.pillTextSelected,
                  ]}
                >
                  {ex.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* Utvikling / tabell */}
      <View style={styles.progressCard}>
        <Text style={styles.progressTitle}>Utvikling</Text>
        {selectedExercise && progressRows.length > 0 ? (
          <>
            <Text style={styles.progressSubtitle}>
              {selectedExercise.name}
            </Text>
            <View style={styles.table}>
              <View style={[styles.row, styles.headerRow]}>
                <Text style={[styles.cell, styles.cellDate]}>Dato</Text>
                <Text style={[styles.cell, styles.cellWeight]}>Vekt</Text>
                <Text style={[styles.cell, styles.cellReps]}>Reps</Text>
                <Text style={[styles.cell, styles.cellOneRm]}>
                  1RM (est)
                </Text>
              </View>
              {progressRows.map((r) => (
                <View key={r.id} style={styles.row}>
                  <Text style={[styles.cell, styles.cellDate]}>
                    {r.dateLabel}
                  </Text>
                  <Text style={[styles.cell, styles.cellWeight]}>
                    {r.weight} kg
                  </Text>
                  <Text style={[styles.cell, styles.cellReps]}>
                    {r.reps}
                  </Text>
                  <Text style={[styles.cell, styles.cellOneRm]}>
                    {r.oneRm} kg
                  </Text>
                </View>
              ))}
            </View>
          </>
        ) : (
          <Text style={styles.emptyText}>
            Velg en øvelse for å se loggen din. Når du har logget sett, vil
            utviklingen vises her.
          </Text>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 32,
  },
  back: {
    color: '#93C5FD',
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#F9FAFB',
  },
  subtitle: {
    marginTop: 4,
    color: '#9CA3AF',
  },
  sectionLabel: {
    marginTop: 20,
    marginBottom: 8,
    color: '#F9FAFB',
    fontSize: 16,
    fontWeight: '600',
  },
  pillRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  pill: {
    flex: 1,
    marginHorizontal: 4,
    minHeight: 110,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#1F2937',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  pillSelected: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  pillText: {
    color: '#E5E7EB',
    fontSize: 14,
  },
  pillTextSelected: {
    color: '#F9FAFB',
    fontWeight: '600',
  },
  emptyText: {
    color: '#6B7280',
    fontSize: 13,
  },
  progressCard: {
    marginTop: 28,
    backgroundColor: '#020617',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: 14,
  },
  progressTitle: {
    color: '#F9FAFB',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  progressSubtitle: {
    color: '#9CA3AF',
    marginBottom: 8,
  },
  table: {
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#1F2937',
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#111827',
  },
  headerRow: {
    backgroundColor: '#020617',
  },
  cell: {
    fontSize: 12,
    color: '#E5E7EB',
  },
  cellDate: {
    flex: 2.2,
  },
  cellWeight: {
    flex: 1.2,
  },
  cellReps: {
    flex: 1,
  },
  cellOneRm: {
    flex: 1.4,
    textAlign: 'right',
  },
});
