import React, { useEffect, useState } from 'react';
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
import { AppState } from '../features/workouts/model/types';
import { PrimaryButton } from '../shared/ui/PrimaryButton';
import { answerAiQuestion } from '../features/analytics/model/aiService';
import { SPACING, TEXT, RADIUS } from '../shared/theme/tokens';
import { t } from '../shared/i18n/i18n';

interface Props {
  appState: AppState;
  onBack: () => void;
  initialQuestion?: string;
  initialExerciseId?: string | null;
}

export const AIScreen: React.FC<Props> = ({
  appState,
  onBack,
  initialQuestion,
  initialExerciseId,
}) => {
  const language = appState.language ?? 'en';
  const [question, setQuestion] = useState(initialQuestion ?? '');
  const [answer, setAnswer] = useState<string | null>(null);
  const [ctxExerciseId] = useState<string | null>(initialExerciseId ?? null);

  useEffect(() => {
    if (initialQuestion) {
      handleAsk(initialQuestion);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAsk = (q?: string) => {
    const query = (q ?? question).trim();
    if (!query) {
      setAnswer(t(language, 'aiEmptyQuery'));
      return;
    }
    const res = answerAiQuestion(appState, query, ctxExerciseId);
    setAnswer(res);
  };

  const suggestions =
    language === 'es'
      ? [
          '¿Qué hice la última vez en banca?',
          '¿Cuántos entrenos de pecho en diciembre?',
          '¿Qué hice en la última sesión?',
          '¿Cuántas reps a 100 kg en banca en los últimos 30 días?',
          '¿Cuál es mi mejor serie en peso muerto?',
        ]
      : language === 'en'
        ? [
            'What did I do last on bench?',
            'How many chest sessions in December?',
            'What did I do in my last session?',
            'How many reps at 100 kg on bench in the last 30 days?',
            'What is my best set in deadlift?',
          ]
        : [
            'Hva tok jeg sist i benk?',
            'Hvor mange brystøkter i desember?',
            'Hva gjorde jeg på siste økt?',
            'Hvor mange reps på 100 kg i benkpress de siste 30 dagene?',
            'Hva er beste sett i markløft?',
          ];

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>
        <TouchableOpacity onPress={onBack} hitSlop={8}>
          <Text style={styles.back}>{t(language, 'back')}</Text>
        </TouchableOpacity>

        <Text style={styles.title}>{t(language, 'aiSearchTitle')}</Text>
        <Text style={styles.subtitle}>{t(language, 'aiSubtitle')}</Text>

        <View style={styles.inputCard}>
          <Text style={styles.label}>{t(language, 'aiSearchLabel')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t(language, 'aiPlaceholder')}
            placeholderTextColor="#4B5563"
            value={question}
            onChangeText={setQuestion}
            multiline
            returnKeyType="send"
            onSubmitEditing={() => handleAsk()}
          />
          <PrimaryButton title={t(language, 'search')} onPress={() => handleAsk()} />
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: SPACING.xxxl }}>
          {answer && (
            <View style={styles.answerCard}>
              <Text style={styles.answerTitle}>{t(language, 'answer')}</Text>
              <Text style={styles.answerText}>{answer}</Text>
            </View>
          )}

          <View style={styles.suggestionsCard}>
            <Text style={styles.suggestionsTitle}>{t(language, 'examples')}</Text>
            {suggestions.map((s) => (
              <TouchableOpacity
                key={s}
                style={styles.suggestionRow}
                onPress={() => {
                  setQuestion(s);
                  handleAsk(s);
                }}
              >
                <Text style={styles.suggestionText}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  inner: {
    flex: 1,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xxxl,
  },
  back: {
    color: '#93C5FD',
    marginBottom: SPACING.md,
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
  inputCard: {
    backgroundColor: '#020617',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  label: {
    color: '#E5E7EB',
    marginBottom: SPACING.sm,
    fontWeight: '600',
    fontSize: TEXT.sm,
  },
  input: {
    minHeight: 60,
    maxHeight: 120,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: SPACING.sm,
    color: '#F9FAFB',
    marginBottom: SPACING.sm,
    backgroundColor: '#0B1220',
  },
  scroll: {
    flex: 1,
    marginTop: SPACING.xs,
  },
  answerCard: {
    backgroundColor: '#020617',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  answerTitle: {
    color: '#F9FAFB',
    fontWeight: '700',
    marginBottom: SPACING.xs,
  },
  answerText: {
    color: '#E5E7EB',
    fontSize: TEXT.sm,
  },
  suggestionsCard: {
    backgroundColor: '#020617',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: SPACING.md,
  },
  suggestionsTitle: {
    color: '#F9FAFB',
    fontWeight: '700',
    marginBottom: SPACING.sm,
  },
  suggestionRow: {
    paddingVertical: SPACING.xs,
  },
  suggestionText: {
    color: '#93C5FD',
    fontSize: TEXT.sm,
  },
});
