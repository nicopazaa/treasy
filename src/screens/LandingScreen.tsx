import React from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { PrimaryButton } from '../components/PrimaryButton';
import { SPACING, TEXT, RADIUS } from '../theme/tokens';
import { AppLanguage } from '../types';
import { t } from '../i18n/i18n';

interface Props {
  language: AppLanguage;
  onContinueWithoutLogin: () => void;
  onLogin: () => void;
}

export const LandingScreen: React.FC<Props> = ({ language, onContinueWithoutLogin, onLogin }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Treasy</Text>
      <Text style={styles.subtitle}>{t(language, 'onboardingSubtitle')}</Text>
      <Text style={styles.body}>{t(language, 'onboardingBody')}</Text>

      <View style={styles.exampleCard}>
        <Text style={styles.exampleText}>{t(language, 'onboardingExample')}</Text>
      </View>

      <View style={styles.buttonWrapper}>
        <PrimaryButton title={t(language, 'continueWithoutLogin')} onPress={onContinueWithoutLogin} />
        <TouchableOpacity style={styles.secondaryButton} onPress={onLogin} hitSlop={8}>
          <Text style={styles.secondaryText}>{t(language, 'login')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xxl,
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    color: '#F9FAFB',
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: TEXT.lg,
    fontWeight: '600',
    color: '#E5E7EB',
    marginBottom: SPACING.xs,
  },
  body: {
    fontSize: TEXT.sm,
    color: '#9CA3AF',
    marginBottom: SPACING.xl,
  },
  exampleCard: {
    backgroundColor: '#0B1220',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#1F2937',
    paddingVertical: SPACING.xxl,
    paddingHorizontal: SPACING.xl,
    marginBottom: SPACING.xxl,
  },
  exampleText: {
    color: '#F9FAFB',
    fontSize: 22,
    fontWeight: '700',
  },
  buttonWrapper: {
    alignSelf: 'stretch',
  },
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  secondaryText: {
    color: '#93C5FD',
    fontSize: TEXT.sm,
    fontWeight: '600',
  },
});
