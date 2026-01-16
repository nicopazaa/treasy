import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
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
import type { TrainingBlock, Exercise, TrainingBlockId, SetEntry, ExerciseMetadataInput } from '../features/workouts';
import { PrimaryButton } from '../shared/ui/PrimaryButton';
import { BlockScreenHeader } from '../shared/ui/BlockScreenHeader';
import { UndoToast } from '../shared/ui/UndoToast';
import { getBlockTone } from '../shared/theme/blockTone';
import { SPACING, TEXT, RADIUS, SCREEN_PADDING, COLORS } from '../shared/theme/tokens';
import { blockLabel, t } from '../shared/i18n/i18n';
import { UNDO_TIMEOUT_MS } from '../shared/constants';
import { formatExerciseLabel } from '../shared/utils/exerciseLabel';
import { BlockExerciseItem } from '../features/workouts/ui/BlockExerciseItem';
import { BlockExerciseList } from '../features/workouts/ui/BlockExerciseList';
import { formatWeight, type MassUnit } from '../shared/utils/units';
import { BLOCK_ICON_SOURCES } from '../shared/ui/blockIcons';
import { ExerciseLogBottomSheet, type SetLoggerMeta } from '../shared/ui/ExerciseLogBottomSheet';

interface Props {
  language: AppLanguage;
  massUnit: MassUnit;
  block: TrainingBlock;
  exercises: Exercise[];
  sets: SetEntry[];
  setsByExerciseId?: Map<string, SetEntry[]>;
  allBlocks: TrainingBlock[];
  onBack: () => void;
  onAddSetToExercise: (exerciseId: string, weightKg: number, reps: number, meta?: SetLoggerMeta) => void;
  onAddExercise: (name: string, metadata?: ExerciseMetadataInput) => void;
  onRenameExercise: (exerciseId: string, name: string, metadata?: ExerciseMetadataInput) => void;
  onDeleteExercise: (exerciseId: string) => void;
  onRestoreExercise: (exercise: Exercise, sets: SetEntry[], index?: number) => void;
  onReorderExercises: (orderedExerciseIds: string[]) => void;
  onMoveExercise: (exerciseId: string, blockId: TrainingBlockId) => void;
}

const STICKY_HEIGHT = 88;
const MUSCLE_GROUP_ORDER: TrainingBlockId[] = ['chest', 'shoulders', 'back', 'arms', 'core', 'legs', 'cardio', 'bodyweight'];

