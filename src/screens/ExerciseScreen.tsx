import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Alert,
  SafeAreaView,
} from 'react-native';
import { AppLanguage } from '../shared/types';
import { Exercise, SetEntry } from '../features/workouts/model/types';
import { LabeledInput } from '../shared/ui/LabeledInput';
import { PrimaryButton } from '../shared/ui/PrimaryButton';
import { getBlockTone } from '../shared/theme/blockTone';
import { formatRelativeDateTime, formatRelativeDayLabel, formatShortDate } from '../shared/utils/dateLabels';
import { SPACING, TEXT, RADIUS } from '../shared/theme/tokens';
import { t } from '../shared/i18n/i18n';

interface Props {
  language: AppLanguage;
  exercise: Exercise;
  sets: SetEntry[];
  onBack: () => void;
  onAddSet: (weight: number, reps: number) => void;
  onUpdateSet: (setId: string, weight: number, reps: number) => void;
  onDeleteSet: (setId: string) => void;
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
  onAskAIForExercise,
}) => {
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [editingSet, setEditingSet] = useState<SetEntry | null>(null);
  const [editWeight, setEditWeight] = useState('');
  const [editReps, setEditReps] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const tone = getBlockTone(exercise.blockId);

  const lastSet = sets[0] ?? null;
  const lastSetLabel = useMemo(() => {
    if (!lastSet) return null;
    const dt = new Date(lastSet.createdAt);
    return formatRelativeDayLabel(dt, new Date(), language) ?? formatShortDate(dt);
  }, [language, lastSet]);

  const handleAdd = () => {
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

  const confirmDeleteSet = (set: SetEntry) => {
    Alert.alert(
      t(language, 'deleteSetTitle'),
      t(language, 'deleteSetBody', { weight: set.weight, reps: set.reps }),
      [
        { text: t(language, 'cancel'), style: 'cancel' },
        { text: t(language, 'delete'), style: 'destructive', onPress: () => onDeleteSet(set.id) },
      ]
    );
  };

  const openSetActions = (set: SetEntry) => {
    Alert.alert(`${set.weight} kg x ${set.reps}`, '', [
      { text: t(language, 'edit'), onPress: () => openEditSet(set) },
      { text: t(language, 'delete'), style: 'destructive', onPress: () => confirmDeleteSet(set) },
      { text: t(language, 'cancel'), style: 'cancel' },
    ]);
  };

  const handleCopyLastSet = () => {
    if (!lastSet) return;
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
      onChangeWeight={setWeight}
      onChangeReps={setReps}
      onCopyLastSet={handleCopyLastSet}
      onAskAIForExercise={onAskAIForExercise}
    />
  );

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity onPress={onBack} hitSlop={12} style={styles.backButton} activeOpacity={0.8}>
        <Text style={styles.back}>{t(language, 'back')}</Text>
      </TouchableOpacity>

      <Text style={[styles.title, { color: tone.accent }]}>{exercise.name}</Text>

      <FlatList
        data={sets}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={header}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.setRow} onLongPress={() => openSetActions(item)} activeOpacity={0.9}>
            <View style={styles.setInfo}>
              <Text style={styles.setText}>
                {item.weight} kg x {item.reps} {t(language, 'reps').toLowerCase()}
              </Text>
              <Text style={styles.setDate}>{formatRelativeDateTime(new Date(item.createdAt), new Date(), language)}</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.empty}>{t(language, 'noSetsYet')}</Text>}
      />

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
            />
            <LabeledInput
              label={t(language, 'reps')}
              placeholder="1"
              keyboardType="numeric"
              value={editReps}
              onChangeText={setEditReps}
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
    paddingHorizontal: Platform.OS === 'web' ? SPACING.xxxl : SPACING.xxl,
    paddingTop: Platform.OS === 'ios' ? SPACING.sm : SPACING.xxxl,
    paddingBottom: STICKY_HEIGHT,
    ...Platform.select({
      web: { width: '100%', maxWidth: 720, alignSelf: 'center' },
    }),
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
    backgroundColor: '#0B1220',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  lastSetRow: {
    marginBottom: SPACING.sm,
  },
  lastSetText: {
    color: '#E5E7EB',
    fontSize: TEXT.sm,
    marginBottom: SPACING.xs,
  },
  copyLink: {
    color: '#60A5FA',
    fontSize: TEXT.xs,
    fontWeight: '700',
  },
  aiBox: {
    marginTop: SPACING.lg,
    padding: SPACING.md,
    backgroundColor: '#0F172A',
    borderRadius: RADIUS.md,
    borderWidth: 1,
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
  setRow: {
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#111827',
  },
  setInfo: {
    flexShrink: 1,
    paddingRight: SPACING.md,
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
    paddingHorizontal: Platform.OS === 'web' ? SPACING.xxxl : SPACING.xxl,
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
      <View style={styles.inputCard}>
        {lastSet ? (
          <View style={styles.lastSetRow}>
            <Text style={styles.lastSetText}>
              {t(language, 'last')}: {lastSet.weight} kg x {lastSet.reps} ({lastSetLabel})
            </Text>
            <TouchableOpacity onPress={onCopyLastSet} hitSlop={8}>
              <Text style={styles.copyLink}>{t(language, 'copyPreviousSet')}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <LabeledInput
          label={t(language, 'weightKg')}
          placeholder="0"
          keyboardType="numeric"
          value={weight}
          onChangeText={onChangeWeight}
        />
        <LabeledInput
          label={t(language, 'reps')}
          placeholder="1"
          keyboardType="numeric"
          value={reps}
          onChangeText={onChangeReps}
        />
      </View>

      <View style={[styles.aiBox, { borderColor: toneAccent }]}>
        <Text style={styles.aiTitle}>{t(language, 'aiSearchTitle')}</Text>
        <Text style={styles.aiText}>{t(language, 'aiSearchHint')}</Text>
        <PrimaryButton title={t(language, 'search')} onPress={onAskAIForExercise} />
      </View>

      <Text style={styles.historyTitle}>{t(language, 'history')}</Text>
    </View>
  );
};
