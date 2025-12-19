import React, { useState } from 'react';
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
} from 'react-native';
import { Exercise, SetEntry } from '../types';
import { LabeledInput } from '../components/LabeledInput';
import { PrimaryButton } from '../components/PrimaryButton';
import { getBlockTone } from '../utils/blockTone';
import {
  formatRelativeDateTime,
  formatRelativeDayLabel,
  formatShortDate,
} from '../utils/dateLabels';
import { SPACING, TEXT, RADIUS } from '../theme/tokens';

interface Props {
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
  const lastSetLabel = lastSet
    ? formatRelativeDayLabel(new Date(lastSet.createdAt)) ?? formatShortDate(new Date(lastSet.createdAt))
    : null;

  const handleAdd = () => {
    const weightText = weight.trim();
    const repsText = reps.trim();
    if (!weightText || !repsText) {
      return;
    }
    const w = Number(weightText.replace(',', '.'));
    const r = Number(repsText);
    if (!Number.isFinite(w) || !Number.isFinite(r) || w < 0 || r <= 0) {
      return;
    }
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
    if (!weightText || !repsText) {
      setEditError('Skriv inn vekt og reps.');
      return;
    }
    const w = Number(weightText.replace(',', '.'));
    const r = Number(repsText);
    if (!Number.isFinite(w) || !Number.isFinite(r) || w < 0 || r <= 0) {
      setEditError('Ugyldig vekt eller reps.');
      return;
    }
    onUpdateSet(editingSet.id, w, r);
    closeEditSet();
  };

  const confirmDeleteSet = (set: SetEntry) => {
    Alert.alert(
      'Slett sett?',
      `Vil du slette ${set.weight} kg x ${set.reps} reps?`,
      [
        { text: 'Avbryt', style: 'cancel' },
        { text: 'Slett', style: 'destructive', onPress: () => onDeleteSet(set.id) },
      ]
    );
  };

  const handleCopyLastSet = () => {
    if (!lastSet) return;
    setWeight(String(lastSet.weight));
    setReps(String(lastSet.reps));
  };

  const renderHeader = () => (
    <View>
      <View style={styles.inputCard}>
        {lastSet ? (
          <View style={styles.lastSetRow}>
            <Text style={styles.lastSetText}>
              Sist: {lastSet.weight} kg x {lastSet.reps} ({lastSetLabel})
            </Text>
            <TouchableOpacity onPress={handleCopyLastSet} hitSlop={8}>
              <Text style={styles.copyLink}>Kopier forrige sett</Text>
            </TouchableOpacity>
          </View>
        ) : null}
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
      </View>

      <View style={[styles.aiBox, { borderColor: tone.accent }]}>
        <Text style={styles.aiTitle}>Treasy AI for {exercise.name}</Text>
        <Text style={styles.aiText}>FA raskt svar pA hva du tok sist i denne A,velsen.</Text>
        <PrimaryButton title="SpA,r AI for denne A,velsen" onPress={onAskAIForExercise} />
      </View>

      <Text style={styles.historyTitle}>Historikk</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.back}>{'< Tilbake'}</Text>
      </TouchableOpacity>
      <Text style={[styles.title, { color: tone.accent }]}>{exercise.name}</Text>
      <Text style={styles.subtitle}>Logg sett og se historikk for denne A,velsen.</Text>

      <FlatList
        data={sets}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.setRow}>
            <View style={styles.setInfo}>
              <Text style={styles.setText}>
                {item.weight} kg x {item.reps} reps
              </Text>
              <Text style={styles.setDate}>
                {formatRelativeDateTime(new Date(item.createdAt))}
              </Text>
            </View>
            <View style={styles.setActions}>
              <TouchableOpacity onPress={() => openEditSet(item)} hitSlop={8}>
                <Text style={styles.setActionText}>Endre</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => confirmDeleteSet(item)} hitSlop={8}>
                <Text style={[styles.setActionText, styles.setDeleteText]}>Slett</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <Text style={styles.empty}>Ingen sett logget enda. Legg til ditt fA,rste sett.</Text>
        }
      />

      <View style={styles.stickyBar}>
        <PrimaryButton
          title="Logg sett"
          onPress={handleAdd}
          style={styles.stickyButton}
        />
      </View>

      <Modal
        visible={editingSet !== null}
        animationType="fade"
        transparent
        onRequestClose={closeEditSet}
      >
        <KeyboardAvoidingView
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Endre sett</Text>
            <Text style={styles.modalSubtitle}>Juster vekt og reps for settet.</Text>

            <LabeledInput
              label="Vekt (kg)"
              placeholder="F.eks. 80"
              keyboardType="numeric"
              value={editWeight}
              onChangeText={setEditWeight}
            />
            <LabeledInput
              label="Reps"
              placeholder="F.eks. 5"
              keyboardType="numeric"
              value={editReps}
              onChangeText={setEditReps}
            />

            {editError ? <Text style={styles.error}>{editError}</Text> : null}

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.secondaryButton} onPress={closeEditSet}>
                <Text style={styles.secondaryButtonText}>Avbryt</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primarySmallButton} onPress={handleUpdateSet}>
                <Text style={styles.primarySmallButtonText}>Lagre</Text>
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
    fontSize: TEXT.xl,
    fontWeight: '700',
    color: '#F9FAFB',
  },
  subtitle: {
    marginTop: SPACING.xs,
    color: '#9CA3AF',
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
    fontWeight: '600',
  },
  aiBox: {
    marginTop: SPACING.lg,
    padding: SPACING.md,
    backgroundColor: '#0F172A',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  aiTitle: {
    color: '#F9FAFB',
    fontWeight: '600',
    marginBottom: SPACING.xs,
  },
  aiText: {
    color: '#9CA3AF',
    marginBottom: SPACING.sm,
  },
  historyTitle: {
    marginTop: SPACING.xl,
    marginBottom: SPACING.sm,
    color: '#E5E7EB',
    fontSize: TEXT.md,
    fontWeight: '600',
  },
  listContent: {
    paddingBottom: STICKY_HEIGHT + SPACING.lg,
  },
  setRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
  },
  setDate: {
    color: '#6B7280',
    fontSize: TEXT.xs,
  },
  setActions: {
    flexDirection: 'row',
    gap: SPACING.md,
    alignItems: 'center',
  },
  setActionText: {
    color: '#E5E7EB',
    fontSize: TEXT.xs,
    fontWeight: '600',
  },
  setDeleteText: {
    color: '#F87171',
  },
  empty: {
    color: '#6B7280',
    marginTop: SPACING.sm,
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
