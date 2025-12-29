import React, { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  Pressable,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppLanguage } from '../shared/types';
import { AppState, Exercise, LogEntry, TrainingBlock, TrainingBlockId } from '../features/workouts/model/types';
import { PrimaryButton } from '../shared/ui/PrimaryButton';
import { QuickKeypad } from '../shared/ui/QuickKeypad';
import { getBlockTone } from '../shared/theme/blockTone';
import { SPACING, TEXT, RADIUS, SCREEN_PADDING } from '../shared/theme/tokens';
import { blockLabel, t } from '../shared/i18n/i18n';
import { formatExerciseLabel } from '../shared/utils/exerciseLabel';

type Props = {
  appState: AppState;
  onBack: () => void;
  onSave: (text: string, options?: { blockId?: string | null }) => {
    newExerciseId?: string;
    newExerciseName?: string;
  };
  onLogSet: (exerciseId: string, weight: number, reps: number) => void;
  onCategorizeExercise: (exerciseId: string, blockId: TrainingBlockId) => void;
  showLocalOnlyNotice?: boolean;
};

const MUSCLE_GROUP_ORDER: TrainingBlockId[] = ['chest', 'shoulders', 'back', 'arms', 'core', 'legs'];

const WEIGHT_KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  [',', '0', '⌫'],
];

const REPS_KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['0', '⌫'],
];

