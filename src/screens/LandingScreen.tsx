import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RADIUS, SCREEN_PADDING, SPACING, TEXT } from '../shared/theme/tokens';
import { AppLanguage } from '../shared/types';
import { t } from '../shared/i18n/i18n';

interface Props {
  language: AppLanguage;
  onContinueWithoutLogin: () => void;
  onLogin: () => void;
  onOpenPrivacy: () => void;
  onOpenTerms: () => void;
}

type TextScenario = {
  input: string;
  output: string;
};

type QuickScenario = {
  path: string;
  result: string;
};

type QuickStepTone = {
  backgroundColor: string;
  borderColor: string;
  textColor: string;
};

const DEMO_ROTATE_MS = 6800;
const DEMO_DIM_OPACITY = 0.84;
const DEMO_FADE_OUT_MS = 140;
const DEMO_FADE_IN_MS = 180;
const QUICK_STEP_TONES: QuickStepTone[] = [
  { backgroundColor: '#EAF2FF', borderColor: '#D6E4FF', textColor: '#1E3A8A' },
  { backgroundColor: '#DDEAFF', borderColor: '#C8DCFF', textColor: '#1E3A8A' },
  { backgroundColor: '#CCE0FF', borderColor: '#B6D1FF', textColor: '#1E3A8A' },
  { backgroundColor: '#9EC1FF', borderColor: '#85B0FF', textColor: '#173A82' },
  { backgroundColor: '#2F6FBC', borderColor: '#295FA0', textColor: '#FFFFFF' },
];

function resolveQuickStepTone(index: number, total: number): QuickStepTone {
  if (total <= 1) return QUICK_STEP_TONES[0];
  const maxToneIndex = QUICK_STEP_TONES.length - 1;
  const ratio = index / Math.max(1, total - 1);
  const toneIndex = Math.round(ratio * maxToneIndex);
  return QUICK_STEP_TONES[toneIndex] ?? QUICK_STEP_TONES[maxToneIndex];
}

