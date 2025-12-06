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
      setAnswer('Skriv inn et spørsmål først 😊');
      return;
    }
    const res = answerAiQuestion(appState, query, ctxExerciseId);
    setAnswer(res);
  };

  const suggestions = [
    'Hva tok jeg sist i benkpress?',
    'Hva er PR-en min i markløft?',
    'Hvor mange reps på 100 kg har jeg gjort i benkpress de siste 30 dagene?',
    'Hva gjorde jeg på siste økt?',
    'Hvordan ligger jeg an i knebøy?',
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

        <Text style={styles.title}>Treasy AI</Text>
        <Text style={styles.subtitle}>
          En enkel, lokal "AI" som bruker loggen din til å svare på spørsmål om
          øktene dine.
        </Text>

        <View style={styles.inputCard}>
          <Text style={styles.label}>Spør Treasy</Text>
          <TextInput
            style={styles.input}
            placeholder='F.eks: "Hva tok jeg sist i benkpress?"'
            placeholderTextColor="#4B5563"
            value={question}
            onChangeText={setQuestion}
            multiline
            returnKeyType="send"
            onSubmitEditing={() => handleAsk()}
          />
          <PrimaryButton title="Spør" onPress={() => handleAsk()} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          {answer && (
            <View style={styles.answerCard}>
              <Text style={styles.answerTitle}>Svar</Text>
              <Text style={styles.answerText}>{answer}</Text>
            </View>
          )}

          <View style={styles.suggestionsCard}>
            <Text style={styles.suggestionsTitle}>Eksempler du kan spørre</Text>
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
    paddingHorizontal: 20,
    paddingTop: 60,
  },
  back: {
    color: '#93C5FD',
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#F9FAFB',
  },
  subtitle: {
    marginTop: 4,
    color: '#9CA3AF',
    marginBottom: 16,
  },
  inputCard: {
    backgroundColor: '#020617',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: 14,
    marginBottom: 12,
  },
  label: {
    color: '#E5E7EB',
    marginBottom: 6,
  },
  input: {
    minHeight: 60,
    maxHeight: 120,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: 10,
    color: '#F9FAFB',
    marginBottom: 10,
  },
  scroll: {
    flex: 1,
    marginTop: 4,
  },
  answerCard: {
    backgroundColor: '#020617',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: 14,
    marginBottom: 12,
  },
  answerTitle: {
    color: '#F9FAFB',
    fontWeight: '700',
    marginBottom: 4,
  },
  answerText: {
    color: '#E5E7EB',
    fontSize: 14,
  },
  suggestionsCard: {
    backgroundColor: '#020617',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: 14,
  },
  suggestionsTitle: {
    color: '#F9FAFB',
    fontWeight: '700',
    marginBottom: 8,
  },
  suggestionRow: {
    paddingVertical: 4,
  },
  suggestionText: {
    color: '#93C5FD',
    fontSize: 14,
  },
});
