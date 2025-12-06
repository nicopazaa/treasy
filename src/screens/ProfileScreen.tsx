import React, { useState } from 'react';
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

interface Props {
  appState: AppState;
  onBack: () => void;
  onUpdate: (next: AppState) => void;
}

export const ProfileScreen: React.FC<Props> = ({
  appState,
  onBack,
  onUpdate,
}) => {
  const [nickname, setNickname] = useState(appState.nickname ?? '');
  const [height, setHeight] = useState(
    appState.heightCm != null ? String(appState.heightCm) : ''
  );
  const [weight, setWeight] = useState(
    appState.weightKg != null ? String(appState.weightKg) : ''
  );

  const handleSave = () => {
    const trimmedNickname = nickname.trim();

    const next: AppState = {
      ...appState,
      nickname: trimmedNickname || null,
      heightCm: height ? Number(height) || null : null,
      weightKg: weight ? Number(weight) || null : null,
    };

    onUpdate(next);
    onBack();
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.back}>{'< Tilbake'}</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Profil</Text>
        <Text style={styles.subtitle}>
          Tilpass hvordan Treasy ser ut og hva vi viser på startsiden.
        </Text>

        <View style={styles.card}>
          <Text style={styles.label}>Kallenavn</Text>
          <TextInput
            style={styles.input}
            placeholder="F.eks. Ninja"
            placeholderTextColor="#4B5563"
            value={nickname}
            onChangeText={setNickname}
          />
          <Text style={styles.helper}>
            Vises på hjemskjermen i stedet for e-post.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Høyde (cm)</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            placeholder="F.eks. 180"
            placeholderTextColor="#4B5563"
            value={height}
            onChangeText={setHeight}
          />

          <Text style={[styles.label, { marginTop: 12 }]}>Vekt (kg)</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            placeholder="F.eks. 80"
            placeholderTextColor="#4B5563"
            value={weight}
            onChangeText={setWeight}
          />
          <Text style={styles.helper}>
            Lagres lokalt – kan brukes senere til mer avansert analyse.
          </Text>
        </View>

        <View style={styles.buttonWrap}>
          <PrimaryButton title="Lagre" onPress={handleSave} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 40,
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
    marginBottom: 20,
  },
  card: {
    backgroundColor: '#020617',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: 14,
    marginBottom: 14,
  },
  label: {
    color: '#E5E7EB',
    marginBottom: 6,
    fontWeight: '500',
  },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1F2937',
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: '#F9FAFB',
    fontSize: 14,
  },
  helper: {
    marginTop: 6,
    color: '#6B7280',
    fontSize: 12,
  },
  buttonWrap: {
    marginTop: 16,
  },
});
