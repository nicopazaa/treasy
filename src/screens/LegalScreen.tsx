import React, { useMemo } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { t } from '../shared/i18n/i18n';
import { RADIUS, SCREEN_PADDING, SPACING, TEXT } from '../shared/theme/tokens';
import { AppLanguage } from '../shared/types';

type LegalDocument = 'privacy' | 'terms';

type Props = {
  language: AppLanguage;
  document: LegalDocument;
  onBack: () => void;
};

export const LegalScreen: React.FC<Props> = ({ language, document, onBack }) => {
  const title = document === 'privacy' ? t(language, 'legalPrivacyTitle') : t(language, 'legalTermsTitle');

  const paragraphs = useMemo(() => {
    if (document === 'privacy') {
      return [
        t(language, 'legalPrivacyIntro'),
        t(language, 'legalPrivacyData'),
        t(language, 'legalPrivacyLogin'),
        t(language, 'legalPrivacyContact'),
      ];
    }

    return [
      t(language, 'legalTermsIntro'),
      t(language, 'legalTermsUse'),
      t(language, 'legalTermsMedical'),
      t(language, 'legalTermsLiability'),
      t(language, 'legalTermsContact'),
    ];
  }, [document, language]);

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.85}>
            <Text style={styles.backText}>{t(language, 'back')}</Text>
          </TouchableOpacity>

          <Text style={styles.title}>{title}</Text>

          <View style={styles.card}>
            {paragraphs.map((paragraph, index) => (
              <Text key={`${document}-paragraph-${index}`} style={styles.paragraph}>
                {paragraph}
              </Text>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F3F6FB',
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xxl,
    ...Platform.select({
      web: {
        width: '100%',
        maxWidth: 760,
        alignSelf: 'center',
      },
    }),
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: SPACING.sm,
    paddingRight: SPACING.md,
    marginBottom: SPACING.sm,
  },
  backText: {
    color: '#2F6FBC',
    fontSize: TEXT.sm,
    fontFamily: 'Inter-SemiBold',
  },
  title: {
    color: '#0F172A',
    fontSize: TEXT.xxl,
    lineHeight: 36,
    letterSpacing: -0.4,
    fontFamily: 'Inter-Bold',
    marginBottom: SPACING.md,
  },
  card: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#D5E0EC',
    backgroundColor: '#FFFFFF',
    padding: SPACING.md,
  },
  paragraph: {
    color: '#334155',
    fontSize: TEXT.sm,
    lineHeight: 22,
    fontFamily: 'Inter-Regular',
    marginBottom: SPACING.sm,
  },
});
