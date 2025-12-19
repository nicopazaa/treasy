import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from '../shared/ui/PrimaryButton';
import { SPACING, TEXT, RADIUS, SCREEN_PADDING } from '../shared/theme/tokens';
import { AppLanguage } from '../shared/types';
import { t } from '../shared/i18n/i18n';

interface Props {
  language: AppLanguage;
  onBack: () => void;
  onContinueWithGithub: () => void;
  onContinueWithEmail: () => void;
  error?: string | null;
}

export const LoginScreen: React.FC<Props> = ({
  language,
  onBack,
  onContinueWithGithub,
  onContinueWithEmail,
  error,
}) => {
  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity onPress={onBack} hitSlop={12} style={styles.backButton} activeOpacity={0.8}>
        <Text style={styles.back}>{t(language, 'back')}</Text>
      </TouchableOpacity>

      <View style={styles.content}>
        <View style={styles.buttons}>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <PrimaryButton title={t(language, 'loginWithGithub')} onPress={onContinueWithGithub} />

          <TouchableOpacity style={styles.secondaryButton} onPress={onContinueWithEmail} activeOpacity={0.9}>
            <Text style={styles.secondaryText}>{t(language, 'loginWithEmail')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
    paddingHorizontal: SCREEN_PADDING,
    ...Platform.select({
      web: { width: '100%', maxWidth: 720, alignSelf: 'center' },
    }),
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  backButton: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
  },
  back: {
    color: '#93C5FD',
    fontSize: TEXT.sm,
    fontWeight: '600',
  },
  buttons: {
    gap: SPACING.md,
  },
  secondaryButton: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#1F2937',
    backgroundColor: '#0B1220',
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  secondaryText: {
    color: '#E5E7EB',
    fontSize: 16,
    fontWeight: '600',
  },
  error: {
    color: '#FCA5A5',
    fontSize: TEXT.sm,
    marginBottom: SPACING.xs,
  },
});
