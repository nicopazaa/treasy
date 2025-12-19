import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppLanguage } from '../shared/types';
import { TrainingBlock, Exercise, TrainingBlockId, SetEntry } from '../features/workouts/model/types';
import { PrimaryButton } from '../shared/ui/PrimaryButton';
import { UndoToast } from '../shared/ui/UndoToast';
import { getBlockTone } from '../shared/theme/blockTone';
import { SPACING, TEXT, RADIUS, SCREEN_PADDING, COLORS } from '../shared/theme/tokens';
import { blockLabel, t } from '../shared/i18n/i18n';

interface Props {
  language: AppLanguage;
  block: TrainingBlock;
  exercises: Exercise[];
  sets: SetEntry[];
  allBlocks: TrainingBlock[];
  onBack: () => void;
  onSelectExercise: (exerciseId: string) => void;
  onAddExercise: (name: string) => void;
  onRenameExercise: (exerciseId: string, name: string) => void;
  onDeleteExercise: (exerciseId: string) => void;
  onRestoreExercise: (exercise: Exercise, sets: SetEntry[], index?: number) => void;
  onReorderExercises: (orderedExerciseIds: string[]) => void;
  onMoveExercise: (exerciseId: string, blockId: TrainingBlockId) => void;
}

const STICKY_HEIGHT = 88;
const MUSCLE_GROUP_ORDER: TrainingBlockId[] = ['chest', 'shoulders', 'back', 'arms', 'core', 'legs'];

