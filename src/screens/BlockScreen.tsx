import React, { useMemo, useState } from 'react';
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
import { TrainingBlock, Exercise, AppLanguage, TrainingBlockId } from '../types';
import { PrimaryButton } from '../components/PrimaryButton';
import { getBlockTone } from '../utils/blockTone';
import { SPACING, TEXT, RADIUS } from '../theme/tokens';
import { blockLabel, t } from '../i18n/i18n';

interface Props {
  language: AppLanguage;
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
  language,
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
  const blockTitle = useMemo(() => {
    const id = block.id as TrainingBlockId;
    return (['chest', 'shoulders', 'back', 'arms', 'core', 'legs', 'cardio'] as string[]).includes(id)
      ? blockLabel(id, language)
      : block.name;
  }, [block.id, block.name, language]);

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
      setError(t(language, 'enterExerciseName'));
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
      t(language, 'deleteExerciseTitle'),
      t(language, 'deleteExerciseBody', { name: exercise.name }),
      [
        { text: t(language, 'cancel'), style: 'cancel' },
        {
          text: t(language, 'delete'),
          style: 'destructive',
          onPress: () => onDeleteExercise(exercise.id),
        },
      ]
    );
  };

  const openExerciseActions = (exercise: Exercise) => {
    Alert.alert(exercise.name, '', [
      { text: t(language, 'edit'), onPress: () => openEditModal(exercise) },
      { text: t(language, 'delete'), style: 'destructive', onPress: () => confirmDelete(exercise) },
      { text: t(language, 'cancel'), style: 'cancel' },
    ]);
  };

  const renderExercise = ({ item }: { item: Exercise }) => (
    <TouchableOpacity
      style={[styles.exerciseCard, { borderColor: tone.accent, backgroundColor: tone.soft }]}
      onPress={() => onSelectExercise(item.id)}
      onLongPress={() => openExerciseActions(item)}
      activeOpacity={0.9}
    >
      <Text style={styles.exerciseTitle}>{item.name}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onBack} hitSlop={8}>
        <Text style={styles.back}>{t(language, 'back')}</Text>
      </TouchableOpacity>

      <Text style={[styles.title, { color: tone.accent }]}>{blockTitle}</Text>
      <Text style={styles.subtitle}>{t(language, 'exercisesInBlock')}</Text>

      <FlatList
        data={exercises}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderExercise}
        style={{ marginTop: SPACING.xl }}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<Text style={styles.emptyText}>{t(language, 'noExercisesYet')}</Text>}
      />

      <View style={styles.stickyBar}>
        <PrimaryButton title={t(language, 'addExercise')} onPress={openAddModal} style={styles.stickyButton} />
      </View>

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
              {modalMode === 'edit' ? t(language, 'editExercise') : t(language, 'newExercise')}
            </Text>

            <Text style={styles.inputLabel}>{t(language, 'exerciseName')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t(language, 'exerciseName')}
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
                <Text style={styles.secondaryButtonText}>{t(language, 'cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primarySmallButton} onPress={handleConfirm}>
                <Text style={styles.primarySmallButtonText}>
                  {modalMode === 'edit' ? t(language, 'save') : t(language, 'add')}
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
    fontSize: TEXT.sm,
    fontWeight: '600',
  },
  title: {
    fontSize: TEXT.xxl,
    fontWeight: '700',
    color: '#F9FAFB',
  },
  subtitle: {
    marginTop: SPACING.xs,
    color: '#9CA3AF',
    fontSize: TEXT.sm,
  },
  listContent: {
    paddingBottom: STICKY_HEIGHT + SPACING.lg,
  },
  exerciseCard: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.lg,
    marginVertical: SPACING.sm,
    borderWidth: 1,
  },
  exerciseTitle: {
    color: '#E5E7EB',
    fontSize: TEXT.md,
    fontWeight: '700',
  },
  emptyText: {
    color: '#9CA3AF',
    marginTop: SPACING.lg,
    fontSize: TEXT.sm,
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
    marginBottom: SPACING.md,
  },
  inputLabel: {
    color: '#E5E7EB',
    fontSize: TEXT.sm,
    marginBottom: SPACING.xs,
  },
  input: {
    backgroundColor: '#0B1220',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#1F2937',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    color: '#F9FAFB',
    fontSize: TEXT.md,
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
    fontWeight: '600',
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
    fontWeight: '700',
  },
});
