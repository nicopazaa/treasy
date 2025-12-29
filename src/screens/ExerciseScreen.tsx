import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppLanguage } from '../shared/types';
import { Exercise, SetEntry, CardioEntry } from '../features/workouts/model/types';
import { LabeledInput } from '../shared/ui/LabeledInput';
import { PrimaryButton } from '../shared/ui/PrimaryButton';
import { UndoToast } from '../shared/ui/UndoToast';
import { getBlockTone } from '../shared/theme/blockTone';
import { formatRelativeDateTime, formatRelativeDayLabel, formatShortDate } from '../shared/utils/dateLabels';
import { SPACING, TEXT, RADIUS, SCREEN_PADDING, COLORS } from '../shared/theme/tokens';
import { t } from '../shared/i18n/i18n';
import { formatExerciseLabel } from '../shared/utils/exerciseLabel';
import { Surface } from '../shared/ui/Surface';

interface Props {
  language: AppLanguage;
  exercise: Exercise;
  sets: SetEntry[];
  cardioEntries?: CardioEntry[];
  onBack: () => void;
  onAddSet: (weight: number, reps: number) => void;
  onAddCardio?: (options: { durationMin: number | null; distanceKm: number | null; heartRate?: number | null; intensity?: 'easy' | 'moderate' | 'hard' | null }) => void;
  onUpdateSet: (setId: string, weight: number, reps: number) => void;
  onDeleteSet: (setId: string) => void;
  onRestoreSet: (set: SetEntry) => void;
  onAskAIForExercise: () => void;
}

const STICKY_HEIGHT = 88;

