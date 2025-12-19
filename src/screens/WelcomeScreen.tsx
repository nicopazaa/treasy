import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { LabeledInput } from '../components/LabeledInput';
import { PrimaryButton } from '../components/PrimaryButton';

interface Props {
  onComplete: (email: string) => void;
}

export const WelcomeScreen: React.FC<Props> = ({ onComplete }) => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  const handleStart = () => {
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes('@')) {
      setError('Skriv inn en gyldig e-post.');
      return;
    }
    setError('');
    onComplete(trimmed.toLowerCase());
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.select({ ios: 'padding', android: undefined })}
    >
      <View style={styles.inner}>
        <Text style={styles.title}>Treasy</Text>
        <Text style={styles.subtitle}>Training made easy. Logg styrketrening og progresjon enkelt.</Text>
        <View style={{ height: 24 }} />
        <LabeledInput
          label="E-post"
          placeholder="din@mail.no"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          value={email}
          onChangeText={setEmail}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <PrimaryButton title="Start Treasy" onPress={handleStart} />
        <Text style={styles.info}>
          Ingen passord, ingen PIN. Alt lagres lokalt på denne enheten og knyttes til din e-post.
        </Text>
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
    paddingTop: 80,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: '#F9FAFB',
  },
  subtitle: {
    marginTop: 8,
    color: '#9CA3AF',
    fontSize: 14,
  },
  error: {
    color: '#F97373',
    marginTop: 4,
  },
  info: {
    marginTop: 12,
    color: '#6B7280',
    fontSize: 12,
  },
});