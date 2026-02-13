import React from 'react';
import { Animated, Text, TouchableOpacity, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

type QuickLogCardStyles = {
  quickLogCard: StyleProp<ViewStyle>;
  quickLogTopSection: StyleProp<ViewStyle>;
  quickLogTitleRow: StyleProp<ViewStyle>;
  quickLogTitleCluster: StyleProp<ViewStyle>;
  quickLogTitle: StyleProp<TextStyle>;
  quickLogEmoji: StyleProp<TextStyle>;
  quickLogExampleRow: StyleProp<ViewStyle>;
  quickLogExampleText: StyleProp<TextStyle>;
  quickLogSubtitle: StyleProp<TextStyle>;
  quickLogMomentum: StyleProp<ViewStyle>;
  quickLogMomentumMain: StyleProp<TextStyle>;
  quickLogMomentumSub: StyleProp<TextStyle>;
  quickLogMomentumLink: StyleProp<TextStyle>;
};

export type QuickLogCardProps = {
  styles: QuickLogCardStyles;
  themeSurfaceStyle: StyleProp<ViewStyle>;
  quickLogCardToneStyle: StyleProp<ViewStyle>;
  onOpenQuickLog: () => void;
  quickLogTitleToneStyle: StyleProp<TextStyle>;
  quickLogTitleText: string;
  themeTextStyle: StyleProp<TextStyle>;
  reduceMotionEnabled: boolean;
  quickLogExampleToneStyle: StyleProp<TextStyle>;
  language: string;
  quickLogExamples: readonly string[];
  exampleIndex: number;
  exampleAnim: Animated.Value;
  themeLinkTextStyle: StyleProp<TextStyle>;
  momentumColor: string;
  momentumTrend: string;
  momentumMain: string;
  momentumBasedOn: string;
  themeTextMutedStyle: StyleProp<TextStyle>;
  scrollToAnalysis: () => void;
};

export function QuickLogCard(props: QuickLogCardProps) {
  const {
    styles,
    themeSurfaceStyle,
    quickLogCardToneStyle,
    onOpenQuickLog,
    quickLogTitleToneStyle,
    quickLogTitleText,
    themeTextStyle,
    reduceMotionEnabled,
    quickLogExampleToneStyle,
    language,
    quickLogExamples,
    exampleIndex,
    exampleAnim,
    themeLinkTextStyle,
    momentumColor,
    momentumTrend,
    momentumMain,
    momentumBasedOn,
    themeTextMutedStyle,
    scrollToAnalysis,
  } = props;

  return (
    <TouchableOpacity
      style={[styles.quickLogCard, themeSurfaceStyle, quickLogCardToneStyle]}
      onPress={onOpenQuickLog}
      activeOpacity={0.9}
    >
      <View style={styles.quickLogTopSection}>
        <View style={styles.quickLogTitleRow}>
          <View style={styles.quickLogTitleCluster}>
            <Text style={[styles.quickLogTitle, quickLogTitleToneStyle]}>{quickLogTitleText}</Text>
          </View>
          <Text style={[styles.quickLogEmoji, themeTextStyle]}>{'\uD83D\uDCDD'}</Text>
        </View>
        <View style={styles.quickLogExampleRow}>
          {reduceMotionEnabled ? (
            <Text style={[styles.quickLogExampleText, quickLogExampleToneStyle]}>
              {(language === 'nb' ? 'Skriv: ' : language === 'es' ? 'Escribe: ' : 'Type: ') + quickLogExamples[exampleIndex]}
            </Text>
          ) : (
            <Animated.Text
              style={[
                styles.quickLogExampleText,
                quickLogExampleToneStyle,
                {
                  opacity: exampleAnim,
                  transform: [
                    {
                      translateY: exampleAnim.interpolate({ inputRange: [0.46, 1], outputRange: [2, 0] }),
                    },
                    { scale: exampleAnim.interpolate({ inputRange: [0.46, 1], outputRange: [0.992, 1] }) },
                  ],
                },
              ]}
            >
              {(language === 'nb' ? 'Skriv: ' : language === 'es' ? 'Escribe: ' : 'Type: ') + quickLogExamples[exampleIndex]}
            </Animated.Text>
          )}
        </View>
        <Text style={[styles.quickLogSubtitle, themeLinkTextStyle]}>
          {language === 'nb' ? 'Trykk her for \u00E5 komme i gang' : 'Press here to start'}
        </Text>
      </View>

      <View style={styles.quickLogMomentum}>
        <Text style={[styles.quickLogMomentumMain, { color: momentumColor }]}>
          {momentumTrend === 'up' ? '\u2191 ' : momentumTrend === 'down' ? '\u2193 ' : ''}
          {momentumMain}
        </Text>
        <Text style={[styles.quickLogMomentumSub, themeTextMutedStyle]}>{momentumBasedOn}</Text>
        <TouchableOpacity onPress={scrollToAnalysis} hitSlop={8} activeOpacity={0.8}>
          <Text style={[styles.quickLogMomentumLink, themeLinkTextStyle]}>
            {language === 'nb' ? 'Mer detaljer' : 'More details'}
          </Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}
