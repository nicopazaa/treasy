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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { AppState } from '../features/workouts';
import { answerAiQuestion } from '../features/analytics/model/aiService';
import { SPACING, TEXT, RADIUS, SCREEN_PADDING } from '../shared/theme/tokens';
import { t } from '../shared/i18n/i18n';
import { now } from '../shared/time';

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
};

function makeId(prefix: string): string {
  return `${prefix}-${now()}-${Math.random().toString(16).slice(2)}`;
}

export const AIScreen: React.FC<Props> = ({ appState, onBack, initialQuestion, initialExerciseId }) => {
  const language = appState.language ?? 'en';
  const massUnit = appState.massUnit ?? 'kg';
  const unitLabel = massUnit === 'lb' ? t(language, 'units.lb') : t(language, 'units.kg');
  const ctxExerciseId = initialExerciseId ?? null;

  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const scrollRef = useRef<ScrollView | null>(null);
  const initialHandledRef = useRef(false);

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

  const scrollToBottom = () => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  };

  const send = (text?: string) => {
    const query = (text ?? draft).trim();
    if (!query) return;

    const answer = answerAiQuestion(appState, query, ctxExerciseId);
    setMessages((prev) => [
      ...prev,
      { id: makeId('u'), role: 'user', text: query },
      { id: makeId('a'), role: 'appa', text: answer },
    ]);
    setDraft('');
    scrollToBottom();
  };

  useEffect(() => {
    if (!initialQuestion || initialHandledRef.current) return;
    initialHandledRef.current = true;
    send(initialQuestion);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuestion]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.inner}>
          <View style={styles.content}>
            <TouchableOpacity onPress={onBack} hitSlop={12} style={styles.backButton} activeOpacity={0.8}>
              <Text style={styles.back}>{t(language, 'back')}</Text>
            </TouchableOpacity>

            <Text style={styles.title}>{t(language, 'aiSearchTitle')}</Text>
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
              </View>
            ))}
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
              style={[styles.sendButton, !draft.trim() && styles.sendButtonDisabled]}
              onPress={() => send()}
              activeOpacity={0.9}
              hitSlop={6}
              disabled={!draft.trim()}
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
