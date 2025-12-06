import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { Exercise, SetEntry } from '../types';
import { LabeledInput } from '../components/LabeledInput';
import { PrimaryButton } from '../components/PrimaryButton';

interface Props {
  exercise: Exercise;
  sets: SetEntry[];
  onBack: () => void;
  onAddSet: (weight: number, reps: number) => void;
  onAskAIForExercise: () => void;
}

export const ExerciseScreen: React.FC<Props> = ({
  exercise,
  sets,
  onBack,
  onAddSet,
  onAskAIForExercise,
}) => {
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');

  const handleAdd = () => {
    const w = Number(weight.replace(',', '.'));
    const r = Number(reps);
    if (!Number.isFinite(w) || !Number.isFinite(r) || w <= 0 || r <= 0) {
      return;
    }
    onAddSet(w, r);
    setWeight('');
    setReps('');
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.back}>{'< Tilbake'}</Text>
      </TouchableOpacity>
      <Text style={styles.title}>{exercise.name}</Text>
      <Text style={styles.subtitle}>Logg sett og se historikk for denne øvelsen.</Text>

      <View style={{ marginTop: 16 }}>
        <LabeledInput
          label="Vekt (kg)"
          placeholder="F.eks. 80"
          keyboardType="numeric"
          value={weight}
          onChangeText={setWeight}
        />
        <LabeledInput
          label="Reps"
          placeholder="F.eks. 5"
          keyboardType="numeric"
          value={reps}
          onChangeText={setReps}
        />
        <PrimaryButton title="Legg til sett" onPress={handleAdd} />
      </View>

      <View style={styles.aiBox}>
        <Text style={styles.aiTitle}>Treasy AI for {exercise.name}</Text>
        <Text style={styles.aiText}>Få raskt svar på hva du tok sist i denne øvelsen.</Text>
        <PrimaryButton title="Spør AI for denne øvelsen" onPress={onAskAIForExercise} />
      </View>

      <Text style={styles.historyTitle}>Historikk</Text>
      <FlatList
        data={sets}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.setRow}>
            <Text style={styles.setText}>
              {item.weight} kg x {item.reps} reps
            </Text>
            <Text style={styles.setDate}>{new Date(item.createdAt).toLocaleString()}</Text>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>Ingen sett logget enda. Legg til ditt første sett.</Text>
        }
      />
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
  aiBox: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#0F172A',
    borderRadius: 8,
  },
  aiTitle: {
    color: '#F9FAFB',
    fontWeight: '600',
    marginBottom: 4,
  },
  aiText: {
    color: '#9CA3AF',
    marginBottom: 8,
  },
  historyTitle: {
    marginTop: 20,
    marginBottom: 6,
    color: '#E5E7EB',
    fontSize: 16,
    fontWeight: '600',
  },
  setRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#111827',
  },
  setText: {
    color: '#E5E7EB',
  },
  setDate: {
    color: '#6B7280',
    fontSize: 12,
  },
  empty: {
    color: '#6B7280',
    marginTop: 8,
  },
});