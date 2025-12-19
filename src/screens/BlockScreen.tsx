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
  Alert,
} from 'react-native';
import { TrainingBlock, Exercise } from '../types';
import { PrimaryButton } from '../components/PrimaryButton';
import { getBlockTone } from '../utils/blockTone';
import { SPACING, TEXT, RADIUS } from '../theme/tokens';

interface Props {
  block: TrainingBlock;
  exercises: Exercise[];
  onBack: () => void;
  onSelectExercise: (exerciseId: string) => void;
  onAddExercise: (name: string) => void;
  onRenameExercise: (exerciseId: string, name: string) => void;
  onDeleteExercise: (exerciseId: string) => void;
}

const STICKY_HEIGHT = 88;

export const BlockScreen: React.FC<Props> = ({
  block,
  exercises,
  onBack,
  onSelectExercise,
  onAddExercise,
  onRenameExercise,
  onDeleteExercise,
}) => {
  const [modalMode, setModalMode] = useState<'add' | 'edit' | null>(null);
  const [exerciseName, setExerciseName] = useState('');
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tone = getBlockTone(block.id);

  const openAddModal = () => {
    setExerciseName('');
    setEditingExerciseId(null);
    setError(null);
    setModalMode('add');
  };

  const openEditModal = (exercise: Exercise) => {
    setExerciseName(exercise.name);
    setEditingExerciseId(exercise.id);
    setError(null);
    setModalMode('edit');
  };

  const closeModal = () => {
    setModalMode(null);
    setError(null);
  };

  const handleConfirm = () => {
    const trimmed = exerciseName.trim();
    if (!trimmed) {
      setError('Skriv inn et navn pa ovelsen.');
      return;
    }
    if (modalMode === 'add') {
      onAddExercise(trimmed);
    } else if (modalMode === 'edit' && editingExerciseId) {
      onRenameExercise(editingExerciseId, trimmed);
    }
    setExerciseName('');
    setEditingExerciseId(null);
    setError(null);
    setModalMode(null);
  };

  const confirmDelete = (exercise: Exercise) => {
    Alert.alert(
      'Slett ovelse?',
      `Vil du slette ${exercise.name}? Dette fjerner ogsa alle sett.`,
      [
        { text: 'Avbryt', style: 'cancel' },
        {
          text: 'Slett',
          style: 'destructive',
          onPress: () => onDeleteExercise(exercise.id),
        },
      ]
    );
  };

  const renderExercise = ({ item }: { item: Exercise }) => (
    <View
      style={[
        styles.exerciseCard,
        { borderColor: tone.accent, backgroundColor: tone.soft },
      ]}
    >
      <TouchableOpacity
        style={styles.exerciseMain}
        onPress={() => onSelectExercise(item.id)}
        activeOpacity={0.9}
      >
        <Text style={styles.exerciseTitle}>{item.name}</Text>
      </TouchableOpacity>
      <View style={styles.exerciseActions}>
        <TouchableOpacity onPress={() => openEditModal(item)} hitSlop={8}>
          <Text style={styles.actionText}>Endre</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => confirmDelete(item)} hitSlop={8}>
          <Text style={[styles.actionText, styles.deleteText]}>Slett</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.back}>{'< Tilbake'}</Text>
      </TouchableOpacity>

      <Text style={[styles.title, { color: tone.accent }]}>{block.name}</Text>
      <Text style={styles.subtitle}>A~velser i denne blokken</Text>

      <FlatList
        data={exercises}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderExercise}
        style={{ marginTop: SPACING.xl }}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            Ingen A,velser enda. Trykk "Legg til A,velse" for A komme i gang.
          </Text>
        }
      />

      <View style={styles.stickyBar}>
        <PrimaryButton
          title="Legg til A,velse"
          onPress={openAddModal}
          style={styles.stickyButton}
        />
      </View>

      {/* Modal for A legge til eller endre A,velse */}
      <Modal
        visible={modalMode !== null}
        animationType="fade"
        transparent
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {modalMode === 'edit' ? 'Endre ovelse' : 'Legg til ny ovelse'}
            </Text>
            <Text style={styles.modalSubtitle}>
              {modalMode === 'edit'
                ? `Ovelsen ligger i blokken ${block.name}.`
                : `Denne A,velsen blir lagt til i blokken ${block.name}.`}
            </Text>

            <Text style={styles.inputLabel}>Navn pA A,velse</Text>
            <TextInput
              style={styles.input}
              placeholder="F.eks. Dumbbell press"
              placeholderTextColor="#4B5563"
              value={exerciseName}
              onChangeText={setExerciseName}
              autoFocus
              autoCapitalize="sentences"
              returnKeyType="done"
              onSubmitEditing={handleConfirm}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.secondaryButton} onPress={closeModal}>
                <Text style={styles.secondaryButtonText}>Avbryt</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primarySmallButton} onPress={handleConfirm}>
                <Text style={styles.primarySmallButtonText}>
                  {modalMode === 'edit' ? 'Lagre' : 'Legg til'}
                </Text>
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
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xxxl,
    paddingBottom: STICKY_HEIGHT,
  },
  back: {
    color: '#93C5FD',
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: TEXT.xxl,
    fontWeight: '700',
    color: '#F9FAFB',
  },
  subtitle: {
    marginTop: SPACING.xs,
    color: '#9CA3AF',
  },
  listContent: {
    paddingBottom: STICKY_HEIGHT + SPACING.lg,
  },
  exerciseCard: {
    backgroundColor: '#0F172A',
    padding: SPACING.lg,
    borderRadius: RADIUS.md,
    marginVertical: SPACING.sm,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  exerciseMain: {
    paddingBottom: SPACING.sm,
  },
  exerciseTitle: {
    color: '#E5E7EB',
    fontSize: TEXT.md,
    fontWeight: '600',
  },
  exerciseActions: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  actionText: {
    color: '#E5E7EB',
    fontSize: TEXT.xs,
    fontWeight: '600',
  },
  deleteText: {
    color: '#F87171',
  },
  emptyText: {
    color: '#6B7280',
    marginTop: SPACING.lg,
  },
  stickyBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.lg,
    backgroundColor: '#020617',
    borderTopWidth: 1,
    borderTopColor: '#111827',
  },
  stickyButton: {
    marginVertical: 0,
  },

  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xxl,
  },
  modalCard: {
    backgroundColor: '#020617',
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  modalTitle: {
    color: '#F9FAFB',
    fontSize: TEXT.lg,
    fontWeight: '700',
  },
  modalSubtitle: {
    color: '#9CA3AF',
    fontSize: TEXT.xs,
    marginTop: SPACING.xs,
    marginBottom: SPACING.md,
  },
  inputLabel: {
    color: '#E5E7EB',
    fontSize: TEXT.xs,
    marginBottom: SPACING.xs,
    marginTop: SPACING.sm,
  },
  input: {
    backgroundColor: '#020617',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#1F2937',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    color: '#F9FAFB',
    fontSize: TEXT.sm,
  },
  error: {
    color: '#F97373',
    fontSize: TEXT.xs,
    marginTop: SPACING.xs,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: SPACING.lg,
  },
  secondaryButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.pill,
    marginRight: SPACING.sm,
  },
  secondaryButtonText: {
    color: '#9CA3AF',
    fontSize: TEXT.sm,
  },
  primarySmallButton: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.pill,
    backgroundColor: '#3B82F6',
  },
  primarySmallButtonText: {
    color: '#F9FAFB',
    fontSize: TEXT.sm,
    fontWeight: '600',
  },
});
