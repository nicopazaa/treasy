import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { TrainingBlock, Exercise } from '../types';
import { PrimaryButton } from '../components/PrimaryButton';

interface Props {
  block: TrainingBlock;
  exercises: Exercise[];
  onBack: () => void;
  onSelectExercise: (exerciseId: string) => void;
  onAddExercise: (name: string) => void;
}

export const BlockScreen: React.FC<Props> = ({
  block,
  exercises,
  onBack,
  onSelectExercise,
  onAddExercise,
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newExerciseName, setNewExerciseName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const openAddModal = () => {
    setNewExerciseName('');
    setError(null);
    setIsAdding(true);
  };

  const closeAddModal = () => {
    setIsAdding(false);
    setError(null);
  };

  const handleConfirmAdd = () => {
    const trimmed = newExerciseName.trim();
    if (!trimmed) {
      setError('Skriv inn et navn på øvelsen.');
      return;
    }
    onAddExercise(trimmed);
    setNewExerciseName('');
    setError(null);
    setIsAdding(false);
  };

  const renderExercise = ({ item }: { item: Exercise }) => (
    <TouchableOpacity
      style={styles.exerciseCard}
      onPress={() => onSelectExercise(item.id)}
    >
      <Text style={styles.exerciseTitle}>{item.name}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.back}>{'< Tilbake'}</Text>
      </TouchableOpacity>

      <Text style={styles.title}>{block.name}</Text>
      <Text style={styles.subtitle}>Øvelser i denne blokken</Text>

      <FlatList
        data={exercises}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderExercise}
        style={{ marginTop: 24 }}
        contentContainerStyle={{ paddingBottom: 24 }}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            Ingen øvelser enda. Trykk "Legg til øvelse" for å komme i gang.
          </Text>
        }
      />

      {/* Knapp nederst – ingen input som skjules av tastaturet */}
      <View style={styles.footer}>
        <PrimaryButton title="Legg til øvelse" onPress={openAddModal} />
      </View>

      {/* Modal for å legge til ny øvelse */}
      <Modal
        visible={isAdding}
        animationType="fade"
        transparent
        onRequestClose={closeAddModal}
      >
        <KeyboardAvoidingView
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Legg til ny øvelse</Text>
            <Text style={styles.modalSubtitle}>
              Denne øvelsen blir lagt til i blokken {block.name}.
            </Text>

            <Text style={styles.inputLabel}>Navn på øvelse</Text>
            <TextInput
              style={styles.input}
              placeholder="F.eks. Dumbbell press"
              placeholderTextColor="#4B5563"
              value={newExerciseName}
              onChangeText={setNewExerciseName}
              autoFocus
              autoCapitalize="sentences"
              returnKeyType="done"
              onSubmitEditing={handleConfirmAdd}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.secondaryButton} onPress={closeAddModal}>
                <Text style={styles.secondaryButtonText}>Avbryt</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primarySmallButton} onPress={handleConfirmAdd}>
                <Text style={styles.primarySmallButtonText}>Legg til</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
    fontSize: 26,
    fontWeight: '700',
    color: '#F9FAFB',
  },
  subtitle: {
    marginTop: 4,
    color: '#9CA3AF',
  },
  exerciseCard: {
    backgroundColor: '#0F172A',
    padding: 16,
    borderRadius: 10,
    marginVertical: 6,
  },
  exerciseTitle: {
    color: '#E5E7EB',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyText: {
    color: '#6B7280',
    marginTop: 16,
  },
  footer: {
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#1F2937',
  },

  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    backgroundColor: '#020617',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  modalTitle: {
    color: '#F9FAFB',
    fontSize: 20,
    fontWeight: '700',
  },
  modalSubtitle: {
    color: '#9CA3AF',
    fontSize: 13,
    marginTop: 4,
    marginBottom: 12,
  },
  inputLabel: {
    color: '#E5E7EB',
    fontSize: 13,
    marginBottom: 4,
    marginTop: 8,
  },
  input: {
    backgroundColor: '#020617',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1F2937',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#F9FAFB',
    fontSize: 15,
  },
  error: {
    color: '#F97373',
    fontSize: 12,
    marginTop: 6,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
  },
  secondaryButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    marginRight: 8,
  },
  secondaryButtonText: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  primarySmallButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#3B82F6',
  },
  primarySmallButtonText: {
    color: '#F9FAFB',
    fontSize: 14,
    fontWeight: '600',
  },
});
