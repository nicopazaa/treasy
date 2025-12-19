import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  Pressable,
} from 'react-native';
import { AppState, TrainingBlockId } from '../types';
import { PrimaryButton } from '../components/PrimaryButton';
import { getBlockTone } from '../utils/blockTone';
import { SPACING, TEXT, RADIUS } from '../theme/tokens';
import { blockLabel, t } from '../i18n/i18n';

type Props = {
  appState: AppState;
  onBack: () => void;
  onSave: (text: string) => { newExerciseId?: string; newExerciseName?: string };
  onCategorizeExercise: (exerciseId: string, blockId: TrainingBlockId) => void;
  showLocalOnlyNotice?: boolean;
};

const MUSCLE_GROUPS: TrainingBlockId[] = [
  'chest',
  'shoulders',
  'back',
  'arms',
  'core',
  'legs',
  'cardio',
];

export const QuickLogScreen: React.FC<Props> = ({
  appState,
  onBack,
  onSave,
  onCategorizeExercise,
  showLocalOnlyNotice = false,
}) => {
  const language = appState.language ?? 'en';
  const [input, setInput] = useState('');
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [pendingExercise, setPendingExercise] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const inputRef = useRef<TextInput | null>(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, []);

  const handleSave = () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    const res = onSave(trimmed);
    setInput('');
    setSavedNotice(t(language, 'quickLogSaved'));

    if (res.newExerciseId && res.newExerciseName) {
      setPendingExercise({ id: res.newExerciseId, name: res.newExerciseName });
    }

    setTimeout(() => setSavedNotice(null), 1600);
    setTimeout(() => inputRef.current?.focus(), 120);
  };

  const showLocalNoticeLine = showLocalOnlyNotice && appState.authProvider === 'guest';

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onBack} hitSlop={8}>
        <Text style={styles.back}>{'< Tilbake'}</Text>
      </TouchableOpacity>

      {showLocalNoticeLine ? (
        <Text style={styles.localOnlyNotice}>
          {t(language, 'localOnlyNotice')}
        </Text>
      ) : null}

      <View style={styles.inputCard}>
        <TextInput
          ref={inputRef}
          style={styles.input}
          placeholder={t(language, 'quickLogPlaceholder')}
          placeholderTextColor="#6B7280"
          value={input}
          onChangeText={setInput}
          autoCapitalize="sentences"
          multiline
          autoFocus
          returnKeyType="done"
          onSubmitEditing={handleSave}
          blurOnSubmit={false}
        />
      </View>

      {savedNotice ? <Text style={styles.savedNotice}>{savedNotice}</Text> : null}

      <View style={styles.actionBar}>
        <PrimaryButton title={t(language, 'quickLogButton')} onPress={handleSave} />
      </View>

      <Modal visible={pendingExercise !== null} transparent animationType="fade">
        <Pressable style={styles.sheetBackdrop} onPress={() => setPendingExercise(null)}>
          <Pressable style={styles.sheetCard} onPress={() => {}}>
            <Text style={styles.sheetTitle}>
              {t(language, 'newExerciseFound', { name: pendingExercise?.name ?? '' })}
            </Text>
            <Text style={styles.sheetSubtitle}>{t(language, 'chooseMuscleGroup')}</Text>

            <View style={styles.groupGrid}>
              {MUSCLE_GROUPS.map((groupId) => {
                const tone = getBlockTone(groupId);
                return (
                  <TouchableOpacity
                    key={groupId}
                    style={[
                      styles.groupButton,
                      { borderColor: tone.accent, backgroundColor: tone.soft },
                    ]}
                    activeOpacity={0.9}
                    onPress={() => {
                      if (pendingExercise) {
                        onCategorizeExercise(pendingExercise.id, groupId);
                      }
                      setPendingExercise(null);
                      setTimeout(() => inputRef.current?.focus(), 120);
                    }}
                  >
                    <Text style={[styles.groupText, { color: tone.accent }]}>
                      {blockLabel(groupId, language)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
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
  },
  back: {
    color: '#93C5FD',
    marginBottom: SPACING.sm,
    fontSize: TEXT.sm,
    fontWeight: '600',
  },
  localOnlyNotice: {
    color: '#9CA3AF',
    fontSize: TEXT.xs,
    marginBottom: SPACING.md,
  },
  inputCard: {
    backgroundColor: '#0B1220',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: SPACING.md,
  },
  input: {
    minHeight: 140,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#111827',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    color: '#F9FAFB',
    fontSize: TEXT.md,
    backgroundColor: '#020617',
  },
  savedNotice: {
    marginTop: SPACING.sm,
    color: '#86EFAC',
    fontSize: TEXT.sm,
  },
  actionBar: {
    marginTop: SPACING.md,
  },

  // Bottom sheet
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
    padding: SPACING.xl,
  },
  sheetTitle: {
    color: '#F9FAFB',
    fontSize: TEXT.md,
    fontWeight: '700',
    marginBottom: SPACING.xs,
  },
  sheetSubtitle: {
    color: '#9CA3AF',
    fontSize: TEXT.sm,
    marginBottom: SPACING.md,
  },
  groupGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  groupButton: {
    flexBasis: '48%',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    minHeight: 48,
    justifyContent: 'center',
  },
  groupText: {
    fontSize: TEXT.sm,
    fontWeight: '700',
  },
});
