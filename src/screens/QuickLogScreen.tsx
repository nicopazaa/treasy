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
import type { AppState, Exercise, LogEntry, TrainingBlock, TrainingBlockId } from '../features/workouts';
import { QuickKeypad } from '../shared/ui/QuickKeypad';
import { getBlockTone, getDotColor } from '../shared/theme/blockTone';
import { SPACING, TEXT, RADIUS, SCREEN_PADDING, COLORS } from '../shared/theme/tokens';
import { blockLabel, t } from '../shared/i18n/i18n';
import { useKeyboardInset } from '../shared/hooks/useKeyboardInset';
import { formatExerciseLabel } from '../shared/utils/exerciseLabel';
import { formatWeight, toKg } from '../shared/utils/units';
import { parseInputToAction } from '../domain/quicklog/parseInputToAction';

type Props = {
  appState: AppState;
  onBack: () => void;
  onSave: (text: string, options?: { blockId?: string | null }) => Promise<{
    kind: 'note' | 'workout';
    newExerciseId?: string;
    newExerciseName?: string;
  }>;
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

const HEADER_SIDE_WIDTH = 96;

export const QuickLogScreen: React.FC<Props> = ({
  appState,
  onBack,
  onSave,
  onLogSet,
  onCategorizeExercise,
  showLocalOnlyNotice = false,
}) => {
  const language = appState.language ?? 'en';
  const massUnit = appState.massUnit ?? 'kg';
  const unitLabel = massUnit === 'lb' ? t(language, 'units.lb') : t(language, 'units.kg');
  const [input, setInput] = useState('');
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [pendingExercise, setPendingExercise] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const inputRef = useRef<TextInput | null>(null);

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
  const { keyboardHeight, isKeyboardVisible } = useKeyboardInset();

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

  const blockChips = useMemo(
    () => [...muscleGroupBlocks, ...otherBlocks],
    [muscleGroupBlocks, otherBlocks]
  );

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

  const enterHint =
    Platform.OS === 'web'
      ? language === 'nb'
        ? 'Enter for å logge'
        : language === 'es'
          ? 'Enter para registrar'
          : 'Enter to log'
      : null;

  const parsePreview = useMemo(() => {
    const trimmed = input.trim();
    if (!trimmed) return null;

    const prefix =
      language === 'nb'
        ? 'Tolket som: '
        : language === 'es'
          ? 'Interpretado como: '
          : 'Parsed as: ';
    const hint =
      language === 'nb'
        ? 'Skriv øvelse + vekt x reps for å logge.'
        : language === 'es'
          ? 'Escribe ejercicio + peso x reps para registrar.'
          : 'Type exercise + weight x reps to log.';
    const setsLabel = language === 'nb' ? 'sett' : language === 'es' ? 'series' : 'sets';

    const parsed = parseInputToAction(trimmed, { appState, language, defaultUnit: massUnit });
    if (parsed.kind !== 'workout') {
      return { kind: 'hint', text: hint };
    }

    const entries = parsed.payload.entries;
    if (!entries.length) {
      return { kind: 'hint', text: hint };
    }

    const formatWeightRange = (values: number[]): string => {
      const valid = values.filter((value) => Number.isFinite(value));
      if (!valid.length) return '';
      const min = Math.min(...valid);
      const max = Math.max(...valid);
      const minLabel = formatWeight(min, massUnit, language);
      if (min === max) return minLabel;
      const maxLabel = formatWeight(max, massUnit, language);
      return `${minLabel}–${maxLabel}`;
    };

    const formatRepsRange = (values: number[]): string => {
      const valid = values.filter((value) => Number.isFinite(value) && value > 0);
      if (!valid.length) return '';
      const min = Math.min(...valid);
      const max = Math.max(...valid);
      const range = min === max ? `${min}` : `${min}–${max}`;
      return `${range} reps`;
    };

    if (entries.length > 1) {
      const totalSets = entries.reduce((sum, entry) => sum + entry.sets.length, 0);
      const multiLabel = language === 'nb' ? 'Flere øvelser' : language === 'es' ? 'Varios ejercicios' : 'Multiple exercises';
      return { kind: 'workout', text: `${prefix}${multiLabel} · ${totalSets} ${setsLabel}` };
    }

    const entry = entries[0];
    const weights = entry.sets.map((set) => set.weight);
    const reps = entry.sets.map((set) => set.reps);
    const allBodyweight = entry.sets.length > 0 && entry.sets.every((set) => set.isBodyweight);
    const weightLabel = allBodyweight ? 'BW' : formatWeightRange(weights);
    const repsLabel = formatRepsRange(reps);
    const detail = `${entry.exerciseName} · ${weightLabel} · ${repsLabel} · ${entry.sets.length} ${setsLabel}`;
    return { kind: 'workout', text: `${prefix}${detail}` };
  }, [appState, input, language, massUnit]);

  const flashSaved = (kind: 'note' | 'workout') => {
    const key = kind === 'note' ? 'noteSaved' : 'workoutLogged';
    setSavedNotice(t(language, key));
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

  const handleSave = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    const res = await onSave(trimmed, { blockId: selectedBlockId });
    setInput('');
    flashSaved(res.kind);

    if (res.newExerciseId && res.newExerciseName) {
      setPendingExercise({ id: res.newExerciseId, name: res.newExerciseName });
    }

    setTimeout(() => inputRef.current?.focus(), 120);
  };

  const showLocalNoticeLine = showLocalOnlyNotice && appState.authProvider === 'guest';
  const isInputEmpty = input.trim().length === 0;

  const quickLogInputSection = (
    <View style={styles.inputCard}>
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
          selectionColor={COLORS.blue3}
        />
      </View>

      <View style={styles.inputMeta}>
        {parsePreview ? (
          <Text
            style={[
              styles.parsePreviewText,
              parsePreview.kind === 'hint' ? styles.parsePreviewHint : styles.parsePreviewOk,
            ]}
          >
            {parsePreview.text}
          </Text>
        ) : null}
        {enterHint ? <Text style={styles.inputHelper}>{enterHint}</Text> : null}
      </View>

      <View style={styles.actionBar}>
        <Pressable
          onPress={handleSave}
          disabled={isInputEmpty}
          style={({ pressed }) => [
            styles.primaryActionButton,
            isInputEmpty && styles.primaryActionButtonDisabled,
            pressed && !isInputEmpty && styles.primaryActionButtonPressed,
          ]}
        >
          <Text style={[styles.primaryActionText, isInputEmpty && styles.primaryActionTextDisabled]}>
            {t(language, 'quickLogButton')}
          </Text>
        </Pressable>
      </View>
    </View>
  );

  const muscleGroupSection = (
    <View style={styles.chipsCard}>
      <Text style={styles.sectionLabel}>{t(language, 'muscleGroups')}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        {blockChips.map((block) => {
          const tone = getBlockTone(block.id);
          const selected = block.id === selectedBlockId;
          return (
            <TouchableOpacity
              key={block.id}
              style={[
                styles.chip,
                {
                  borderColor: selected ? tone.accent : '#1F2937',
                  backgroundColor: selected ? tone.soft : '#0B1220',
                },
              ]}
              onPress={() => {
                setSelectedBlockId(block.id);
                setSelectedExerciseId(null);
                setIsExerciseOpen(true);
              }}
              activeOpacity={0.9}
            >
              <View style={[styles.chipDot, { backgroundColor: getDotColor(block.id) }]} />
              <Text style={[styles.chipText, selected && { color: tone.accent }]}>{blockTitle(block)}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
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
        <View style={styles.headerRow}>
          <View style={styles.headerSide}>
            <TouchableOpacity onPress={onBack} hitSlop={12} style={styles.backButton} activeOpacity={0.8}>
              <Text style={styles.back}>{'< Tilbake'}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>{'📌 Hurtiglogg'}</Text>
          </View>
          <View style={styles.headerSide} />
        </View>

        {showLocalNoticeLine ? (
          <Text style={styles.localOnlyNotice}>
            {t(language, 'localOnlyNotice')}
          </Text>
        ) : null}
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingBottom:
                SPACING.xxl + (Platform.OS === 'android' && isKeyboardVisible ? keyboardHeight : 0),
            },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.guidedCard}>
            {quickLogInputSection}
            {muscleGroupSection}
            {selectedBlockId ? exerciseSection : null}

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

        <View style={[styles.liveLogCard, { marginTop: SPACING.md }]}>
          <Text style={styles.liveLogTitle}>{t(language, 'liveLogTitle')}</Text>
          {todayLogs.length === 0 ? (
            <Text style={styles.liveLogEmpty}>{t(language, 'liveLogEmpty')}</Text>
          ) : (
            <>
              <View style={styles.liveLogList}>
                {(showAllLogs ? todayLogs : todayLogs.slice(0, 5)).map((entry, index, array) => (
                  <View
                    key={entry.id}
                    style={[
                      styles.liveLogRow,
                      index < array.length - 1 ? styles.liveLogRowDivider : null,
                    ]}
                  >
                    <Text style={styles.liveLogTime}>{formatTime(entry.createdAt, language)}</Text>
                    <View style={styles.liveLogContent}>
                      <Text style={styles.liveLogText}>{entry.text}</Text>
                      {entry.pinned ? <Text style={styles.liveLogPin}>{'📌'}</Text> : null}
                    </View>
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
            <Text style={styles.dialogSubtitle}>{t(language, 'weightKg', { unit: unitLabel })}</Text>
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
                    const unit = appState.massUnit ?? 'kg';
                    const inputW = Number(weightText.trim().replace(',', '.'));
                    const wKg = toKg(inputW, unit);
                    if (!Number.isFinite(wKg) || wKg < 0) {
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
                    const unit = appState.massUnit ?? 'kg';
                    const inputW = Number(weightText.trim().replace(',', '.'));
                    const wKg = toKg(inputW, unit);
                    const r = Number(repsText.trim());
                    if (!Number.isFinite(wKg) || !Number.isFinite(r) || wKg < 0 || r <= 0) {
                      setSetError(t(language, 'invalidWeightReps'));
                      return;
                    }
                    if (selectedExercise) {
                      onLogSet(selectedExercise.id, wKg, r, { bodyweight: bodyweightMode });
                      flashSaved('workout');
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
                    flashSaved('workout');
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  headerSide: {
    width: HEADER_SIDE_WIDTH,
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#F9FAFB',
    fontSize: TEXT.md,
    fontWeight: '800',
    textAlign: 'center',
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
    backgroundColor: '#0A1224',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: SPACING.lg,
    ...Platform.select({
      web: { boxShadow: '0 12px 24px rgba(2, 6, 23, 0.3)' },
      default: {
        shadowColor: '#020617',
        shadowOpacity: 0.35,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
      },
    }),
  },
  input: {
    minHeight: 168,
    borderRadius: RADIUS.md,
    borderWidth: 0,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    color: '#E2E8F0',
    fontSize: TEXT.lg,
    fontWeight: '600',
    lineHeight: TEXT.lg + 4,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  placeholderWrapper: {
    position: 'absolute',
    left: SPACING.md,
    right: SPACING.md,
    top: SPACING.sm,
    zIndex: 2,
  },
  placeholderOverlay: {
    color: '#94A3B8',
    fontSize: TEXT.sm,
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
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    width: '100%',
  },
  primaryActionButtonPressed: {
    opacity: 0.85,
  },
  primaryActionButtonDisabled: {
    backgroundColor: '#1E293B',
  },
  primaryActionText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: TEXT.md,
  },
  primaryActionTextDisabled: {
    color: '#94A3B8',
  },
  liveLogCard: {
    marginTop: SPACING.xl,
    backgroundColor: '#0B1220',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: SPACING.lg,
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
    marginTop: SPACING.sm,
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
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  liveLogRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1E293B',
  },
  liveLogTime: {
    width: 64,
    color: '#94A3B8',
    fontSize: TEXT.xs,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  liveLogContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  liveLogText: {
    flex: 1,
    color: '#E2E8F0',
    fontSize: TEXT.sm,
    fontWeight: '600',
  },
  liveLogPin: {
    minWidth: 18,
    textAlign: 'right',
    fontSize: TEXT.sm,
  },

  guidedCard: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    padding: 0,
    marginTop: SPACING.lg,
    gap: SPACING.md,
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
  inputMeta: {
    marginTop: SPACING.sm,
    gap: SPACING.xs,
  },
  parsePreviewText: {
    fontSize: TEXT.sm,
    fontWeight: '600',
  },
  parsePreviewOk: {
    color: '#86EFAC',
  },
  parsePreviewHint: {
    color: '#94A3B8',
  },
  inputHelper: {
    color: '#64748B',
    fontSize: TEXT.xs,
    fontWeight: '600',
  },
  selectBox: {
    marginTop: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#1E293B',
    backgroundColor: '#0B1220',
    overflow: 'hidden',
  },
  chipsCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#1E293B',
    backgroundColor: '#0B1220',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
  },
  sectionLabel: {
    color: '#E5E7EB',
    fontSize: TEXT.sm,
    fontWeight: '700',
  },
  chipRow: {
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
    gap: SPACING.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
  },
  chipDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  chipText: {
    color: '#E5E7EB',
    fontSize: TEXT.sm,
    fontWeight: '700',
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