export const BlockScreen: React.FC<Props> = ({
  language,
  massUnit,
  block,
  exercises,
  sets,
  setsByExerciseId,
  allBlocks,
  onBack,
  onAddSetToExercise,
  onAddExercise,
  onRenameExercise,
  onDeleteExercise,
  onRestoreExercise,
  onReorderExercises,
  onMoveExercise,
}) => {
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [isLogSheetOpen, setIsLogSheetOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit' | null>(null);
  const [exerciseName, setExerciseName] = useState('');
  const [exerciseShort, setExerciseShort] = useState('');
  const [exerciseTags, setExerciseTags] = useState('');
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
    return (['chest', 'shoulders', 'back', 'arms', 'core', 'legs', 'cardio', 'bodyweight'] as string[]).includes(id)
      ? blockLabel(id, language)
      : block.name;
  }, [block.id, block.name, language]);

  const blockIconSource = useMemo(() => {
    const id = block.id as TrainingBlockId;
    return MUSCLE_GROUP_ORDER.includes(id) ? BLOCK_ICON_SOURCES[id] : null;
  }, [block.id]);

  const parseTags = (raw: string): string[] =>
    raw
      .split(/[,\s]+/)
      .map((t) => t.replace(/[()]/g, '').trim())
      .filter(Boolean);

  const openAddModal = () => {
    setExerciseName('');
    setExerciseShort('');
    setExerciseTags('');
    setEditingExerciseId(null);
    setError(null);
    setModalMode('add');
  };

  const openEditModal = (exercise: Exercise) => {
    setExerciseName(exercise.name);
    setExerciseShort(exercise.shortCode ?? '');
    setExerciseTags((exercise.tags ?? []).join(', '));
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
    const meta: ExerciseMetadataInput = {
      shortCode: exerciseShort.replace(/[()]/g, '').trim() || null,
      tags: parseTags(exerciseTags),
    };

    if (modalMode === 'add') {
      onAddExercise(trimmed, meta);
    } else if (modalMode === 'edit' && editingExerciseId) {
      onRenameExercise(editingExerciseId, trimmed, meta);
    }
    setExerciseName('');
    setExerciseShort('');
    setExerciseTags('');
    setEditingExerciseId(null);
    setError(null);
    setModalMode(null);
  };

  const showDeleteError = () => {
    const title = language === 'nb' ? 'Kunne ikke slette øvelse' : language === 'es' ? 'No se pudo eliminar' : 'Delete failed';
    const message =
      language === 'nb'
        ? 'Prøv igjen.'
        : language === 'es'
          ? 'Inténtalo de nuevo.'
          : 'Please try again.';
    Alert.alert(title, message);
  };

  const handleDeleteExercise = (exercise: Exercise) => {
    if (!exercise?.id) {
      showDeleteError();
      return;
    }
    const index = exercises.findIndex((e) => e.id === exercise.id);
    const relatedSets = sets.filter((s) => s.exerciseId === exercise.id);
    try {
      onDeleteExercise(exercise.id);
    } catch (error) {
      showDeleteError();
      return;
    }
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setDeletedExercise({
      exercise,
      sets: relatedSets,
      index: index >= 0 ? index : exercises.length,
    });
    undoTimerRef.current = setTimeout(() => setDeletedExercise(null), UNDO_TIMEOUT_MS);
  };

  const undoDeleteExercise = () => {
    if (!deletedExercise) return;
    onRestoreExercise(deletedExercise.exercise, deletedExercise.sets, deletedExercise.index);
    setDeletedExercise(null);
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
  };

  const openExerciseActions = (exercise: Exercise) => {
    setExerciseAction(exercise);
  };
  const openMoveExercise = (exercise: Exercise) => {
    setExerciseAction(null);
    setMoveExerciseTarget(exercise);
  };

  const movingExercise = movingExerciseId ? exercises.find((e) => e.id === movingExerciseId) ?? null : null;
  const selectedExercise = selectedExerciseId ? exercises.find((e) => e.id === selectedExerciseId) ?? null : null;

  const selectedExerciseSets = useMemo(() => {
    if (!selectedExerciseId) return [];
    const cached = setsByExerciseId?.get(selectedExerciseId);
    if (cached) return cached;
    return sets
      .filter((s) => s.exerciseId === selectedExerciseId)
      .slice()
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }, [selectedExerciseId, sets, setsByExerciseId]);

  const closeLogSheet = () => {
    setIsLogSheetOpen(false);
    setSelectedExerciseId(null);
  };

  const bestSetLabel = (exerciseId: string): string | null => {
    const relevant = sets.filter((s) => s.exerciseId === exerciseId && s.setType !== 'cardio');
    if (relevant.length === 0) return null;
    const best = relevant.reduce<SetEntry | null>((acc, cur) => {
      if (!acc) return cur;
      const accWeight = acc.weight ?? 0;
      const curWeight = cur.weight ?? 0;
      if (curWeight > accWeight) return cur;
      if (curWeight < accWeight) return acc;
      if ((cur.reps ?? 0) > (acc.reps ?? 0)) return cur;
      if ((cur.reps ?? 0) < (acc.reps ?? 0)) return acc;
      return cur;
    }, null);
    if (!best) return null;
    if (best.isBodyweight || best.weight === 0) return `BW × ${best.reps}`;
    return `${formatWeight(best.weight, massUnit, language)} × ${best.reps}`;
  };

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

  const renderExercise = ({ item }: { item: Exercise }) => {
    const bestLabel = bestSetLabel(item.id);
    const isMoving = movingExerciseId === item.id;

    const handlePress = () => {
      if (movingExerciseId) {
        reorderTo(item.id);
        return;
      }
      setSelectedExerciseId(item.id);
      setIsLogSheetOpen(true);
    };

    return (
      <BlockExerciseItem
        exercise={item}
        bestLabel={bestLabel}
        isMoving={isMoving}
        onPress={handlePress}
        onLongPress={() => setMovingExerciseId(item.id)}
        onPressMenu={() => openExerciseActions(item)}
      />
    );
  };


  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <TouchableOpacity onPress={onBack} hitSlop={12} style={styles.backButton} activeOpacity={0.8}>
          <Text style={styles.back}>{t(language, 'back')}</Text>
        </TouchableOpacity>

        <BlockScreenHeader
          title={blockTitle}
          subtitle={t(language, 'exercisesInBlock')}
          iconSource={blockIconSource}
        />

        {movingExercise ? (
          <View style={[styles.moveBanner, { borderColor: tone.accent }]}>
            <Text style={styles.moveBannerText}>
              {t(language, 'moveExerciseHint', { name: formatExerciseLabel(movingExercise) })}
            </Text>
            <TouchableOpacity onPress={() => setMovingExerciseId(null)} hitSlop={8}>
              <Text style={[styles.moveCancelText, { color: tone.accent }]}>{t(language, 'cancel')}</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      <View style={[styles.listPadding, styles.listWrapper]}>
        <BlockExerciseList
          data={exercises}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderExercise}
          emptyText={t(language, 'noExercisesYet')}
        />
      </View>

      <Modal
        visible={Boolean(exerciseAction)}
        transparent
        animationType="fade"
        onRequestClose={() => setExerciseAction(null)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setExerciseAction(null)}>
          <Pressable style={styles.sheetCard} onPress={() => {}}>
            <Text style={styles.sheetTitle}>
              {exerciseAction ? formatExerciseLabel(exerciseAction) : ''}
            </Text>

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
                if (target) handleDeleteExercise(target);
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
                  const isKnown = (['chest', 'shoulders', 'back', 'arms', 'core', 'legs', 'cardio', 'bodyweight'] as string[]).includes(
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

      {selectedExercise ? (
        <ExerciseLogBottomSheet
          visible={isLogSheetOpen}
          language={language}
          massUnit={massUnit}
          exercise={selectedExercise}
          sets={selectedExerciseSets}
          onAddSet={(weightKg, reps, meta) => {
            if (!selectedExerciseId) return;
            onAddSetToExercise(selectedExerciseId, weightKg, reps, meta);
          }}
          onCopyLastSet={() => {}}
          onClose={closeLogSheet}
        />
      ) : null}

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
              placeholderTextColor={COLORS.textSecondaryGray}
              value={exerciseName}
              onChangeText={setExerciseName}
              autoFocus
              autoCapitalize="sentences"
              returnKeyType="done"
              onSubmitEditing={handleConfirm}
            />

            <Text style={[styles.inputLabel, styles.inputLabelOptional]}>{t(language, 'exerciseShortCode')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t(language, 'exerciseShortCodePlaceholder')}
              placeholderTextColor={COLORS.textSecondaryGray}
              value={exerciseShort}
              onChangeText={setExerciseShort}
              autoCapitalize="characters"
              returnKeyType="next"
            />

            <Text style={[styles.inputLabel, styles.inputLabelOptional]}>{t(language, 'exerciseTags')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t(language, 'exerciseTagsPlaceholder')}
              placeholderTextColor={COLORS.textSecondaryGray}
              value={exerciseTags}
              onChangeText={setExerciseTags}
              autoCapitalize="characters"
              returnKeyType="done"
              onSubmitEditing={handleConfirm}
            />
            <Text style={styles.inputHint}>{t(language, 'exerciseTagsHint')}</Text>

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
  listPadding: {
    paddingHorizontal: SCREEN_PADDING,
  },
  listWrapper: {
    marginTop: SPACING.lg,
    flex: 1,
    minHeight: 0,
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
    backgroundColor: COLORS.blue6,
    borderRadius: RADIUS.lg,
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
  inputLabelOptional: {
    color: COLORS.textSecondaryGray,
  },
  input: {
    backgroundColor: COLORS.surfaceWhite,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(2, 6, 23, 0.12)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    color: COLORS.textNavyPrimary,
    fontSize: TEXT.md,
  },
  inputHint: {
    color: COLORS.textSecondaryGray,
    fontSize: TEXT.xs,
    marginTop: SPACING.xs,
    marginBottom: SPACING.sm,
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