export const BlockScreen: React.FC<Props> = ({
  language,
  block,
  exercises,
  sets,
  allBlocks,
  onBack,
  onSelectExercise,
  onAddExercise,
  onRenameExercise,
  onDeleteExercise,
  onRestoreExercise,
  onReorderExercises,
  onMoveExercise,
}) => {
  const [modalMode, setModalMode] = useState<'add' | 'edit' | null>(null);
  const [exerciseName, setExerciseName] = useState('');
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [movingExerciseId, setMovingExerciseId] = useState<string | null>(null);
  const [exerciseAction, setExerciseAction] = useState<Exercise | null>(null);
  const [deletedExercise, setDeletedExercise] = useState<{
    exercise: Exercise;
    sets: SetEntry[];
    index: number;
  } | null>(null);
  const [moveExerciseTarget, setMoveExerciseTarget] = useState<Exercise | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    },
    []
  );

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

  const handleDeleteExercise = (exercise: Exercise) => {
    const index = exercises.findIndex((e) => e.id === exercise.id);
    const relatedSets = sets.filter((s) => s.exerciseId === exercise.id);
    onDeleteExercise(exercise.id);
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setDeletedExercise({
      exercise,
      sets: relatedSets,
      index: index >= 0 ? index : exercises.length,
    });
    undoTimerRef.current = setTimeout(() => setDeletedExercise(null), 4500);
  };

  const undoDeleteExercise = () => {
    if (!deletedExercise) return;
    onRestoreExercise(deletedExercise.exercise, deletedExercise.sets, deletedExercise.index);
    setDeletedExercise(null);
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
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
          onPress: () => handleDeleteExercise(exercise),
        },
      ]
    );
  };

  const openExerciseActions = (exercise: Exercise) => {
    setExerciseAction(exercise);
  };
  const openMoveExercise = (exercise: Exercise) => {
    setExerciseAction(null);
    setMoveExerciseTarget(exercise);
  };

  const movingExercise = movingExerciseId ? exercises.find((e) => e.id === movingExerciseId) ?? null : null;

  const reorderTo = (targetExerciseId: string) => {
    if (!movingExerciseId) return;
    if (movingExerciseId === targetExerciseId) {
      setMovingExerciseId(null);
      return;
    }
    const fromIndex = exercises.findIndex((e) => e.id === movingExerciseId);
    const toIndex = exercises.findIndex((e) => e.id === targetExerciseId);
    if (fromIndex < 0 || toIndex < 0) {
      setMovingExerciseId(null);
      return;
    }

    const next = exercises.slice();
    const [moved] = next.splice(fromIndex, 1);
    const insertIndex = fromIndex < toIndex ? toIndex - 1 : toIndex;
    next.splice(insertIndex, 0, moved);
    onReorderExercises(next.map((e) => e.id));
    setMovingExerciseId(null);
  };

  const renderExercise = ({ item }: { item: Exercise }) => (
    <TouchableOpacity
      style={[
        styles.exerciseCard,
        { borderColor: tone.accent, backgroundColor: tone.soft },
        movingExerciseId === item.id && styles.exerciseCardMoving,
      ]}
      onPress={() => {
        if (movingExerciseId) {
          reorderTo(item.id);
          return;
        }
        onSelectExercise(item.id);
      }}
      onLongPress={() => setMovingExerciseId(item.id)}
      delayLongPress={240}
      activeOpacity={0.9}
    >
      <Text style={styles.exerciseTitle} numberOfLines={1}>
        {item.name}
      </Text>
      <TouchableOpacity
        style={styles.kebabButton}
        onPress={(event) => {
          event.stopPropagation?.();
          openExerciseActions(item);
        }}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        activeOpacity={0.85}
      >
        <Text style={[styles.kebabText, { color: tone.accent }]}>{'⋯'}</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <TouchableOpacity onPress={onBack} hitSlop={12} style={styles.backButton} activeOpacity={0.8}>
          <Text style={styles.back}>{t(language, 'back')}</Text>
        </TouchableOpacity>

        <Text style={[styles.title, { color: tone.accent }]}>{blockTitle}</Text>
        <Text style={styles.subtitle}>{t(language, 'exercisesInBlock')}</Text>

        {movingExercise ? (
          <View style={[styles.moveBanner, { borderColor: tone.accent }]}>
            <Text style={styles.moveBannerText}>
              {t(language, 'moveExerciseHint', { name: movingExercise.name })}
            </Text>
            <TouchableOpacity onPress={() => setMovingExerciseId(null)} hitSlop={8}>
              <Text style={[styles.moveCancelText, { color: tone.accent }]}>{t(language, 'cancel')}</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      <FlatList
        data={exercises}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderExercise}
        style={{ marginTop: SPACING.xl }}
        contentContainerStyle={[styles.listContent, styles.listPadding]}
        ListEmptyComponent={<Text style={styles.emptyText}>{t(language, 'noExercisesYet')}</Text>}
      />

      <Modal
        visible={Boolean(exerciseAction)}
        transparent
        animationType="fade"
        onRequestClose={() => setExerciseAction(null)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setExerciseAction(null)}>
          <Pressable style={styles.sheetCard} onPress={() => {}}>
            <Text style={styles.sheetTitle}>{exerciseAction?.name ?? ''}</Text>

            <TouchableOpacity
              style={styles.sheetAction}
              onPress={() => {
                const target = exerciseAction;
                setExerciseAction(null);
                if (target) openEditModal(target);
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.sheetActionText}>{t(language, 'editExercise')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sheetAction}
              onPress={() => {
                const target = exerciseAction;
                if (target) openMoveExercise(target);
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.sheetActionText}>{t(language, 'changeMuscleGroup')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.sheetAction, styles.sheetActionDanger]}
              onPress={() => {
                const target = exerciseAction;
                setExerciseAction(null);
                if (target) confirmDelete(target);
              }}
              activeOpacity={0.85}
            >
              <Text style={[styles.sheetActionText, styles.sheetActionDangerText]}>{t(language, 'delete')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sheetAction}
              onPress={() => setExerciseAction(null)}
              activeOpacity={0.85}
            >
              <Text style={styles.sheetActionText}>{t(language, 'cancel')}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={Boolean(moveExerciseTarget)}
        transparent
        animationType="fade"
        onRequestClose={() => setMoveExerciseTarget(null)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setMoveExerciseTarget(null)}>
          <Pressable style={styles.sheetCard} onPress={() => {}}>
            <Text style={styles.sheetTitle}>{t(language, 'changeMuscleGroup')}</Text>
            <Text style={styles.sheetSubtitle}>{t(language, 'chooseMuscleGroup')}</Text>
            <View style={styles.groupGrid}>
              {allBlocks
                .slice()
                .sort((a, b) => {
                  const ai = MUSCLE_GROUP_ORDER.indexOf(a.id as TrainingBlockId);
                  const bi = MUSCLE_GROUP_ORDER.indexOf(b.id as TrainingBlockId);
                  if (ai === -1 && bi === -1) return a.name.localeCompare(b.name);
                  if (ai === -1) return 1;
                  if (bi === -1) return -1;
                  return ai - bi;
                })
                .map((b) => {
                  const tone = getBlockTone(b.id);
                  const selected = b.id === moveExerciseTarget?.blockId;
                  const isKnown = (['chest', 'shoulders', 'back', 'arms', 'core', 'legs', 'cardio'] as string[]).includes(
                    b.id
                  );
                  const label = isKnown ? blockLabel(b.id as TrainingBlockId, language) : b.name;
                  return (
                    <TouchableOpacity
                      key={b.id}
                      style={[
                        styles.groupButton,
                        { borderColor: tone.accent, backgroundColor: tone.soft },
                        selected && { opacity: 0.65 },
                      ]}
                      activeOpacity={0.9}
                      onPress={() => {
                        if (moveExerciseTarget && b.id !== moveExerciseTarget.blockId) {
                          onMoveExercise(moveExerciseTarget.id, b.id as TrainingBlockId);
                        }
                        setMoveExerciseTarget(null);
                      }}
                    >
                      <Text style={[styles.groupText, { color: tone.accent }]}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
            </View>
            <TouchableOpacity style={styles.sheetAction} onPress={() => setMoveExerciseTarget(null)} activeOpacity={0.85}>
              <Text style={styles.sheetActionText}>{t(language, 'cancel')}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <View pointerEvents="box-none" style={styles.toastContainer}>
        <UndoToast
          visible={Boolean(deletedExercise)}
          message={t(language, 'toast.exerciseDeleted')}
          actionLabel={t(language, 'undo')}
          onAction={undoDeleteExercise}
        />
      </View>

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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
    paddingTop: Platform.OS === 'ios' ? SPACING.sm : SPACING.xxxl,
    paddingBottom: STICKY_HEIGHT,
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
  listPadding: {
    paddingHorizontal: SCREEN_PADDING,
  },
  exerciseCard: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.lg,
    marginVertical: SPACING.sm,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  exerciseCardMoving: {
    borderWidth: 2,
    backgroundColor: '#0B1220',
  },
  exerciseTitle: {
    color: '#E5E7EB',
    fontSize: TEXT.md,
    fontWeight: '700',
    flex: 1,
    paddingRight: SPACING.md,
  },
  kebabButton: {
    width: 44,
    height: 44,
    minWidth: 44,
    minHeight: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  kebabText: {
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 22,
    marginTop: -2,
  },
  moveBanner: {
    marginTop: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#1F2937',
    backgroundColor: '#0B1220',
    padding: SPACING.md,
  },
  moveBannerText: {
    color: '#E5E7EB',
    fontSize: TEXT.sm,
    fontWeight: '700',
    marginBottom: SPACING.xs,
  },
  moveCancelText: {
    fontSize: TEXT.sm,
    fontWeight: '800',
  },
  emptyText: {
    color: '#9CA3AF',
    marginTop: SPACING.lg,
    fontSize: TEXT.sm,
  },
  toastContainer: {
    position: 'absolute',
    left: SCREEN_PADDING,
    right: SCREEN_PADDING,
    bottom: STICKY_HEIGHT + SPACING.sm,
  },
  stickyBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.lg,
    backgroundColor: '#020617',
    borderTopWidth: 1,
    borderTopColor: '#111827',
  },
  stickyButton: {
    marginVertical: 0,
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.72)',
    justifyContent: 'flex-end',
  },
  sheetCard: {
    backgroundColor: '#020617',
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#111827',
    padding: SPACING.lg,
    gap: SPACING.xs,
  },
  sheetTitle: {
    color: '#F9FAFB',
    fontSize: TEXT.md,
    fontWeight: '700',
    marginBottom: SPACING.sm,
  },
  sheetSubtitle: {
    color: '#9CA3AF',
    fontSize: TEXT.sm,
    marginBottom: SPACING.sm,
  },
  sheetAction: {
    minHeight: 48,
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
  },
  sheetActionText: {
    color: '#E5E7EB',
    fontSize: TEXT.sm,
    fontWeight: '700',
  },
  sheetActionDanger: {
    borderTopWidth: 1,
    borderTopColor: '#111827',
  },
  sheetActionDangerText: {
    color: COLORS.warning,
  },
  groupGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginVertical: SPACING.sm,
  },
  groupButton: {
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    minWidth: '45%',
    marginRight: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  groupText: {
    color: '#E5E7EB',
    fontWeight: '700',
  },

  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    justifyContent: 'center',
    paddingHorizontal: SCREEN_PADDING,
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
