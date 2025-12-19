import React, { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, TouchableOpacity, SafeAreaView } from 'react-native';
import { LabeledInput } from '../shared/ui/LabeledInput';
import { PrimaryButton } from '../shared/ui/PrimaryButton';
import { SPACING, TEXT } from '../shared/theme/tokens';
import { AppLanguage } from '../shared/types';
import { t } from '../shared/i18n/i18n';

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
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.select({ ios: 'padding', android: undefined })}
      >
        <View style={styles.inner}>
          <TouchableOpacity onPress={onBack} hitSlop={12} style={styles.backButton} activeOpacity={0.8}>
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
    paddingHorizontal: Platform.OS === 'web' ? SPACING.xxxl : SPACING.xxl,
    justifyContent: 'center',
    ...Platform.select({
      web: { width: '100%', maxWidth: 720, alignSelf: 'center' },
    }),
  },
  backButton: {
    position: 'absolute',
    top: 0,
    left: Platform.OS === 'web' ? SPACING.xxxl : SPACING.xxl,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
  },
  back: {
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
