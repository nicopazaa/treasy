import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  SectionListData,
} from 'react-native';
import { AppState } from '../types';
import {
  getWorkoutDates,
  getDailyWorkout,
  DailySetView,
} from '../services/workoutService';

interface Props {
  appState: AppState;
  onBack: () => void;
}

interface HistorySection {
  title: string; // f.eks. "fre. 05.12.2025"
  rawKey: string;
  data: DailySetView[];
}

export const HistoryScreen: React.FC<Props> = ({ appState, onBack }) => {
  const sections: HistorySection[] = useMemo(() => {
    const dates = getWorkoutDates(appState);

    return dates.map((key) => {
      const items = getDailyWorkout(appState, key);
      const d = new Date(`${key}T00:00:00`);
      const label = d.toLocaleDateString('nb-NO', {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });

      return {
        title: label,
        rawKey: key,
        data: items,
      };
    });
  }, [appState]);

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.back}>{'< Tilbake'}</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Tidligere økter</Text>
      <Text style={styles.subtitle}>
        Bla i treningsdagboken din. Hver dato viser alle øvelser og sett du logget den dagen.
      </Text>

      {sections.length === 0 ? (
        <Text style={styles.emptyText}>
          Du har ikke logget noen økter enda. Logg noen sett først.
        </Text>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderSectionHeader={({
            section,
          }: {
            section: SectionListData<DailySetView, HistorySection>;
          }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.exercise}>
                  {item.exerciseName}
                  {item.blockName ? ` (${item.blockName})` : ''}
                </Text>
                <Text style={styles.detail}>
                  {item.weight} kg x {item.reps} reps
                </Text>
              </View>
              <Text style={styles.time}>{item.time}</Text>
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
  time: {
    color: '#9CA3AF',
    fontSize: 13,
    marginLeft: 8,
  },
  separator: {
    height: 1,
    backgroundColor: '#111827',
  },
});