export const LandingScreen: React.FC<Props> = ({
  language,
  onContinueWithoutLogin,
  onLogin,
  onOpenPrivacy,
  onOpenTerms,
}) => {
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const demoOpacity = useRef(new Animated.Value(1)).current;

  const textScenarios: TextScenario[] = useMemo(
    () => [
      {
        input: t(language, 'landingScenario1Input'),
        output: t(language, 'landingScenario1Output'),
      },
      {
        input: t(language, 'landingScenario2Input'),
        output: t(language, 'landingScenario2Output'),
      },
      {
        input: t(language, 'landingScenario3Input'),
        output: t(language, 'landingScenario3Output'),
      },
    ],
    [language]
  );

  const quickScenarios: QuickScenario[] = useMemo(
    () => [
      {
        path: t(language, 'landingQuick1Path'),
        result: t(language, 'landingQuick1Result'),
      },
      {
        path: t(language, 'landingQuick2Path'),
        result: t(language, 'landingQuick2Result'),
      },
      {
        path: t(language, 'landingQuick3Path'),
        result: t(language, 'landingQuick3Result'),
      },
    ],
    [language]
  );

  const safeCount = Math.max(1, Math.min(textScenarios.length, quickScenarios.length));
  const textScenario = textScenarios[scenarioIndex];
  const quickScenario = quickScenarios[scenarioIndex];

  useEffect(() => {
    if (safeCount < 2) return;
    const timer = setInterval(() => {
      Animated.timing(demoOpacity, {
        toValue: DEMO_DIM_OPACITY,
        duration: DEMO_FADE_OUT_MS,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished) return;
        setScenarioIndex((prev) => (prev + 1) % safeCount);
        Animated.timing(demoOpacity, {
          toValue: 1,
          duration: DEMO_FADE_IN_MS,
          useNativeDriver: true,
        }).start();
      });
    }, DEMO_ROTATE_MS);
    return () => clearInterval(timer);
  }, [demoOpacity, safeCount]);

  const jumpScenario = (nextScenarioIndex: number) => {
    setScenarioIndex(nextScenarioIndex);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.glowOne} pointerEvents="none" />
      <View style={styles.glowTwo} pointerEvents="none" />
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.brandRow}>
            <Text style={styles.brandText}>Treasy</Text>
            <View style={styles.brandDot} />
          </View>

          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>{t(language, 'landingBadge')}</Text>
          </View>

          <View style={styles.demoCard}>
            <Animated.View style={[styles.showcaseBox, { opacity: demoOpacity }]}>
              <Text style={styles.showcaseBoxTitle}>{t(language, 'landingMethodText')}</Text>
              <Text style={styles.demoLabel}>{t(language, 'landingWriteLabel')}</Text>
              <Text style={styles.demoInput}>{textScenario.input}</Text>
              <View style={styles.parseCard}>
                <Text style={styles.parseLabel}>{t(language, 'landingParseLabel')}</Text>
                <Text style={[styles.parseValue, styles.parseValueSuccess]}>{textScenario.output}</Text>
              </View>
            </Animated.View>

            <Animated.View style={[styles.showcaseBox, styles.showcaseBoxCompact, { opacity: demoOpacity }]}>
              <Text style={styles.showcaseBoxTitle}>{t(language, 'landingMethodQuick')}</Text>
              <Text style={styles.demoLabel}>{t(language, 'landingQuickFlowLabel')}</Text>
              <View style={styles.quickStepsWrap}>
                {quickScenario.path.split(' > ').map((step, idx, arr) => {
                  const tone = resolveQuickStepTone(idx, arr.length);
                  return (
                    <React.Fragment key={`${step}-${idx}`}>
                      <View
                        style={[
                          styles.quickStepChip,
                          { backgroundColor: tone.backgroundColor, borderColor: tone.borderColor },
                        ]}
                      >
                        <Text style={[styles.quickStepText, { color: tone.textColor }]}>{step}</Text>
                      </View>
                      {idx < arr.length - 1 ? <Text style={styles.quickArrow}>{'>'}</Text> : null}
                    </React.Fragment>
                  );
                })}
              </View>
              <View style={styles.parseCard}>
                <Text style={styles.parseLabel}>{t(language, 'landingQuickResultLabel')}</Text>
                <Text style={[styles.parseValue, styles.parseValueSuccess]}>{quickScenario.result}</Text>
              </View>
            </Animated.View>

            <View style={styles.dotRow}>
              {Array.from({ length: safeCount }).map((_, idx) => (
                <TouchableOpacity
                  key={`scenario-${idx}`}
                  onPress={() => jumpScenario(idx)}
                  activeOpacity={0.8}
                  style={[styles.dotTouch, idx === scenarioIndex ? styles.dotTouchActive : null]}
                >
                  <View style={[styles.dot, idx === scenarioIndex ? styles.dotActive : null]} />
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.ctaWrap}>
            <TouchableOpacity style={styles.primaryCta} onPress={onContinueWithoutLogin} activeOpacity={0.88}>
              <Text style={styles.primaryCtaText}>{t(language, 'continueWithoutLogin')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={onLogin} hitSlop={8} activeOpacity={0.88}>
              <Text style={styles.secondaryText}>{t(language, 'landingContinueWithLogin')}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footerWrap}>
            <Text style={styles.trustText}>{t(language, 'landingTrust')}</Text>
            <Text style={styles.ownerText}>{t(language, 'landingOwnerLine')}</Text>
            <View style={styles.legalRow}>
              <TouchableOpacity onPress={onOpenPrivacy} activeOpacity={0.75} hitSlop={8}>
                <Text style={styles.legalLink}>{t(language, 'landingPrivacyLink')}</Text>
              </TouchableOpacity>
              <Text style={styles.legalDivider}>{'•'}</Text>
              <TouchableOpacity onPress={onOpenTerms} activeOpacity={0.75} hitSlop={8}>
                <Text style={styles.legalLink}>{t(language, 'landingTermsLink')}</Text>
              </TouchableOpacity>
            </View>
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
  glowOne: {
    position: 'absolute',
    top: -120,
    right: -88,
    width: 300,
    height: 300,
    borderRadius: 999,
    backgroundColor: 'rgba(59, 130, 246, 0.09)',
  },
  glowTwo: {
    position: 'absolute',
    top: 280,
    left: -90,
    width: 260,
    height: 260,
    borderRadius: 999,
    backgroundColor: 'rgba(148, 163, 184, 0.12)',
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
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: SPACING.md,
  },
  brandText: {
    color: '#2F6FBC',
    fontSize: 33,
    fontFamily: 'Inter-Bold',
    letterSpacing: -0.8,
  },
  brandDot: {
    width: 8,
    height: 8,
    marginLeft: 4,
    marginTop: 11,
    borderRadius: 999,
    backgroundColor: '#2DD4BF',
  },
  heroBadge: {
    alignSelf: 'center',
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: '#EAB308',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    marginBottom: SPACING.sm,
  },
  heroBadgeText: {
    color: '#854D0E',
    fontSize: TEXT.xs,
    fontFamily: 'Inter-SemiBold',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  demoCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#D5E0EC',
    backgroundColor: '#FFFFFF',
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    ...Platform.select({
      web: {
        boxShadow: '0 18px 30px rgba(15, 23, 42, 0.12)',
      },
      default: {
        shadowColor: '#0F172A',
        shadowOpacity: 0.08,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
      },
    }),
  },
  showcaseBox: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#DEE7F1',
    backgroundColor: '#F8FAFD',
    padding: SPACING.sm + 2,
    marginBottom: SPACING.md,
    alignItems: 'center',
  },
  showcaseBoxCompact: {
    marginBottom: SPACING.sm,
  },
  showcaseBoxTitle: {
    color: '#1E293B',
    fontSize: TEXT.sm,
    fontFamily: 'Inter-Bold',
    marginBottom: 6,
    textAlign: 'center',
  },
  demoLabel: {
    color: '#475569',
    fontSize: TEXT.xs,
    fontFamily: 'Inter-SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  demoInput: {
    color: '#0F172A',
    fontSize: TEXT.lg + 1,
    lineHeight: 24,
    letterSpacing: -0.2,
    fontFamily: 'Inter-SemiBold',
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  quickStepsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  quickStepChip: {
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: '#D4DDE8',
    backgroundColor: '#F8FAFD',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    marginBottom: SPACING.xs,
  },
  quickStepText: {
    color: '#1E293B',
    fontSize: TEXT.xs + 1,
    fontFamily: 'Inter-SemiBold',
  },
  quickArrow: {
    marginHorizontal: 4,
    marginBottom: SPACING.xs,
    color: '#94A3B8',
    fontSize: TEXT.sm,
    fontFamily: 'Inter-Bold',
  },
  parseCard: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#D5E0EC',
    backgroundColor: '#F8FAFD',
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs + 2,
    alignItems: 'center',
    width: '100%',
  },
  parseLabel: {
    color: '#2563EB',
    fontSize: TEXT.xs,
    fontFamily: 'Inter-SemiBold',
    marginBottom: 2,
    textAlign: 'center',
  },
  parseValue: {
    color: '#1E293B',
    fontSize: TEXT.xs + 2,
    lineHeight: 18,
    fontFamily: 'Inter-SemiBold',
    textAlign: 'center',
  },
  parseValueSuccess: {
    color: '#15803D',
  },
  dotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.xs,
  },
  dotTouch: {
    minWidth: 22,
    minHeight: 22,
    marginRight: SPACING.xs,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotTouchActive: {
    backgroundColor: '#E2E8F0',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: '#CBD5E1',
  },
  dotActive: {
    backgroundColor: '#3B82F6',
    width: 16,
    borderRadius: RADIUS.pill,
  },
  ctaWrap: {
    marginTop: SPACING.sm,
    alignItems: 'center',
  },
  primaryCta: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#111827',
    backgroundColor: '#111827',
    paddingVertical: SPACING.md + 1,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
    width: '50%',
  },
  primaryCtaText: {
    color: '#FFFFFF',
    fontSize: TEXT.md,
    fontFamily: 'Inter-Bold',
  },
  secondaryButton: {
    marginTop: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#9BBDF7',
    backgroundColor: '#DBEAFE',
    paddingVertical: SPACING.md + 1,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
    width: '50%',
  },
  secondaryText: {
    color: '#1E40AF',
    fontSize: TEXT.md,
    fontFamily: 'Inter-SemiBold',
  },
  footerWrap: {
    marginTop: 'auto',
    alignItems: 'center',
  },
  trustText: {
    marginTop: SPACING.sm,
    color: '#64748B',
    fontSize: TEXT.xs,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
  },
  ownerText: {
    marginTop: 6,
    color: '#7A869A',
    fontSize: TEXT.xs,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
  },
  legalRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  legalLink: {
    color: '#7A869A',
    fontSize: TEXT.xs,
    fontFamily: 'Inter-SemiBold',
    textDecorationLine: 'underline',
  },
  legalDivider: {
    marginHorizontal: 8,
    color: '#94A3B8',
    fontSize: TEXT.xs,
    fontFamily: 'Inter-Regular',
  },
});
