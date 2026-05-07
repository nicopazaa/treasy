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
import type { AppLanguage, ThemeMode } from '../shared/types';
import type { TrainingBlock, Exercise, TrainingBlockId, SetEntry, ExerciseMetadataInput } from '../features/workouts';
import { PrimaryButton } from '../shared/ui/PrimaryButton';
import { BlockScreenHeader } from '../shared/ui/BlockScreenHeader';
import { UndoToast } from '../shared/ui/UndoToast';
import { ExerciseLabelText } from '../shared/ui/ExerciseLabelText';
import { getBlockTone } from '../shared/theme/blockTone';
import { SPACING, TEXT, RADIUS, SCREEN_PADDING, COLORS } from '../shared/theme/tokens';
import { resolveThemeTokens } from '../shared/theme/themes';
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
  themeMode?: ThemeMode;
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
const FALLBACK_ACCENT = COLORS.blue2;

function parseHexColor(color: string): [number, number, number] | null {
  const clean = color.trim().replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
  return [parseInt(clean.slice(0, 2), 16), parseInt(clean.slice(2, 4), 16), parseInt(clean.slice(4, 6), 16)];
}

function toRgba(color: string, alpha: number): string {
  const safeAlpha = Number.isFinite(alpha) ? Math.max(0, Math.min(1, alpha)) : 1;
  const rgb = parseHexColor(color) ?? parseHexColor(FALLBACK_ACCENT);
  if (!rgb) return `rgba(59, 130, 246, ${safeAlpha})`;
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${safeAlpha})`;
}

export const BlockScreen: React.FC<Props> = ({
  language,
  themeMode,
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
  const themeTokens = useMemo(() => resolveThemeTokens(themeMode), [themeMode]);
  const isLightTheme = themeTokens.id === 'calmLight';
  const listVariant: 'dark' | 'light' = isLightTheme ? 'light' : 'dark';
  const bodyTextColor = isLightTheme ? themeTokens.text : '#F9FAFB';
  const mutedTextColor = isLightTheme ? themeTokens.textMuted : 'rgba(203, 213, 225, 0.72)';
  const inputPlaceholderColor = isLightTheme ? 'rgba(100, 116, 139, 0.72)' : COLORS.textSecondaryGray;
  const modalInputBackgroundColor = isLightTheme ? '#FFFFFF' : '#F8FAFC';
  const modalInputBorderColor = isLightTheme ? '#CBD5E1' : 'rgba(37, 99, 235, 0.26)';
  const modalInputTextColor = isLightTheme ? themeTokens.text : COLORS.textNavyPrimary;
  const modalSecondaryTextColor = isLightTheme ? themeTokens.textMuted : '#9CA3AF';
  const modalOverlayColor = isLightTheme ? 'rgba(15, 23, 42, 0.34)' : 'rgba(2, 6, 23, 0.82)';
  const bottomSheetOverlayColor = isLightTheme ? 'rgba(15, 23, 42, 0.34)' : 'rgba(2, 6, 23, 0.78)';
  const sheetActionBorderColor = isLightTheme ? 'rgba(148, 163, 184, 0.3)' : 'rgba(148, 163, 184, 0.24)';
  const pageBackgroundColor = themeTokens.bg;
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

  const backButtonStyle = useMemo(
    () => ({
      borderColor: toRgba(tone.accent, isLightTheme ? 0.22 : 0.28),
      backgroundColor: toRgba(tone.accent, isLightTheme ? 0.08 : 0.1),
    }),
    [isLightTheme, tone.accent]
  );
  const listWrapperStyle = useMemo(
    () => ({
      backgroundColor: pageBackgroundColor,
    }),
    [pageBackgroundColor]
  );
  const stickyBarStyle = useMemo(
    () => ({
      borderTopColor: toRgba(tone.accent, isLightTheme ? 0.18 : 0.22),
      backgroundColor: pageBackgroundColor,
    }),
    [isLightTheme, pageBackgroundColor, tone.accent]
  );
  const stickyButtonStyle = useMemo(
    () => ({
      backgroundColor: tone.accent,
      borderColor: toRgba(tone.accent, isLightTheme ? 0.3 : 0.32),
    }),
    [isLightTheme, tone.accent]
  );
  const moveBannerStyle = useMemo(
    () => ({
      borderColor: toRgba(tone.accent, isLightTheme ? 0.24 : 0.38),
      backgroundColor: toRgba(tone.accent, isLightTheme ? 0.1 : 0.12),
    }),
    [isLightTheme, tone.accent]
  );
  const moveBannerTextStyle = useMemo(
    () => ({
      color: isLightTheme ? themeTokens.text : '#DBEAFE',
    }),
    [isLightTheme, themeTokens.text]
  );
  const modalCardStyle = useMemo(
    () => ({
      backgroundColor: isLightTheme ? themeTokens.surface : '#030C1A',
      borderColor: toRgba(tone.accent, isLightTheme ? 0.2 : 0.28),
    }),
    [isLightTheme, themeTokens.surface, tone.accent]
  );
  const sheetCardStyle = useMemo(
    () => ({
      backgroundColor: isLightTheme ? themeTokens.surface : '#030C1A',
      borderColor: toRgba(tone.accent, isLightTheme ? 0.2 : 0.26),
    }),
    [isLightTheme, themeTokens.surface, tone.accent]
  );

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
        variant={listVariant}
        onPress={handlePress}
        onLongPress={() => setMovingExerciseId(item.id)}
        onPressMenu={() => openExerciseActions(item)}
      />
    );
  };


  return (
    <SafeAreaView style={[styles.container, { backgroundColor: pageBackgroundColor }]}>
      <View style={styles.content}>
        <View style={styles.headerPanel}>
          <TouchableOpacity onPress={onBack} hitSlop={12} style={[styles.backButton, backButtonStyle]} activeOpacity={0.8}>
            <Text style={[styles.back, { color: tone.accent }]}>{t(language, 'back')}</Text>
          </TouchableOpacity>

          <BlockScreenHeader
            title={blockTitle}
            subtitle={t(language, 'exercisesInBlock')}
            iconSource={blockIconSource}
            accentColor={tone.accent}
            variant={listVariant}
          />

          {movingExercise ? (
            <View style={[styles.moveBanner, moveBannerStyle]}>
              <Text style={[styles.moveBannerText, moveBannerTextStyle]}>
                {t(language, 'moveExerciseHint', { name: formatExerciseLabel(movingExercise) })}
              </Text>
              <TouchableOpacity onPress={() => setMovingExerciseId(null)} hitSlop={8}>
                <Text style={[styles.moveCancelText, { color: tone.accent }]}>{t(language, 'cancel')}</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </View>

      <View style={[styles.listPadding, styles.listWrapper, listWrapperStyle]}>
        <BlockExerciseList
          data={exercises}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderExercise}
          emptyText={t(language, 'noExercisesYet')}
          variant={listVariant}
          extraBottomPadding={SPACING.md}
        />
      </View>

      <Modal
        visible={Boolean(exerciseAction)}
        transparent
        animationType="fade"
        onRequestClose={() => setExerciseAction(null)}
      >
        <Pressable style={[styles.sheetBackdrop, { backgroundColor: bottomSheetOverlayColor }]} onPress={() => setExerciseAction(null)}>
          <Pressable style={[styles.sheetCard, sheetCardStyle]} onPress={() => {}}>
            {exerciseAction ? (
              <ExerciseLabelText
                label={formatExerciseLabel(exerciseAction)}
                style={styles.sheetTitleWrap}
                mainStyle={[styles.sheetTitle, { color: bodyTextColor }]}
                secondaryStyle={[styles.sheetTitleMeta, { color: mutedTextColor }]}
              />
            ) : null}

            <TouchableOpacity
              style={[styles.sheetAction, { borderTopColor: sheetActionBorderColor }]}
              onPress={() => {
                const target = exerciseAction;
                setExerciseAction(null);
                if (target) openEditModal(target);
              }}
              activeOpacity={0.85}
            >
              <Text style={[styles.sheetActionText, { color: bodyTextColor }]}>{t(language, 'editExercise')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.sheetAction, { borderTopColor: sheetActionBorderColor }]}
              onPress={() => {
                const target = exerciseAction;
                if (target) openMoveExercise(target);
              }}
              activeOpacity={0.85}
            >
              <Text style={[styles.sheetActionText, { color: bodyTextColor }]}>{t(language, 'changeMuscleGroup')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.sheetAction, { borderTopColor: sheetActionBorderColor }, styles.sheetActionDanger]}
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
              style={[styles.sheetAction, { borderTopColor: sheetActionBorderColor }]}
              onPress={() => setExerciseAction(null)}
              activeOpacity={0.85}
            >
              <Text style={[styles.sheetActionText, { color: bodyTextColor }]}>{t(language, 'cancel')}</Text>
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
        <Pressable style={[styles.sheetBackdrop, { backgroundColor: bottomSheetOverlayColor }]} onPress={() => setMoveExerciseTarget(null)}>
          <Pressable style={[styles.sheetCard, sheetCardStyle]} onPress={() => {}}>
            <Text style={[styles.sheetTitle, { color: bodyTextColor }]}>{t(language, 'changeMuscleGroup')}</Text>
            <Text style={[styles.sheetSubtitle, { color: mutedTextColor }]}>{t(language, 'chooseMuscleGroup')}</Text>
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
                        { borderColor: toRgba(tone.accent, isLightTheme ? 0.28 : 1), backgroundColor: toRgba(tone.accent, isLightTheme ? 0.1 : 0.16) },
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
                      <Text style={[styles.groupText, { color: isLightTheme ? bodyTextColor : tone.accent }]}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
            </View>
            <TouchableOpacity
              style={[styles.sheetAction, { borderTopColor: sheetActionBorderColor }]}
              onPress={() => setMoveExerciseTarget(null)}
              activeOpacity={0.85}
            >
              <Text style={[styles.sheetActionText, { color: bodyTextColor }]}>{t(language, 'cancel')}</Text>
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
          themeMode={themeMode}
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

      <View style={[styles.stickyBar, { backgroundColor: pageBackgroundColor }]}>
        <View style={[styles.stickyBarBorder, stickyBarStyle]} pointerEvents="none" />
        <PrimaryButton
          title={t(language, 'addExercise')}
          onPress={openAddModal}
          style={StyleSheet.flatten([styles.stickyButton, stickyButtonStyle])}
        />
      </View>

      <Modal
        visible={modalMode !== null}
        animationType="fade"
        transparent
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView
          style={[styles.modalContainer, { backgroundColor: modalOverlayColor }]}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.modalCard, modalCardStyle]}>
            <Text style={[styles.modalTitle, { color: bodyTextColor }]}>
              {modalMode === 'edit' ? t(language, 'editExercise') : t(language, 'newExercise')}
            </Text>

            <Text style={[styles.inputLabel, { color: isLightTheme ? bodyTextColor : 'rgba(226, 232, 240, 0.9)' }]}>{t(language, 'exerciseName')}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: modalInputBackgroundColor, borderColor: modalInputBorderColor, color: modalInputTextColor }]}
              placeholder={t(language, 'exerciseName')}
              placeholderTextColor={inputPlaceholderColor}
              value={exerciseName}
              onChangeText={setExerciseName}
              autoFocus
              autoCapitalize="sentences"
              returnKeyType="done"
              onSubmitEditing={handleConfirm}
            />

            <Text style={[styles.inputLabel, styles.inputLabelOptional, { color: modalSecondaryTextColor }]}>{t(language, 'exerciseShortCode')}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: modalInputBackgroundColor, borderColor: modalInputBorderColor, color: modalInputTextColor }]}
              placeholder={t(language, 'exerciseShortCodePlaceholder')}
              placeholderTextColor={inputPlaceholderColor}
              value={exerciseShort}
              onChangeText={setExerciseShort}
              autoCapitalize="characters"
              returnKeyType="next"
            />

            <Text style={[styles.inputLabel, styles.inputLabelOptional, { color: modalSecondaryTextColor }]}>{t(language, 'exerciseTags')}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: modalInputBackgroundColor, borderColor: modalInputBorderColor, color: modalInputTextColor }]}
              placeholder={t(language, 'exerciseTagsPlaceholder')}
              placeholderTextColor={inputPlaceholderColor}
              value={exerciseTags}
              onChangeText={setExerciseTags}
              autoCapitalize="characters"
              returnKeyType="done"
              onSubmitEditing={handleConfirm}
            />
            <Text style={[styles.inputHint, { color: modalSecondaryTextColor }]}>{t(language, 'exerciseTagsHint')}</Text>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.secondaryButton} onPress={closeModal}>
                <Text style={[styles.secondaryButtonText, { color: modalSecondaryTextColor }]}>{t(language, 'cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primarySmallButton, { backgroundColor: tone.accent, borderColor: toRgba(tone.accent, isLightTheme ? 0.28 : 0.32) }]}
                onPress={handleConfirm}
              >
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
    marginBottom: SPACING.md,
  },
  headerPanel: {
    paddingTop: SPACING.xs,
    paddingBottom: SPACING.sm,
  },
  backButton: {
    minHeight: 36,
    minWidth: 96,
    alignSelf: 'flex-start',
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
  },
  back: {
    fontSize: TEXT.sm,
    fontWeight: '700',
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
    marginTop: SPACING.sm,
    flex: 1,
    minHeight: 0,
  },
  moveBanner: {
    marginTop: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#3B82F6',
    backgroundColor: 'rgba(37, 99, 235, 0.12)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  moveBannerText: {
    color: '#DBEAFE',
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
    overflow: 'hidden',
  },
  stickyBarBorder: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 1,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
  },
  stickyButton: {
    marginVertical: 0,
    backgroundColor: COLORS.blue2,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.78)',
    justifyContent: 'flex-end',
  },
  sheetCard: {
    backgroundColor: '#030C1A',
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.26)',
    padding: SPACING.lg,
    gap: 0,
  },
  sheetTitle: {
    color: '#F9FAFB',
    fontSize: TEXT.lg,
    fontWeight: '800',
    marginBottom: SPACING.sm,
  },
  sheetTitleWrap: {
    marginBottom: SPACING.sm,
  },
  sheetTitleMeta: {
    fontSize: TEXT.sm,
    fontWeight: '700',
    marginTop: 2,
  },
  sheetSubtitle: {
    color: 'rgba(203, 213, 225, 0.7)',
    fontSize: TEXT.sm,
    marginBottom: SPACING.sm,
  },
  sheetAction: {
    minHeight: 50,
    justifyContent: 'center',
    paddingVertical: SPACING.sm + 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(148, 163, 184, 0.24)',
  },
  sheetActionText: {
    color: '#E2E8F0',
    fontSize: TEXT.sm,
    fontWeight: '700',
  },
  sheetActionDanger: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(248, 113, 113, 0.38)',
  },
  sheetActionDangerText: {
    color: COLORS.warning,
  },
  groupGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginVertical: SPACING.sm,
  },
  groupButton: {
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    width: '48%',
    minHeight: 52,
    justifyContent: 'center',
  },
  groupText: {
    color: '#E5E7EB',
    fontWeight: '700',
  },

  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.82)',
    justifyContent: 'center',
    paddingHorizontal: SCREEN_PADDING,
  },
  modalCard: {
    backgroundColor: '#030C1A',
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.28)',
  },
  modalTitle: {
    color: '#F9FAFB',
    fontSize: TEXT.lg,
    fontWeight: '800',
    marginBottom: SPACING.md,
  },
  inputLabel: {
    color: 'rgba(226, 232, 240, 0.9)',
    fontSize: TEXT.sm,
    marginBottom: SPACING.xs,
  },
  inputLabelOptional: {
    color: COLORS.textSecondaryGray,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.26)',
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
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.32)',
  },
  primarySmallButtonText: {
    color: '#F9FAFB',
    fontSize: TEXT.sm,
    fontWeight: '700',
  },
});
