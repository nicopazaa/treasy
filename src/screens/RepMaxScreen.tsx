import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  SectionListData,
} from 'react-native';
import { AppState, TrainingBlock, Exercise } from '../types';
import { getSetsForExercise } from '../services/workoutService';
import { SetEntry } from '../types';

interface Props {
  appState: AppState;
  onBack: () => void;
}

interface RepMaxItem {
  id: string; // exercise id
  exerciseName: string;
  blockName?: string;
  weight: number;
  reps: number;
  date: string;
  time: string;
}

interface RepMaxSection {
  title: string; // block name
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
    // samme vekt og reps -> velg nyeste
    return current.createdAt > best.createdAt ? current : best;
  }, null);
}

export const RepMaxScreen: React.FC<Props> = ({ appState, onBack }) => {
  const sections: RepMaxSection[] = useMemo(() => {
    const res: RepMaxSection[] = [];

    for (const block of appState.blocks as TrainingBlock[]) {
      const exercisesForBlock = appState.exercises.filter(
        (ex) => ex.blockId === block.id
      );

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
          blockName: block.name,
          weight: best.weight,
          reps: best.reps,
          date,
          time,
        });
      }

      if (items.length > 0) {
        // sortér innen blokken: tyngst først, så flest reps
        items.sort((a, b) => {
          if (a.weight !== b.weight) return b.weight - a.weight;
          if (a.reps !== b.reps) return b.reps - a.reps;
          return a.exerciseName.localeCompare(b.exerciseName);
        });

        res.push({
          title: block.name,
          data: items,
        });
      }
    }

    return res;
  }, [appState]);

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.back}>{'< Tilbake'}</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Rep for max</Text>
      <Text style={styles.subtitle}>
        For hver øvelse ser du høyeste vekt du har logget, og hvor mange reps du tok.
      </Text>

      {sections.length === 0 ? (
        <Text style={styles.emptyText}>
          Du har ikke logget noen sett enda. Logg økter først, så dukker max-løftene dine opp her.
        </Text>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderSectionHeader={({
            section,
          }: {
            section: SectionListData<RepMaxItem, RepMaxSection>;
          }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.exercise}>{item.exerciseName}</Text>
                <Text style={styles.detail}>
                  {item.weight} kg x {item.reps} reps
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
    paddingHorizontal: 20,
    paddingTop: 60,
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
  emptyText: {
    marginTop: 16,
    color: '#6B7280',
  },
  listContent: {
    paddingTop: 16,
    paddingBottom: 24,
  },
  sectionHeader: {
    paddingVertical: 4,
    marginTop: 12,
  },
  sectionTitle: {
    color: '#F9FAFB',
    fontSize: 15,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  exercise: {
    color: '#E5E7EB',
    fontSize: 15,
    fontWeight: '500',
  },
  detail: {
    color: '#9CA3AF',
    fontSize: 13,
  },
  date: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  time: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  separator: {
    height: 1,
    backgroundColor: '#111827',
  },
});
