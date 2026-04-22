import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppState } from '../features/workouts';
import { answerAiQuestion } from '../features/analytics/model/aiService';
import { SPACING, TEXT, RADIUS, SCREEN_PADDING } from '../shared/theme/tokens';
import { t } from '../shared/i18n/i18n';
import { now } from '../shared/time';
import { getWorkoutDates } from '../features/workouts';
import { createStableId } from '../shared/utils/id';

interface Props {
  appState: AppState;
  onBack: () => void;
  initialQuestion?: string;
  initialExerciseId?: string | null;
}

type ChatMessage = {
  id: string;
  role: 'user' | 'appa';
  text: string;
  context?: string;
};

function makeId(prefix: string): string {
  return createStableId(prefix, now());
}

const STORAGE_KEY = 'treasy_ai_chat_v1';
const MAX_MESSAGES = 60;

function typingLabel(language: AppState['language']): string {
  if (language === 'es') return 'Escribiendo…';
  if (language === 'en') return 'Typing…';
  return 'Skriver…';
}

function formatLastWorkoutLabel(dateKey: string, language: AppState['language']): string {
  const safeDate = new Date(`${dateKey}T12:00:00`);
  const locale = language === 'nb' ? 'nb-NO' : language === 'es' ? 'es-ES' : 'en-US';
  try {
    return safeDate.toLocaleDateString(locale, { weekday: 'short', day: '2-digit', month: '2-digit' });
  } catch {
    return dateKey;
  }
}

