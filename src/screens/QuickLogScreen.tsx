import React, { useMemo, useRef, useState, useEffect } from 'react';
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
  KeyboardAvoidingView,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppLanguage } from '../shared/types';
import { AppState, Exercise, LogEntry, TrainingBlock, TrainingBlockId } from '../features/workouts/model/types';
import { QuickKeypad } from '../shared/ui/QuickKeypad';
import { getBlockTone, getDotColor } from '../shared/theme/blockTone';
import { SPACING, TEXT, RADIUS, SCREEN_PADDING, COLORS } from '../shared/theme/tokens';
import { blockLabel, t } from '../shared/i18n/i18n';
import { formatExerciseLabel } from '../shared/utils/exerciseLabel';

type Props = {
  appState: AppState;
  onBack: () => void;
  onSave: (text: string, options?: { blockId?: string | null }) => {
    newExerciseId?: string;
    newExerciseName?: string;
  };
  onLogSet: (
    exerciseId: string,
    weight: number,
    reps: number,
    options?: { bodyweight?: boolean; distanceKm?: number | null; durationMin?: number | null }
  ) => void;
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

  const [isMuscleOpen, setIsMuscleOpen] = useState(false);
  const [isExerciseOpen, setIsExerciseOpen] = useState(false);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [weightModalOpen, setWeightModalOpen] = useState(false);
  const [repsModalOpen, setRepsModalOpen] = useState(false);
  const [weightText, setWeightText] = useState('');
  const [repsText, setRepsText] = useState('');
  const [bodyweightMode, setBodyweightMode] = useState(false);
  const [cardioModalOpen, setCardioModalOpen] = useState(false);
  const [distanceText, setDistanceText] = useState('');
  const [durationText, setDurationText] = useState('');
  const [setError, setSetError] = useState<string | null>(null);
  const [suggestionsOpen, setSuggestionsOpen] = useState(true);
  const [showAllLogs, setShowAllLogs] = useState(false);
  const placeholderOpacity = useRef(new Animated.Value(1)).current;
  const [isFocused, setIsFocused] = useState(false);

  const placeholderText = t(language, 'quicklog.placeholder.start');

  useEffect(() => {
    const target = input.length === 0 && !isFocused ? 1 : 0;
    Animated.timing(placeholderOpacity, {
      toValue: target,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [input, isFocused, placeholderOpacity]);

  const muscleGroupBlocks = useMemo(() => {
    const byId: Record<string, TrainingBlock> = {};
    for (const b of appState.blocks) byId[b.id] = b;

    const ordered: TrainingBlock[] = [];
    for (const id of MUSCLE_GROUP_ORDER) {
      const block = byId[id];
      if (block) ordered.push(block);
    }

    return ordered;
  }, [appState.blocks]);

  const otherBlocks = useMemo(
    () => appState.blocks.filter((b) => ['cardio', 'bodyweight'].includes(b.id)),
    [appState.blocks]
  );

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
    const isKnown = (
      ['chest', 'shoulders', 'back', 'arms', 'core', 'legs', 'cardio', 'bodyweight'] as string[]
    ).includes(id);
    return isKnown ? blockLabel(id, language) : block.name;
  };

  const flashSaved = () => {
    setSavedNotice(t(language, 'quickLogSaved'));
    setTimeout(() => setSavedNotice(null), 1600);
  };

  const normalize = (value: string): string =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9æøåáéíóúüñ\s]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const suggestionItems = useMemo(() => {
    const term = normalize(input);
    if (!term) return [];

    return appState.exercises
      .map((ex) => {
        const label = formatExerciseLabel(ex);
        const haystack = normalize(label);
        const score =
          haystack.startsWith(term) ? 3 :
          haystack.includes(term) ? 2 :
          0;
        return { ex, score, label };
      })
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
      .slice(0, 5);
  }, [appState.exercises, input]);

  const resetSetFlow = () => {
    setWeightText('');
    setRepsText('');
    setSetError(null);
    setWeightModalOpen(false);
    setRepsModalOpen(false);
    setBodyweightMode(false);
    setCardioModalOpen(false);
    setDistanceText('');
    setDurationText('');
  };

  const startSetFlow = (exerciseId: string) => {
    setSelectedExerciseId(exerciseId);
    setIsExerciseOpen(false);
    setWeightText('');
    setRepsText('');
    setSetError(null);
    setBodyweightMode(false);
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

  const quickLogInputSection = (
    <View style={styles.inputCard}>
      <Text style={styles.guidedTitle}>{t(language, 'home.quickLog.title')}</Text>
      <View style={styles.inputWrapper}>
        <View style={styles.placeholderWrapper} pointerEvents="none">
          <Animated.Text
            style={[styles.placeholderOverlay, { opacity: placeholderOpacity }]}
            numberOfLines={2}
            ellipsizeMode="tail"
          >
            {placeholderText}
          </Animated.Text>
        </View>
        <TextInput
          ref={inputRef}
          style={styles.input}
          placeholder="" // handled by animated overlay
          value={input}
          onChangeText={setInput}
          autoCapitalize="sentences"
          multiline
          returnKeyType="done"
          onSubmitEditing={handleSave}
          blurOnSubmit={false}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />
      </View>
    </View>
  );

  const muscleGroupSection = (
    <View style={styles.selectBox}>
      <TouchableOpacity
        style={styles.selectHeaderRow}
        onPress={() => setIsMuscleOpen((v) => !v)}
        activeOpacity={0.8}
      >
        <Text style={styles.selectLabel}>{t(language, 'muscleGroups')}</Text>
        <View style={styles.selectHeaderRight}>
          <Text style={styles.selectHint}>{t(language, 'chooseMuscleGroup').replace(/:$/, '')}</Text>
          <Text style={styles.selectStatus} numberOfLines={1} ellipsizeMode="tail">
            {selectedBlock ? blockTitle(selectedBlock) : 'Velg'}
          </Text>
        </View>
        <Text style={styles.chevron}>{isMuscleOpen ? 'v' : '>'}</Text>
      </TouchableOpacity>

      {isMuscleOpen && (
        <>
          <View style={[styles.selectList, styles.compactList]}>
            <ScrollView nestedScrollEnabled>
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
                      setIsExerciseOpen(true);
                      setIsMuscleOpen(false);
                    }}
                    activeOpacity={0.9}
                  >
                    <View style={[styles.dot, { backgroundColor: getDotColor(block.id) }]} />
                    <Text style={styles.selectRowText}>{blockTitle(block)}</Text>
                  </TouchableOpacity>
                );
              })}

              {otherBlocks.length > 0 ? (
                <>
                  <Text style={styles.otherLabel}>{t(language, 'otherSectionTitle')}</Text>
                  {otherBlocks.map((block) => {
                    const tone = getBlockTone(block.id);
                    const selected = block.id === selectedBlockId;
                    return (
                      <TouchableOpacity
                        key={block.id}
                        style={[styles.selectRow, selected && styles.selectRowSelected]}
                        onPress={() => {
                          setSelectedBlockId(block.id);
                          setSelectedExerciseId(null);
                          setIsExerciseOpen(true);
                          setIsMuscleOpen(false);
                        }}
                        activeOpacity={0.9}
                      >
                        <View style={[styles.dot, { backgroundColor: getDotColor(block.id) }]} />
                        <Text style={styles.selectRowText}>{blockTitle(block)}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </>
              ) : null}
            </ScrollView>
          </View>
        </>
      )}
    </View>
  );

  const exerciseSection = (
    <View style={[styles.selectBox, { marginTop: SPACING.md }]}>
      <TouchableOpacity
        style={styles.selectHeaderRow}
        onPress={() => selectedBlockId && setIsExerciseOpen((v) => !v)}
        activeOpacity={selectedBlockId ? 0.8 : 1}
      >
        <Text style={styles.selectLabel}>{t(language, 'exercises')}</Text>
        <View style={styles.selectHeaderRight}>
          <Text style={styles.selectHint}>{t(language, 'enterExerciseName')}</Text>
          <Text style={styles.selectStatus} numberOfLines={1} ellipsizeMode="tail">
            {selectedExercise ? formatExerciseLabel(selectedExercise) : 'Søk'}
          </Text>
        </View>
        <Text style={[styles.chevron, !selectedBlockId && styles.chevronDisabled]}>
          {isExerciseOpen ? 'v' : '>'}
        </Text>
      </TouchableOpacity>

      {isExerciseOpen && selectedBlockId ? (
        exercisesForBlock.length === 0 ? (
          <Text style={styles.emptyText}>{t(language, 'noExercisesInBlock')}</Text>
        ) : (
          <View style={[styles.selectList, styles.compactList]}>
            <ScrollView nestedScrollEnabled>
              {exercisesForBlock.map((ex) => {
                const selected = ex.id === selectedExerciseId;
                return (
                  <TouchableOpacity
                    key={ex.id}
                    style={[styles.selectRow, selected && styles.selectRowSelected]}
                    onPress={() => startSetFlow(ex.id)}
                    activeOpacity={0.9}
                  >
                    <View style={[styles.dot, { backgroundColor: getDotColor(selectedBlockId) }]} />
                    <Text style={styles.selectRowText}>{formatExerciseLabel(ex)}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )
      ) : null}
    </View>
  );

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

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.guidedCard}>
            {quickLogInputSection}
            {muscleGroupSection}
            {exerciseSection}

            {selectedExercise ? (
              <View style={styles.quickActions}>
                <TouchableOpacity
                  style={[styles.secondaryButton, styles.inlineButton]}
                  onPress={() => {
                    setBodyweightMode(true);
                    setWeightText('0');
                    setWeightModalOpen(false);
                    setRepsModalOpen(true);
                  }}
                  activeOpacity={0.9}
                >
                  <Text style={styles.secondaryButtonText}>{t(language, 'logBodyweight')}</Text>
                </TouchableOpacity>

                {selectedBlockId === 'cardio' ? (
                  <TouchableOpacity
                    style={[styles.secondaryButton, styles.inlineButton]}
                    onPress={() => {
                      setCardioModalOpen(true);
                      setDistanceText('');
                      setDurationText('');
                    }}
                    activeOpacity={0.9}
                  >
                    <Text style={styles.secondaryButtonText}>{t(language, 'logDistanceTime')}</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}
          </View>

        {suggestionItems.length > 0 && (
          <View style={styles.suggestionCard}>
            <TouchableOpacity
              style={styles.suggestionHeader}
              onPress={() => setSuggestionsOpen((v) => !v)}
              activeOpacity={0.8}
            >
              <Text style={styles.suggestionTitle}>{t(language, 'quickLogSuggestions')}</Text>
              <Text style={styles.chevron}>{suggestionsOpen ? 'v' : '>'}</Text>
            </TouchableOpacity>
            {suggestionsOpen && (
              <View style={styles.suggestionList}>
                {suggestionItems.map(({ ex, label }) => {
                  const tone = getBlockTone(ex.blockId);
                  const blk = muscleGroupBlocks.find((b) => b.id === ex.blockId);
                  return (
                    <TouchableOpacity
                      key={ex.id}
                      style={styles.suggestionRow}
                      onPress={() => {
                        setSelectedBlockId(ex.blockId);
                        setSelectedExerciseId(ex.id);
                        startSetFlow(ex.id);
                        setInput(label + ' ');
                      }}
                      activeOpacity={0.9}
                    >
                      <View style={[styles.dot, { backgroundColor: getDotColor(ex.blockId) }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.suggestionLabel}>{label}</Text>
                        <Text style={styles.suggestionMeta}>
                          {blk ? blockTitle(blk) : ''}
                        </Text>
                      </View>
                      <Text style={[styles.suggestionAction, { color: tone.accent }]}>
                        {t(language, 'logSet')}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {savedNotice ? <Text style={styles.savedNotice}>{savedNotice}</Text> : null}

        <View style={styles.actionBar}>
          <Pressable
            onPress={handleSave}
            style={({ pressed }) => [
              styles.primaryActionButton,
              pressed && styles.primaryActionButtonPressed,
            ]}
          >
            <Text style={styles.primaryActionText}>{t(language, 'quickLogButton')}</Text>
          </Pressable>
        </View>

        <View style={[styles.liveLogCard, { marginTop: SPACING.md }]}>
          <Text style={styles.liveLogTitle}>{t(language, 'liveLogTitle')}</Text>
          {todayLogs.length === 0 ? (
            <Text style={styles.liveLogEmpty}>{t(language, 'liveLogEmpty')}</Text>
          ) : (
            <>
              <View style={styles.liveLogList}>
                {(showAllLogs ? todayLogs : todayLogs.slice(0, 5)).map((entry) => (
                  <View key={entry.id} style={styles.liveLogRow}>
                    <Text style={styles.liveLogTime}>{formatTime(entry.createdAt, language)}</Text>
                    <Text style={styles.liveLogText}>{entry.text}</Text>
                    <Text style={styles.liveLogPin}>{entry.pinned ? '📌' : ' '}</Text>
                  </View>
                ))}
              </View>
              {!showAllLogs && todayLogs.length > 5 ? (
                <TouchableOpacity
                  onPress={() => setShowAllLogs(true)}
                  hitSlop={8}
                  activeOpacity={0.85}
                  style={styles.showAllRow}
                >
                  <Text style={styles.showAllText}>{'Vis alle'}</Text>
                </TouchableOpacity>
              ) : null}
            </>
          )}
        </View>
      </ScrollView>
      </KeyboardAvoidingView>

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
                style={styles.secondaryButton}
                onPress={() => {
                  setBodyweightMode(true);
                  setWeightText('0');
                  setWeightModalOpen(false);
                  setRepsModalOpen(true);
                }}
              >
                <Text style={styles.secondaryButtonText}>{t(language, 'logBodyweight')}</Text>
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
                    onLogSet(selectedExercise.id, w, r, { bodyweight: bodyweightMode });
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

      <Modal visible={cardioModalOpen} transparent animationType="fade">
        <Pressable style={styles.dialogBackdrop} onPress={resetSetFlow}>
          <Pressable style={styles.dialogCard} onPress={() => {}}>
            <Text style={styles.dialogTitle}>
              {selectedExercise ? formatExerciseLabel(selectedExercise) : ''}
            </Text>
            <Text style={styles.dialogSubtitle}>{t(language, 'distanceLabel')}</Text>
            <TextInput
              style={styles.dialogInput}
              placeholder="5"
              placeholderTextColor="#6B7280"
              value={distanceText}
              onChangeText={setDistanceText}
              keyboardType="numeric"
            />
            <Text style={styles.dialogSubtitle}>{t(language, 'durationLabel')}</Text>
            <TextInput
              style={styles.dialogInput}
              placeholder="30"
              placeholderTextColor="#6B7280"
              value={durationText}
              onChangeText={setDurationText}
              keyboardType="numeric"
            />

            {setError ? <Text style={styles.error}>{setError}</Text> : null}

            <View style={styles.dialogButtons}>
              <TouchableOpacity style={styles.secondaryButton} onPress={resetSetFlow}>
                <Text style={styles.secondaryButtonText}>{t(language, 'cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.primarySmallButton}
                onPress={() => {
                  const dist = distanceText ? Number(distanceText.trim().replace(',', '.')) : null;
                  const dur = durationText ? Number(durationText.trim().replace(',', '.')) : null;
                  if ((!dist || dist <= 0) && (!dur || dur <= 0)) {
                    setSetError(t(language, 'cardioInvalid'));
                    return;
                  }
                  if (selectedExercise) {
                    onLogSet(selectedExercise.id, 0, 1, {
                      bodyweight: false,
                      distanceKm: dist && dist > 0 ? dist : null,
                      durationMin: dur && dur > 0 ? dur : null,
                    });
                    flashSaved();
                  }
                  resetSetFlow();
                }}
              >
                <Text style={styles.primarySmallButtonText}>{t(language, 'logDistanceTime')}</Text>
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
    paddingTop: Platform.OS === 'ios' ? SPACING.sm : SPACING.lg,
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
  placeholderWrapper: {
    position: 'absolute',
    left: SPACING.md,
    right: SPACING.md,
    top: SPACING.sm,
  },
  placeholderOverlay: {
    color: '#6B7280',
    fontSize: TEXT.md,
    fontWeight: '600',
    opacity: 0.9,
  },
  savedNotice: {
    marginTop: SPACING.sm,
    color: '#86EFAC',
    fontSize: TEXT.sm,
  },
  actionBar: {
    marginTop: SPACING.md,
  },
  primaryActionButton: {
    backgroundColor: COLORS.blue2,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    marginVertical: 6,
  },
  primaryActionButtonPressed: {
    opacity: 0.85,
  },
  primaryActionText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: TEXT.md,
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
  showAllRow: {
    marginTop: SPACING.xs,
    alignItems: 'flex-start',
    paddingVertical: SPACING.xs,
  },
  showAllText: {
    color: '#60A5FA',
    fontSize: TEXT.sm,
    fontWeight: '700',
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
  liveLogPin: {
    minWidth: 20,
    textAlign: 'right',
    fontSize: TEXT.sm,
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
  inputWrapper: {
    position: 'relative',
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
  selectHeaderRight: {
    flex: 1,
    alignItems: 'flex-end',
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
  selectHint: {
    color: COLORS.actionSecondary,
    fontSize: TEXT.xs,
  },
  selectStatus: {
    color: COLORS.actionSecondary,
    fontSize: TEXT.sm,
    maxWidth: 180,
    textAlign: 'right',
  },
  chevron: {
    fontSize: TEXT.md,
    color: COLORS.actionSecondary,
    fontWeight: '700',
  },
  chevronDisabled: {
    color: '#374151',
  },
  selectList: {
    borderTopWidth: 1,
    borderTopColor: '#111827',
  },
  compactList: {
    maxHeight: 260,
    overflow: 'hidden',
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
  suggestionCard: {
    backgroundColor: '#0B1220',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: SPACING.md,
    marginTop: SPACING.md,
    gap: SPACING.sm,
  },
  suggestionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  suggestionTitle: {
    color: '#E5E7EB',
    fontSize: TEXT.sm,
    fontWeight: '700',
  },
  suggestionList: {
    gap: SPACING.xs,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  suggestionLabel: {
    color: '#E5E7EB',
    fontSize: TEXT.sm,
    fontWeight: '700',
  },
  suggestionMeta: {
    color: '#9CA3AF',
    fontSize: TEXT.xs,
  },
  suggestionAction: {
    fontSize: TEXT.xs,
    fontWeight: '800',
  },
  quickActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
    flexWrap: 'wrap',
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
  inlineButton: {
    marginRight: 0,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
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
  otherLabel: {
    color: '#E5E7EB',
    fontSize: TEXT.sm,
    fontWeight: '700',
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
  },
});