export const QuickLogScreen: React.FC<Props> = ({
  appState,
  onBack,
  onSave,
  onLogSet,
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

  const [muscleGroupsOpen, setMuscleGroupsOpen] = useState(true);
  const [exercisesOpen, setExercisesOpen] = useState(false);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [weightModalOpen, setWeightModalOpen] = useState(false);
  const [repsModalOpen, setRepsModalOpen] = useState(false);
  const [weightText, setWeightText] = useState('');
  const [repsText, setRepsText] = useState('');
  const [setError, setSetError] = useState<string | null>(null);

  const muscleGroupBlocks = useMemo(() => {
    const byId: Record<string, TrainingBlock> = {};
    for (const b of appState.blocks) byId[b.id] = b;

    const ordered: TrainingBlock[] = [];
    for (const id of MUSCLE_GROUP_ORDER) {
      const block = byId[id];
      if (block) ordered.push(block);
    }

    const rest = appState.blocks.filter(
      (b) => !MUSCLE_GROUP_ORDER.includes(b.id as TrainingBlockId) && b.id !== 'cardio'
    );

    return [...ordered, ...rest];
  }, [appState.blocks]);

  const selectedBlock = selectedBlockId
    ? muscleGroupBlocks.find((b) => b.id === selectedBlockId) ?? null
    : null;

  const exercisesForBlock: Exercise[] = useMemo(() => {
    if (!selectedBlockId) return [];
    return appState.exercises
      .filter((ex) => ex.blockId === selectedBlockId)
      .slice()
      .sort((a, b) => formatExerciseLabel(a).localeCompare(formatExerciseLabel(b)));
  }, [appState.exercises, selectedBlockId]);

  const selectedExercise = selectedExerciseId
    ? appState.exercises.find((ex) => ex.id === selectedExerciseId) ?? null
    : null;

  const pendingExerciseLabel = useMemo(() => {
    if (!pendingExercise) return '';
    const found = appState.exercises.find((ex) => ex.id === pendingExercise.id);
    if (found) return formatExerciseLabel(found);
    return pendingExercise.name;
  }, [appState.exercises, pendingExercise]);

  const todayLogs: LogEntry[] = useMemo(() => {
    const logs = appState.logs ?? [];
    const todayKey = new Date().toISOString().slice(0, 10);
    return logs
      .filter((l) => (l.createdAt ?? '').slice(0, 10) === todayKey)
      .slice(-30)
      .slice()
      .reverse();
  }, [appState.logs]);

  const formatTime = (iso: string, lang: AppLanguage): string => {
    const locale = lang === 'nb' ? 'nb-NO' : lang === 'es' ? 'es-ES' : 'en-US';
    const dt = new Date(iso);
    if (Number.isNaN(dt.getTime())) return '';
    return dt.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  };

  const blockTitle = (block: TrainingBlock): string => {
    const id = block.id as TrainingBlockId;
    const isKnown = (['chest', 'shoulders', 'back', 'arms', 'core', 'legs'] as string[]).includes(id);
    return isKnown ? blockLabel(id, language) : block.name;
  };

  const flashSaved = () => {
    setSavedNotice(t(language, 'quickLogSaved'));
    setTimeout(() => setSavedNotice(null), 1600);
  };

  const resetSetFlow = () => {
    setWeightText('');
    setRepsText('');
    setSetError(null);
    setWeightModalOpen(false);
    setRepsModalOpen(false);
  };

  const startSetFlow = (exerciseId: string) => {
    setSelectedExerciseId(exerciseId);
    setExercisesOpen(false);
    setWeightText('');
    setRepsText('');
    setSetError(null);
    setWeightModalOpen(true);
  };

  const handleSave = () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    const res = onSave(trimmed, { blockId: selectedBlockId });
    setInput('');
    flashSaved();

    if (res.newExerciseId && res.newExerciseName) {
      setPendingExercise({ id: res.newExerciseId, name: res.newExerciseName });
    }

    setTimeout(() => inputRef.current?.focus(), 120);
  };

  const showLocalNoticeLine = showLocalOnlyNotice && appState.authProvider === 'guest';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <TouchableOpacity onPress={onBack} hitSlop={12} style={styles.backButton} activeOpacity={0.8}>
          <Text style={styles.back}>{'< Tilbake'}</Text>
        </TouchableOpacity>

        {showLocalNoticeLine ? (
          <Text style={styles.localOnlyNotice}>
            {t(language, 'localOnlyNotice')}
          </Text>
        ) : null}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.guidedCard}>
          <Text style={styles.guidedTitle}>{t(language, 'home.quickLog.title')}</Text>
          <Text style={styles.guidedSubtitle}>{t(language, 'quickLogExample')}</Text>

          <View style={styles.selectBox}>
            <TouchableOpacity
              style={styles.selectHeaderRow}
              onPress={() => setMuscleGroupsOpen((v) => !v)}
              activeOpacity={0.8}
            >
              <Text style={styles.selectLabel}>{t(language, 'muscleGroups')}</Text>
              <Text style={styles.selectValue}>
                {selectedBlock ? blockTitle(selectedBlock) : t(language, 'chooseMuscleGroup').replace(/:$/, '')}
              </Text>
              <Text style={styles.chevron}>{muscleGroupsOpen ? 'v' : '>'}</Text>
            </TouchableOpacity>

            {muscleGroupsOpen && (
              <View style={styles.selectList}>
                {muscleGroupBlocks.map((block) => {
                  const tone = getBlockTone(block.id);
                  const selected = block.id === selectedBlockId;
                  return (
                    <TouchableOpacity
                      key={block.id}
                      style={[styles.selectRow, selected && styles.selectRowSelected]}
                      onPress={() => {
                        setSelectedBlockId(block.id);
                        setSelectedExerciseId(null);
                        setExercisesOpen(true);
                        setMuscleGroupsOpen(false);
                      }}
                      activeOpacity={0.9}
                    >
                      <View style={[styles.dot, { backgroundColor: tone.accent }]} />
                      <Text style={styles.selectRowText}>{blockTitle(block)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          <View style={[styles.selectBox, { marginTop: SPACING.md }]}>
            <TouchableOpacity
              style={styles.selectHeaderRow}
              onPress={() => selectedBlockId && setExercisesOpen((v) => !v)}
              activeOpacity={selectedBlockId ? 0.8 : 1}
            >
              <Text style={styles.selectLabel}>{t(language, 'exercises')}</Text>
              <Text style={styles.selectValue}>
                {selectedExercise ? formatExerciseLabel(selectedExercise) : t(language, 'enterExerciseName')}
              </Text>
              <Text style={[styles.chevron, !selectedBlockId && styles.chevronDisabled]}>
                {exercisesOpen ? 'v' : '>'}
              </Text>
            </TouchableOpacity>

            {exercisesOpen && selectedBlockId ? (
              exercisesForBlock.length === 0 ? (
                <Text style={styles.emptyText}>{t(language, 'noExercisesInBlock')}</Text>
              ) : (
                <View style={styles.selectList}>
                  {exercisesForBlock.map((ex) => {
                    const selected = ex.id === selectedExerciseId;
                    return (
                      <TouchableOpacity
                        key={ex.id}
                        style={[styles.selectRow, selected && styles.selectRowSelected]}
                        onPress={() => startSetFlow(ex.id)}
                        activeOpacity={0.9}
                      >
                        <View style={[styles.dot, { backgroundColor: getBlockTone(selectedBlockId).accent }]} />
                        <Text style={styles.selectRowText}>{formatExerciseLabel(ex)}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )
            ) : null}
          </View>
        </View>

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
            returnKeyType="done"
            onSubmitEditing={handleSave}
            blurOnSubmit={false}
          />
        </View>

        {savedNotice ? <Text style={styles.savedNotice}>{savedNotice}</Text> : null}

        <View style={styles.actionBar}>
          <PrimaryButton title={t(language, 'quickLogButton')} onPress={handleSave} />
        </View>

        <View style={styles.liveLogCard}>
          <Text style={styles.liveLogTitle}>{t(language, 'liveLogTitle')}</Text>
          {todayLogs.length === 0 ? (
            <Text style={styles.liveLogEmpty}>{t(language, 'liveLogEmpty')}</Text>
          ) : (
            <View style={styles.liveLogList}>
              {todayLogs.map((entry) => (
                <View key={entry.id} style={styles.liveLogRow}>
                  <Text style={styles.liveLogTime}>{formatTime(entry.createdAt, language)}</Text>
                  <Text style={styles.liveLogText}>{entry.text}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <Modal visible={weightModalOpen} transparent animationType="fade">
        <Pressable style={styles.dialogBackdrop} onPress={resetSetFlow}>
          <Pressable style={styles.dialogCard} onPress={() => {}}>
            <Text style={styles.dialogTitle}>
              {selectedExercise ? formatExerciseLabel(selectedExercise) : ''}
            </Text>
            <Text style={styles.dialogSubtitle}>{t(language, 'weightKg')}</Text>
            <TextInput
              style={styles.dialogInput}
              placeholder="0"
              placeholderTextColor="#6B7280"
              value={weightText}
              onChangeText={setWeightText}
              keyboardType="numeric"
            />
            <QuickKeypad value={weightText} onChange={setWeightText} rows={WEIGHT_KEYS} />

            {setError ? <Text style={styles.error}>{setError}</Text> : null}

            <View style={styles.dialogButtons}>
              <TouchableOpacity style={styles.secondaryButton} onPress={resetSetFlow}>
                <Text style={styles.secondaryButtonText}>{t(language, 'cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.primarySmallButton}
                onPress={() => {
                  const w = Number(weightText.trim().replace(',', '.'));
                  if (!Number.isFinite(w) || w < 0) {
                    setSetError(t(language, 'invalidWeightReps'));
                    return;
                  }
                  setSetError(null);
                  setWeightModalOpen(false);
                  setRepsModalOpen(true);
                }}
              >
                <Text style={styles.primarySmallButtonText}>{t(language, 'continue')}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={repsModalOpen} transparent animationType="fade">
        <Pressable style={styles.dialogBackdrop} onPress={resetSetFlow}>
          <Pressable style={styles.dialogCard} onPress={() => {}}>
            <Text style={styles.dialogTitle}>
              {selectedExercise ? formatExerciseLabel(selectedExercise) : ''}
            </Text>
            <Text style={styles.dialogSubtitle}>{t(language, 'reps')}</Text>
            <TextInput
              style={styles.dialogInput}
              placeholder="1"
              placeholderTextColor="#6B7280"
              value={repsText}
              onChangeText={setRepsText}
              keyboardType="numeric"
            />
            <QuickKeypad value={repsText} onChange={setRepsText} rows={REPS_KEYS} />

            {setError ? <Text style={styles.error}>{setError}</Text> : null}

            <View style={styles.dialogButtons}>
              <TouchableOpacity style={styles.secondaryButton} onPress={resetSetFlow}>
                <Text style={styles.secondaryButtonText}>{t(language, 'cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.primarySmallButton}
                onPress={() => {
                  const w = Number(weightText.trim().replace(',', '.'));
                  const r = Number(repsText.trim());
                  if (!Number.isFinite(w) || !Number.isFinite(r) || w < 0 || r <= 0) {
                    setSetError(t(language, 'invalidWeightReps'));
                    return;
                  }
                  if (selectedExercise) {
                    onLogSet(selectedExercise.id, w, r);
                    flashSaved();
                  }
                  resetSetFlow();
                }}
              >
                <Text style={styles.primarySmallButtonText}>{t(language, 'logSet')}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={pendingExercise !== null} transparent animationType="fade">
        <Pressable style={styles.sheetBackdrop} onPress={() => setPendingExercise(null)}>
          <Pressable style={styles.sheetCard} onPress={() => {}}>
            <Text style={styles.sheetTitle}>
              {t(language, 'newExerciseFound', { name: pendingExerciseLabel })}
            </Text>
            <Text style={styles.sheetSubtitle}>{t(language, 'chooseMuscleGroup')}</Text>

            <View style={styles.groupGrid}>
              {MUSCLE_GROUP_ORDER.map((groupId) => {
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
    paddingTop: Platform.OS === 'ios' ? SPACING.sm : SPACING.xxxl,
    ...Platform.select({
      web: { width: '100%', maxWidth: 720, alignSelf: 'center' },
    }),
  },
  content: {
    paddingHorizontal: SCREEN_PADDING,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SCREEN_PADDING,
    paddingBottom: SPACING.xxl,
  },
  backButton: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  back: {
    color: '#93C5FD',
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
    marginTop: SPACING.lg,
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
  liveLogCard: {
    marginTop: SPACING.xl,
    backgroundColor: '#020617',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: SPACING.md,
  },
  liveLogTitle: {
    color: '#F9FAFB',
    fontSize: TEXT.md,
    fontWeight: '800',
    marginBottom: SPACING.xs,
  },
  liveLogEmpty: {
    color: '#9CA3AF',
    fontSize: TEXT.sm,
  },
  liveLogList: {
    marginTop: SPACING.xs,
    gap: SPACING.xs,
  },
  liveLogRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    paddingVertical: 2,
  },
  liveLogTime: {
    width: 52,
    color: '#9CA3AF',
    fontSize: TEXT.xs,
    fontVariant: ['tabular-nums'],
  },
  liveLogText: {
    flex: 1,
    color: '#E5E7EB',
    fontSize: TEXT.sm,
    fontWeight: '600',
  },

  guidedCard: {
    backgroundColor: '#0B1220',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: SPACING.md,
  },
  guidedTitle: {
    color: '#F9FAFB',
    fontSize: TEXT.lg,
    fontWeight: '700',
    marginBottom: SPACING.xs,
  },
  guidedSubtitle: {
    color: '#9CA3AF',
    fontSize: TEXT.sm,
  },
  selectBox: {
    marginTop: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#111827',
    backgroundColor: '#020617',
    overflow: 'hidden',
  },
  selectHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  selectLabel: {
    color: '#E5E7EB',
    fontSize: TEXT.sm,
    fontWeight: '700',
  },
  selectValue: {
    flex: 1,
    color: '#9CA3AF',
    fontSize: TEXT.sm,
    fontWeight: '600',
  },
  chevron: {
    fontSize: TEXT.md,
    color: '#9CA3AF',
    fontWeight: '700',
  },
  chevronDisabled: {
    color: '#374151',
  },
  selectList: {
    borderTopWidth: 1,
    borderTopColor: '#111827',
  },
  selectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: '#0B1220',
    backgroundColor: '#020617',
    gap: SPACING.md,
  },
  selectRowSelected: {
    backgroundColor: '#0B1220',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  selectRowText: {
    color: '#F9FAFB',
    fontSize: TEXT.sm,
    fontWeight: '700',
    flex: 1,
  },
  emptyText: {
    color: '#9CA3AF',
    fontSize: TEXT.xs,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
  },

  // Dialogs
  dialogBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.72)',
    justifyContent: 'center',
    paddingHorizontal: SCREEN_PADDING,
  },
  dialogCard: {
    backgroundColor: '#020617',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: SPACING.xl,
  },
  dialogTitle: {
    color: '#F9FAFB',
    fontSize: TEXT.lg,
    fontWeight: '800',
    marginBottom: SPACING.xs,
  },
  dialogSubtitle: {
    color: '#9CA3AF',
    fontSize: TEXT.sm,
    fontWeight: '700',
    marginBottom: SPACING.sm,
  },
  dialogInput: {
    backgroundColor: '#0B1220',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#1F2937',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    color: '#F9FAFB',
    fontSize: TEXT.lg,
    fontWeight: '700',
  },
  error: {
    color: '#F97373',
    fontSize: TEXT.xs,
    marginTop: SPACING.sm,
  },
  dialogButtons: {
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