export const ExerciseScreen: React.FC<Props> = ({
  language,
  exercise,
  sets,
  onBack,
  onAddSet,
  onUpdateSet,
  onDeleteSet,
  onRestoreSet,
  onAskAIForExercise,
  cardioEntries = [],
  onAddCardio,
}) => {
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [durationMin, setDurationMin] = useState(10);
  const [durationHour, setDurationHour] = useState(0);
  const [distance, setDistance] = useState('');
  const [heartRate, setHeartRate] = useState('');
  const [intensity, setIntensity] = useState<'easy' | 'moderate' | 'hard' | null>(null);
  const [editingSet, setEditingSet] = useState<SetEntry | null>(null);
  const [editWeight, setEditWeight] = useState('');
  const [editReps, setEditReps] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [setActions, setSetActions] = useState<SetEntry | null>(null);
  const [deletedSet, setDeletedSet] = useState<SetEntry | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tone = getBlockTone(exercise.blockId);
  const isCardio = exercise.blockId === 'cardio';

  const lastSet = sets[0] ?? null;
  const lastSetLabel = useMemo(() => {
    if (!lastSet) return null;
    const dt = new Date(lastSet.createdAt);
    return formatRelativeDayLabel(dt, new Date(), language) ?? formatShortDate(dt);
  }, [language, lastSet]);

  useEffect(
    () => () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    },
    []
  );

  const handleAdd = () => {
    if (isCardio) {
      const totalMinutes = durationHour * 60 + durationMin;
      const km = distance.trim() ? Number(distance.replace(',', '.')) : null;
      const hr = heartRate.trim() ? Number(heartRate.replace(',', '.')) : null;
      if (onAddCardio) {
        onAddCardio({ durationMin: totalMinutes, distanceKm: km, heartRate: hr, intensity });
      }
      return;
    }
    const weightText = weight.trim();
    const repsText = reps.trim();
    if (!weightText || !repsText) return;

    const w = Number(weightText.replace(',', '.'));
    const r = Number(repsText);
    if (!Number.isFinite(w) || !Number.isFinite(r) || w < 0 || r <= 0) return;

    onAddSet(w, r);
    setWeight('');
    setReps('');
  };

  const openEditSet = (set: SetEntry) => {
    setSetActions(null);
    setEditingSet(set);
    setEditWeight(String(set.weight));
    setEditReps(String(set.reps));
    setEditError(null);
  };

  const closeEditSet = () => {
    setEditingSet(null);
    setEditError(null);
  };

  const handleUpdateSet = () => {
    if (!editingSet) return;

    const weightText = editWeight.trim();
    const repsText = editReps.trim();
    const w = Number(weightText.replace(',', '.'));
    const r = Number(repsText);

    if (!weightText || !repsText || !Number.isFinite(w) || !Number.isFinite(r) || w < 0 || r <= 0) {
      setEditError(t(language, 'invalidWeightReps'));
      return;
    }

    onUpdateSet(editingSet.id, w, r);
    closeEditSet();
  };

  const handleDeleteSet = (set: SetEntry) => {
    if (editingSet?.id === set.id) {
      closeEditSet();
    }
    onDeleteSet(set.id);
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setDeletedSet(set);
    undoTimerRef.current = setTimeout(() => setDeletedSet(null), 4500);
  };

  const undoDeleteSet = () => {
    if (!deletedSet) return;
    onRestoreSet(deletedSet);
    setDeletedSet(null);
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
  };

  const openSetActions = (set: SetEntry) => {
    setSetActions(set);
  };

  const closeSetActions = () => setSetActions(null);

  const handleCopyLastSet = () => {
    if (!lastSet || isCardio) return;
    setWeight(String(lastSet.weight));
    setReps(String(lastSet.reps));
  };

  const header = (
    <ExerciseListHeader
      language={language}
      toneAccent={tone.accent}
      lastSet={lastSet}
      lastSetLabel={lastSetLabel}
      weight={weight}
      reps={reps}
      durationHour={durationHour}
      durationMin={durationMin}
      distance={distance}
      heartRate={heartRate}
      intensity={intensity}
      isCardio={isCardio}
      onChangeWeight={setWeight}
      onChangeReps={setReps}
      onChangeHour={setDurationHour}
      onChangeMinute={setDurationMin}
      onChangeDistance={setDistance}
      onChangeHeartRate={setHeartRate}
      onChangeIntensity={setIntensity}
      onCopyLastSet={handleCopyLastSet}
      onAskAIForExercise={onAskAIForExercise}
    />
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <TouchableOpacity onPress={onBack} hitSlop={12} style={styles.backButton} activeOpacity={0.8}>
          <Text style={styles.back}>{t(language, 'back')}</Text>
        </TouchableOpacity>

        <Text style={[styles.title, { color: tone.accent }]}>{formatExerciseLabel(exercise)}</Text>
      </View>

      <FlatList
        data={sets}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={header}
        contentContainerStyle={[styles.listContent, styles.listPadding]}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <View style={styles.setRow}>
            <TouchableOpacity style={styles.setInfo} onPress={() => openEditSet(item)} activeOpacity={0.85}>
              <Text style={styles.setText}>
                {item.weight} kg x {item.reps} {t(language, 'reps').toLowerCase()}
              </Text>
              <Text style={styles.setDate}>{formatRelativeDateTime(new Date(item.createdAt), new Date(), language)}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.setKebab}
              onPress={(event) => {
                event.stopPropagation?.();
                openSetActions(item);
              }}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              activeOpacity={0.85}
            >
              <Text style={styles.kebabText}>{'⋯'}</Text>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>{t(language, 'noSetsYet')}</Text>}
      />

      <Modal
        visible={Boolean(setActions)}
        animationType="fade"
        transparent
        onRequestClose={closeSetActions}
      >
        <Pressable style={styles.sheetBackdrop} onPress={closeSetActions}>
          <Pressable style={styles.sheetCard} onPress={() => {}}>
            <Text style={styles.sheetTitle}>
              {setActions ? `${setActions.weight} kg x ${setActions.reps}` : ''}
            </Text>
            <TouchableOpacity
              style={styles.sheetAction}
              onPress={() => {
                const target = setActions;
                closeSetActions();
                if (target) openEditSet(target);
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.sheetActionText}>{t(language, 'edit')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sheetAction, styles.sheetActionDanger]}
              onPress={() => {
                const target = setActions;
                closeSetActions();
                if (target) handleDeleteSet(target);
              }}
              activeOpacity={0.85}
            >
              <Text style={[styles.sheetActionText, styles.sheetActionDangerText]}>{t(language, 'delete')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sheetAction} onPress={closeSetActions} activeOpacity={0.85}>
              <Text style={styles.sheetActionText}>{t(language, 'cancel')}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <View pointerEvents="box-none" style={styles.toastContainer}>
        <UndoToast
          visible={Boolean(deletedSet)}
          message={t(language, 'toast.setDeleted')}
          actionLabel={t(language, 'undo')}
          onAction={undoDeleteSet}
        />
      </View>

      <View style={styles.stickyBar}>
        <PrimaryButton title={t(language, 'logSet')} onPress={handleAdd} style={styles.stickyButton} />
      </View>

      <Modal visible={Boolean(editingSet)} animationType="fade" transparent onRequestClose={closeEditSet}>
        <KeyboardAvoidingView style={styles.modalContainer} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t(language, 'editSetTitle')}</Text>
            <Text style={styles.modalSubtitle}>{t(language, 'editSetSubtitle')}</Text>

            <LabeledInput
              label={t(language, 'weightKg')}
              placeholder="0"
              keyboardType="numeric"
              value={editWeight}
              onChangeText={setEditWeight}
              style={styles.inputField}
            />
            <LabeledInput
              label={t(language, 'reps')}
              placeholder="1"
              keyboardType="numeric"
              value={editReps}
              onChangeText={setEditReps}
              style={styles.inputField}
            />

            {editError ? <Text style={styles.error}>{editError}</Text> : null}

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.secondaryButton} onPress={closeEditSet}>
                <Text style={styles.secondaryButtonText}>{t(language, 'cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primarySmallButton} onPress={handleUpdateSet}>
                <Text style={styles.primarySmallButtonText}>{t(language, 'save')}</Text>
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
    fontSize: TEXT.xl,
    fontWeight: '700',
    color: '#F9FAFB',
  },
  inputCard: {
    marginTop: SPACING.lg,
    padding: SPACING.md,
  },
  inputField: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: '#0B1220',
  },
  lastSetRow: {
    marginBottom: SPACING.sm,
  },
  lastSetText: {
    color: '#E5E7EB',
    fontSize: TEXT.sm,
    marginBottom: SPACING.xs,
  },
  copyRow: {
    marginTop: SPACING.sm,
  },
  copyLink: {
    color: '#60A5FA',
    fontSize: TEXT.xs,
    fontWeight: '700',
  },
  copyLinkDisabled: {
    color: COLORS.neutral,
  },
  aiBox: {
    marginTop: SPACING.lg,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  aiTitle: {
    color: '#F9FAFB',
    fontWeight: '700',
    marginBottom: SPACING.xs,
  },
  aiText: {
    color: '#9CA3AF',
    marginBottom: SPACING.sm,
    fontSize: TEXT.sm,
  },
  historyTitle: {
    marginTop: SPACING.xl,
    marginBottom: SPACING.sm,
    color: '#E5E7EB',
    fontSize: TEXT.md,
    fontWeight: '700',
  },
  listContent: {
    paddingBottom: STICKY_HEIGHT + SPACING.lg,
  },
  listPadding: {
    paddingHorizontal: SCREEN_PADDING,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    minHeight: 52,
  },
  setInfo: {
    flex: 1,
    paddingRight: SPACING.md,
  },
  setKebab: {
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
    color: '#9CA3AF',
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 22,
    marginTop: -2,
  },
  setText: {
    color: '#E5E7EB',
    fontSize: TEXT.sm,
    fontWeight: '600',
  },
  setDate: {
    color: '#9CA3AF',
    fontSize: TEXT.xs,
    marginTop: 2,
  },
  empty: {
    color: '#9CA3AF',
    marginTop: SPACING.sm,
    fontSize: TEXT.sm,
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
  toastContainer: {
    position: 'absolute',
    left: SCREEN_PADDING,
    right: SCREEN_PADDING,
    bottom: STICKY_HEIGHT + SPACING.sm,
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
  },
  modalSubtitle: {
    color: '#9CA3AF',
    fontSize: TEXT.sm,
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

type ExerciseListHeaderProps = {
  language: AppLanguage;
  toneAccent: string;
  lastSet: SetEntry | null;
  lastSetLabel: string | null;
  weight: string;
  reps: string;
  onChangeWeight: (value: string) => void;
  onChangeReps: (value: string) => void;
  onCopyLastSet: () => void;
  onAskAIForExercise: () => void;
};

const ExerciseListHeader: React.FC<ExerciseListHeaderProps> = ({
  language,
  toneAccent,
  lastSet,
  lastSetLabel,
  weight,
  reps,
  onChangeWeight,
  onChangeReps,
  onCopyLastSet,
  onAskAIForExercise,
}) => {
  return (
    <View>
      <Surface style={styles.inputCard}>
        {lastSet ? (
          <View style={styles.lastSetRow}>
            <Text style={styles.lastSetText}>
              {t(language, 'last')}: {lastSet.weight} kg x {lastSet.reps} ({lastSetLabel})
            </Text>
          </View>
        ) : null}

        <LabeledInput
          label={t(language, 'weightKg')}
          placeholder="0"
          keyboardType="numeric"
          value={weight}
          onChangeText={onChangeWeight}
          style={styles.inputField}
        />
        <LabeledInput
          label={t(language, 'reps')}
          placeholder="1"
          keyboardType="numeric"
          value={reps}
          onChangeText={onChangeReps}
          style={styles.inputField}
        />

        <TouchableOpacity
          onPress={onCopyLastSet}
          disabled={!lastSet}
          hitSlop={8}
          style={styles.copyRow}
          activeOpacity={0.85}
        >
          <Text style={[styles.copyLink, !lastSet && styles.copyLinkDisabled]}>
            {t(language, 'copyPreviousSet')}
          </Text>
        </TouchableOpacity>
      </Surface>

      <Surface style={styles.aiBox} variant="raised">
        <Text style={styles.aiTitle}>{t(language, 'aiSearchTitle')}</Text>
        <Text style={styles.aiText}>{t(language, 'aiSearchHint')}</Text>
        <PrimaryButton title={t(language, 'search')} onPress={onAskAIForExercise} />
      </Surface>

      <Text style={styles.historyTitle}>{t(language, 'history')}</Text>
    </View>
  );
};
