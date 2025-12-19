import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native';
import { LabeledInput } from '../components/LabeledInput';
import { PrimaryButton } from '../components/PrimaryButton';
import { SPACING, TEXT } from '../theme/tokens';
import { AppLanguage } from '../types';
import { t } from '../i18n/i18n';

interface Props {
  language: AppLanguage;
  onBack: () => void;
  onComplete: (email: string) => void;
}

export const WelcomeScreen: React.FC<Props> = ({ language, onBack, onComplete }) => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleContinue = () => {
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes('@')) {
      setError(t(language, 'invalidEmail'));
      return;
    }
    setError(null);
    onComplete(trimmed);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.select({ ios: 'padding', android: undefined })}
    >
      <View style={styles.inner}>
        <TouchableOpacity onPress={onBack} hitSlop={8}>
          <Text style={styles.back}>{t(language, 'back')}</Text>
        </TouchableOpacity>

        <View style={styles.form}>
          <LabeledInput
            label={t(language, 'email')}
            placeholder={t(language, 'emailPlaceholder')}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            value={email}
            onChangeText={setEmail}
            returnKeyType="done"
            onSubmitEditing={handleContinue}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <PrimaryButton title={t(language, 'continue')} onPress={handleContinue} />
        </View>
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
    paddingHorizontal: SPACING.xxl,
    justifyContent: 'center',
  },
  back: {
    position: 'absolute',
    top: 56,
    left: SPACING.xxl,
    color: '#93C5FD',
    fontSize: TEXT.sm,
    fontWeight: '600',
  },
  form: {
    marginTop: SPACING.xxl,
  },
  error: {
    color: '#F97373',
    marginTop: 6,
  },
});
