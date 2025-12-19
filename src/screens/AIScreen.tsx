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
import { AppState } from '../types';
import { PrimaryButton } from '../components/PrimaryButton';
import { answerAiQuestion } from '../services/aiService';
import { SPACING, TEXT, RADIUS } from '../theme/tokens';

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
      setAnswer('Lokalt svar: Skriv inn et sok forst.');
      return;
    }
    const res = answerAiQuestion(appState, query, ctxExerciseId);
    setAnswer(res);
  };

  const suggestions = [
    'Hva tok jeg sist i benk?',
    'Hvor mange brystokter i desember?',
    'Hva gjorde jeg pa siste okt?',
    'Hvor mange reps pa 100 kg i benkpress de siste 30 dagene?',
    'Hva er beste sett i markloft?',
  ];

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.back}>{'< Tilbake'}</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Treasy sok</Text>
        <Text style={styles.subtitle}>
          Smart sok i loggen din. Alt svares lokalt pa denne enheten.
        </Text>

        <View style={styles.inputCard}>
          <Text style={styles.label}>Sok i loggen</Text>
          <TextInput
            style={styles.input}
            placeholder='F.eks: "Hva tok jeg sist i benk?"'
            placeholderTextColor="#4B5563"
            value={question}
            onChangeText={setQuestion}
            multiline
            returnKeyType="send"
            onSubmitEditing={() => handleAsk()}
          />
          <PrimaryButton title="Sok" onPress={() => handleAsk()} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ paddingBottom: SPACING.xxxl }}
        >
          {answer && (
            <View style={styles.answerCard}>
              <Text style={styles.answerTitle}>Svar</Text>
              <Text style={styles.answerText}>{answer}</Text>
            </View>
          )}

          <View style={styles.suggestionsCard}>
            <Text style={styles.suggestionsTitle}>Eksempler</Text>
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