export const AIScreen: React.FC<Props> = ({ appState, onBack, initialQuestion, initialExerciseId }) => {
  const language = appState.language ?? 'en';
  const massUnit = appState.massUnit ?? 'kg';
  const unitLabel = massUnit === 'lb' ? t(language, 'units.lb') : t(language, 'units.kg');
  const ctxExerciseId = initialExerciseId ?? null;

  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const scrollRef = useRef<ScrollView | null>(null);
  const initialHandledRef = useRef(false);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const appaContext = useMemo(() => {
    const dates = getWorkoutDates(appState);
    const last = dates.length > 0 ? dates[0] : null;
    const lastLabel = last ? formatLastWorkoutLabel(last, language) : null;

    if (language === 'es') {
      return `Idioma: ${language} • Unidad: ${massUnit}${lastLabel ? ` • Último entreno: ${lastLabel}` : ''}`;
    }
    if (language === 'en') {
      return `Language: ${language} • Unit: ${massUnit}${lastLabel ? ` • Last workout: ${lastLabel}` : ''}`;
    }
    return `Språk: ${language} • Enhet: ${massUnit}${lastLabel ? ` • Siste økt: ${lastLabel}` : ''}`;
  }, [appState, language, massUnit]);

  const scenarios = useMemo(
    () => [
      t(language, 'appa.scenario.lastWorkout', { unit: unitLabel }),
      t(language, 'appa.scenario.workouts7d', { unit: unitLabel }),
      t(language, 'appa.scenario.volume7d', { unit: unitLabel }),
      t(language, 'appa.scenario.bestSet', { unit: unitLabel }),
      t(language, 'appa.scenario.repsAtWeight', { unit: unitLabel }),
      t(language, 'appa.scenario.blockInMonth', { unit: unitLabel }),
      t(language, 'appa.scenario.lastSetExercise', { unit: unitLabel }),
      t(language, 'appa.scenario.bestSetExercise', { unit: unitLabel }),
    ],
    [language, unitLabel]
  );

  const suggestionChips = useMemo(() => {
    if (language === 'es') {
      return [
        '¿Cómo registro cardio rápido?',
        '¿Cuál es el mejor ejercicio para pecho?',
        '¿Por qué no veo progreso?',
        'Resume la última semana',
      ];
    }
    if (language === 'en') {
      return [
        'How do I log cardio quickly?',
        'What is the best exercise for chest?',
        "Why don't I see progress?",
        'Summarize last week',
      ];
    }
    return [
      'Hvordan logger jeg cardio raskt?',
      'Hva er beste øvelse for bryst?',
      'Hvorfor ser jeg ikke progresjon?',
      'Oppsummer siste uke',
    ];
  }, [language]);

  const scrollToBottom = () => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  };

  const send = (text?: string) => {
    const query = (text ?? draft).trim();
    if (!query) return;
    if (isTyping) return;

    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }

    const answer = answerAiQuestion(appState, query, ctxExerciseId);
    setMessages((prev) => [...prev, { id: makeId('u'), role: 'user', text: query }]);
    setDraft('');
    setIsTyping(true);
    scrollToBottom();

    typingTimerRef.current = setTimeout(() => {
      setMessages((prev) => [...prev, { id: makeId('a'), role: 'appa', text: answer, context: appaContext }]);
      setIsTyping(false);
      typingTimerRef.current = null;
      scrollToBottom();
    }, 180);
  };

  useEffect(() => {
    if (!hydrated || !initialQuestion || initialHandledRef.current) return;
    initialHandledRef.current = true;
    send(initialQuestion);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, initialQuestion]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const json = await AsyncStorage.getItem(STORAGE_KEY);
        if (cancelled) return;
        if (!json) {
          setHydrated(true);
          return;
        }
        const parsed = JSON.parse(json) as unknown;
        if (!Array.isArray(parsed)) {
          setHydrated(true);
          return;
        }
        const restored = parsed
          .filter((m): m is ChatMessage => {
            if (!m || typeof m !== 'object') return false;
            const msg = m as ChatMessage;
            return (
              typeof msg.id === 'string' &&
              (msg.role === 'user' || msg.role === 'appa') &&
              typeof msg.text === 'string'
            );
          })
          .slice(-MAX_MESSAGES);
        setMessages(restored);
      } catch (e) {
        console.warn('Failed to load AI chat', e);
      } finally {
        if (!cancelled) setHydrated(true);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const toSave = messages.slice(-MAX_MESSAGES);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(toSave)).catch((e) => {
      console.warn('Failed to save AI chat', e);
    });
  }, [hydrated, messages]);

  useEffect(() => {
    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, []);

  const clearChat = async () => {
    setMessages([]);
    setIsTyping(false);
    setDraft('');
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.warn('Failed to clear AI chat', e);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.inner}>
          <View style={styles.content}>
            <TouchableOpacity onPress={onBack} hitSlop={12} style={styles.backButton} activeOpacity={0.8}>
              <Text style={styles.back}>{t(language, 'back')}</Text>
            </TouchableOpacity>

            <View style={styles.titleRow}>
              <Text style={styles.title}>{t(language, 'aiSearchTitle')}</Text>
              {messages.length > 0 ? (
                <Pressable
                  onPress={clearChat}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={language === 'nb' ? 'Tøm chat' : language === 'es' ? 'Borrar chat' : 'Clear chat'}
                  style={({ pressed }) => [styles.clearButton, pressed ? styles.clearButtonPressed : null]}
                >
                  <Text style={styles.clearText}>
                    {language === 'nb' ? 'Tøm chat' : language === 'es' ? 'Borrar' : 'Clear'}
                  </Text>
                </Pressable>
              ) : null}
            </View>
            <Text style={styles.subtitle}>{t(language, 'aiSubtitle')}</Text>
          </View>

          <ScrollView
            ref={scrollRef}
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={scrollToBottom}
          >
            {messages.length === 0 ? (
              <View style={styles.scenariosCard}>
                <Text style={styles.scenariosTitle}>{t(language, 'appa.scenariosTitle')}</Text>
                <View style={styles.chipsWrap}>
                  {suggestionChips.map((chip) => (
                    <Pressable
                      key={chip}
                      onPress={() => send(chip)}
                      style={({ pressed }) => [styles.chip, pressed ? styles.chipPressed : null]}
                    >
                      <Text style={styles.chipText}>{chip}</Text>
                    </Pressable>
                  ))}
                </View>

                <View style={styles.scenariosDivider} />
                {scenarios.map((s) => (
                  <TouchableOpacity key={s} style={styles.scenarioRow} onPress={() => send(s)} activeOpacity={0.9}>
                    <Text style={styles.scenarioText}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}

            {messages.map((m) => (
              <View key={m.id} style={[styles.bubble, m.role === 'user' ? styles.bubbleUser : styles.bubbleAppa]}>
                <Text style={styles.bubbleText}>{m.text}</Text>
                {m.role === 'appa' && m.context ? <Text style={styles.bubbleMeta}>{m.context}</Text> : null}
              </View>
            ))}

            {isTyping ? (
              <View style={[styles.bubble, styles.bubbleAppa, styles.bubbleTyping]}>
                <Text style={styles.bubbleTypingText}>{typingLabel(language)}</Text>
              </View>
            ) : null}
          </ScrollView>

          <View style={[styles.composer, styles.content]}>
            <TextInput
              style={styles.input}
              placeholder={t(language, 'aiPlaceholder')}
              placeholderTextColor="#4B5563"
              value={draft}
              onChangeText={setDraft}
              multiline
              returnKeyType="send"
              onSubmitEditing={() => send()}
            />
            <TouchableOpacity
              style={[styles.sendButton, (!draft.trim() || isTyping) && styles.sendButtonDisabled]}
              onPress={() => send()}
              activeOpacity={0.9}
              hitSlop={6}
              disabled={!draft.trim() || isTyping}
              accessibilityLabel={t(language, 'appa.send')}
            >
              <Text style={styles.sendText}>{t(language, 'appa.send')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#020617',
  },
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  inner: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? SPACING.sm : SPACING.xxxl,
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.md,
  },
  clearButton: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.pill,
  },
  clearButtonPressed: {
    backgroundColor: 'rgba(96, 165, 250, 0.10)',
  },
  clearText: {
    color: '#93C5FD',
    fontSize: TEXT.xs,
    fontWeight: '800',
  },
  subtitle: {
    marginTop: SPACING.xs,
    color: '#9CA3AF',
    marginBottom: SPACING.lg,
    fontSize: TEXT.sm,
  },
  scroll: {
    flex: 1,
    marginTop: SPACING.xs,
  },
  scrollContent: {
    paddingHorizontal: SCREEN_PADDING,
    paddingBottom: SPACING.xxxl,
  },
  scenariosCard: {
    backgroundColor: '#020617',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  scenariosTitle: {
    color: '#F9FAFB',
    fontWeight: '700',
    marginBottom: SPACING.sm,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  chip: {
    borderWidth: 1,
    borderColor: '#1F2937',
    backgroundColor: '#0B1220',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.pill,
  },
  chipPressed: {
    opacity: 0.88,
  },
  chipText: {
    color: '#93C5FD',
    fontSize: TEXT.sm,
    fontWeight: '700',
  },
  scenariosDivider: {
    height: 1,
    backgroundColor: '#111827',
    marginBottom: SPACING.sm,
  },
  scenarioRow: {
    paddingVertical: SPACING.xs,
    minHeight: 44,
    justifyContent: 'center',
  },
  scenarioText: {
    color: '#93C5FD',
    fontSize: TEXT.sm,
    fontWeight: '600',
  },
  bubble: {
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    maxWidth: '92%',
  },
  bubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: '#1D4ED8',
  },
  bubbleAppa: {
    alignSelf: 'flex-start',
    backgroundColor: '#0B1220',
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  bubbleText: {
    color: '#F9FAFB',
    fontSize: TEXT.sm,
    fontWeight: '600',
    lineHeight: 20,
  },
  bubbleMeta: {
    marginTop: SPACING.xs,
    color: '#94A3B8',
    fontSize: TEXT.xs,
    fontWeight: '600',
  },
  bubbleTyping: {
    paddingVertical: SPACING.sm,
  },
  bubbleTypingText: {
    color: '#93C5FD',
    fontSize: TEXT.sm,
    fontWeight: '700',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: '#111827',
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.sm,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#1F2937',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    color: '#F9FAFB',
    backgroundColor: '#0B1220',
    fontSize: TEXT.sm,
    fontWeight: '600',
  },
  sendButton: {
    minWidth: 44,
    height: 44,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.pill,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.55,
  },
  sendText: {
    color: '#F9FAFB',
    fontSize: TEXT.sm,
    fontWeight: '800',
  },
});
