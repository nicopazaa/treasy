import React from 'react';
import {
  Animated,
  Platform,
  Text,
  TouchableOpacity,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { STAT_NUMBER_STYLE } from '../../../shared/theme/typography';
import { styles as homeScreenStyles } from '../../HomeScreen.styles';

type PreviousWorkoutCardStyles = {
  lastWorkoutCard: StyleProp<ViewStyle>;
  lastWorkoutEmpty: StyleProp<TextStyle>;
  lastWorkoutDate: StyleProp<TextStyle>;
  lastWorkoutTitle: StyleProp<TextStyle>;
  lastWorkoutChips: StyleProp<ViewStyle>;
  previousWorkoutChipsReserved: StyleProp<ViewStyle>;
  muscleChip: StyleProp<ViewStyle>;
  muscleChipDot: StyleProp<ViewStyle>;
  muscleChipText: StyleProp<TextStyle>;
  previousWorkoutChipCompact: StyleProp<ViewStyle>;
  previousWorkoutChipTwoColumn: StyleProp<ViewStyle>;
  previousWorkoutChipDotCompact: StyleProp<ViewStyle>;
  previousWorkoutChipTextCompact: StyleProp<TextStyle>;
  previousWorkoutChipOverflowCompact: StyleProp<ViewStyle>;
  lastWorkoutTotalStack: StyleProp<ViewStyle>;
  lastWorkoutTotalLabel: StyleProp<TextStyle>;
  lastWorkoutTotalValue: StyleProp<TextStyle>;
  lastWorkoutMetricNumber: StyleProp<TextStyle>;
  lastWorkoutMetricUnit: StyleProp<TextStyle>;
  lastWorkoutMetricSeparator: StyleProp<TextStyle>;
  lastWorkoutDivider: StyleProp<ViewStyle>;
  lastWorkoutExampleBlock: StyleProp<ViewStyle>;
  lastWorkoutExampleName: StyleProp<TextStyle>;
  lastWorkoutExampleDetail: StyleProp<TextStyle>;
  lastWorkoutLink: StyleProp<TextStyle>;
};

export type PreviousWorkoutMuscleChip = {
  id: string;
  label: string;
  dotColor: string;
};

type ParsedSetLine = {
  weight: string;
  unitLabel: string;
  reps: string;
};

export type PreviousWorkoutCardDisplay =
  | {
      status: 'empty';
      message: string;
    }
  | {
      status: 'ready';
      dateLabel: string;
      titleText: string;
      muscleGroups: readonly PreviousWorkoutMuscleChip[];
      hiddenCount: number;
      totalVolumeTitleText: string;
      totalVolumeNumber: string;
      totalVolumeUnitLabel: string;
      hasExamples: boolean;
      exampleName: string;
      exampleSetLine: string;
      parsedSetLine: ParsedSetLine | null;
    };

export type PreviousWorkoutCardProps = {
  styles: PreviousWorkoutCardStyles;
  display: PreviousWorkoutCardDisplay;
  wrapInCard: boolean;
  cardStyle?: StyleProp<ViewStyle>;
  cardRef?: React.Ref<View>;
  onCardLayout?: (event: LayoutChangeEvent) => void;
  themeTextStyle: StyleProp<TextStyle>;
  themeTextMutedStyle: StyleProp<TextStyle>;
  themeAccentTextStyle: StyleProp<TextStyle>;
  themeLinkTextStyle: StyleProp<TextStyle>;
  themeChipStyle: StyleProp<ViewStyle>;
  lastWorkoutTitleToneStyle: StyleProp<TextStyle>;
  dividerColor: string;
  overflowChipDotColor: string;
  reduceMotionEnabled: boolean;
  expanded: boolean;
  exampleAnim: Animated.Value;
  openLogLabel: string;
  openLogAction: 'button' | 'text' | 'none';
  onOpenHistory?: () => void;
  useFluidChipLayout?: boolean;
};

export function PreviousWorkoutCard(props: PreviousWorkoutCardProps) {
  const {
    styles,
    display,
    wrapInCard,
    cardStyle,
    cardRef,
    onCardLayout,
    themeTextStyle,
    themeTextMutedStyle,
    themeAccentTextStyle,
    themeLinkTextStyle,
    themeChipStyle,
    lastWorkoutTitleToneStyle,
    dividerColor,
    overflowChipDotColor,
    reduceMotionEnabled,
    expanded,
    exampleAnim,
    openLogLabel,
    openLogAction,
    onOpenHistory,
    useFluidChipLayout = false,
  } = props;
  const compactTotalVolumeValueStyle = wrapInCard ? homeScreenStyles.previousWorkoutTotalVolumeValueCompact : null;
  const compactTotalVolumeUnitStyle = wrapInCard ? homeScreenStyles.previousWorkoutTotalVolumeUnitCompact : null;
  const compactExerciseNameStyle = wrapInCard ? homeScreenStyles.previousWorkoutExerciseNameCompact : null;
  const compactExerciseMetricsStyle = wrapInCard ? homeScreenStyles.previousWorkoutExerciseMetricsCompact : null;
  const compactExerciseMetricUnitStyle = wrapInCard ? homeScreenStyles.previousWorkoutExerciseMetricUnitCompact : null;
  const fluidChipLayoutEnabled = wrapInCard && useFluidChipLayout;
  const twoColumnChipStyle = wrapInCard && !fluidChipLayoutEnabled ? styles.previousWorkoutChipTwoColumn : null;
  const fluidChipContainerStyle = fluidChipLayoutEnabled ? homeScreenStyles.previousWorkoutChipsFluid : null;
  const hasExercisePreview = display.status === 'ready' && display.hasExamples;
  const reserveExercisePreview = wrapInCard && display.status === 'ready';
  const hideReservedExercisePreview = reserveExercisePreview && !hasExercisePreview;
  const chipMinimumFontScale = Platform.OS === 'ios' ? 0.78 : 0.84;
  const exampleDetailPlaceholderText = '000 kg x 00 reps';

  const renderExamples = () => {
    if (!hasExercisePreview) {
      if (!reserveExercisePreview) return null;
      return (
        <View
          style={[homeScreenStyles.previousWorkoutExercisePreviewReserved, homeScreenStyles.previousWorkoutExercisePreviewHidden]}
          pointerEvents="none"
        >
          <View style={styles.lastWorkoutExampleBlock}>
            <Text
              style={[styles.lastWorkoutExampleName, themeTextMutedStyle, STAT_NUMBER_STYLE, compactExerciseNameStyle]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {'\u00A0'}
            </Text>
            <View style={homeScreenStyles.previousWorkoutExerciseDetailRowReserved}>
              <Text
                style={[
                  styles.lastWorkoutExampleDetail,
                  themeTextStyle,
                  STAT_NUMBER_STYLE,
                  compactExerciseMetricsStyle,
                  homeScreenStyles.previousWorkoutExerciseDetailPlaceholder,
                ]}
                numberOfLines={1}
                ellipsizeMode="tail"
                pointerEvents="none"
              >
                {exampleDetailPlaceholderText}
              </Text>
            </View>
          </View>
        </View>
      );
    }

    const renderExampleDetailContent = () => {
      if (!display.exampleSetLine) return null;
      if (!display.parsedSetLine) {
        return (
          <Text
            style={[styles.lastWorkoutExampleDetail, themeTextStyle, STAT_NUMBER_STYLE, compactExerciseMetricsStyle]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {display.exampleSetLine}
          </Text>
        );
      }

      return (
        <Text
          style={[styles.lastWorkoutExampleDetail, themeTextStyle, STAT_NUMBER_STYLE, compactExerciseMetricsStyle]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          <Text style={[styles.lastWorkoutMetricNumber, themeTextStyle, compactExerciseMetricsStyle]}>
            {display.parsedSetLine.weight}
          </Text>
          <Text style={[styles.lastWorkoutMetricUnit, themeAccentTextStyle, compactExerciseMetricUnitStyle]}>
            {` ${display.parsedSetLine.unitLabel}`}
          </Text>
          <Text style={[styles.lastWorkoutMetricSeparator, themeTextStyle, compactExerciseMetricsStyle]}> x </Text>
          <Text style={[styles.lastWorkoutMetricNumber, themeTextStyle, compactExerciseMetricsStyle]}>
            {display.parsedSetLine.reps}
          </Text>
          <Text style={[styles.lastWorkoutMetricUnit, themeAccentTextStyle, compactExerciseMetricUnitStyle]}> reps</Text>
        </Text>
      );
    };

    const renderExampleDetail = () => {
      const detailContent = renderExampleDetailContent();
      if (!wrapInCard) return detailContent;

      return (
        <View style={homeScreenStyles.previousWorkoutExerciseDetailRowReserved}>
          {detailContent ?? (
            <Text
              style={[
                styles.lastWorkoutExampleDetail,
                themeTextStyle,
                STAT_NUMBER_STYLE,
                compactExerciseMetricsStyle,
                homeScreenStyles.previousWorkoutExerciseDetailPlaceholder,
              ]}
              numberOfLines={1}
              ellipsizeMode="tail"
              pointerEvents="none"
            >
              {exampleDetailPlaceholderText}
            </Text>
          )}
        </View>
      );
    };

    if (reduceMotionEnabled || expanded) {
      const content = (
        <View style={styles.lastWorkoutExampleBlock}>
          <Text
            style={[styles.lastWorkoutExampleName, themeTextMutedStyle, STAT_NUMBER_STYLE, compactExerciseNameStyle]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {display.exampleName}
          </Text>
          {renderExampleDetail()}
        </View>
      );
      return reserveExercisePreview ? (
        <View style={homeScreenStyles.previousWorkoutExercisePreviewReserved}>{content}</View>
      ) : (
        content
      );
    }

    const animatedContent = (
      <Animated.View
        style={[
          styles.lastWorkoutExampleBlock,
          {
            opacity: exampleAnim,
            transform: [{ translateY: exampleAnim.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }],
          },
        ]}
      >
        <Text
          style={[styles.lastWorkoutExampleName, themeTextMutedStyle, STAT_NUMBER_STYLE, compactExerciseNameStyle]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {display.exampleName}
        </Text>
        {renderExampleDetail()}
      </Animated.View>
    );
    return reserveExercisePreview ? (
      <View style={homeScreenStyles.previousWorkoutExercisePreviewReserved}>{animatedContent}</View>
    ) : (
      animatedContent
    );
  };

  const content = (
    <>
      {display.status === 'empty' ? (
        <Text style={[styles.lastWorkoutEmpty, themeTextMutedStyle]}>{display.message}</Text>
      ) : (
        <>
          <Text style={[styles.lastWorkoutDate, themeLinkTextStyle, STAT_NUMBER_STYLE]}>{display.dateLabel}</Text>
          <Text style={[styles.lastWorkoutTitle, lastWorkoutTitleToneStyle]}>{display.titleText}</Text>
          {display.muscleGroups.length || wrapInCard ? (
            <View
              style={[
                styles.lastWorkoutChips,
                wrapInCard && !fluidChipLayoutEnabled ? styles.previousWorkoutChipsReserved : null,
                fluidChipContainerStyle,
                expanded ? { justifyContent: 'center' } : null,
              ]}
            >
              {display.muscleGroups.map((group) => (
                <View key={group.id} style={[styles.muscleChip, styles.previousWorkoutChipCompact, twoColumnChipStyle, themeChipStyle]}>
                  <View style={[styles.muscleChipDot, styles.previousWorkoutChipDotCompact, { backgroundColor: group.dotColor }]} />
                  <Text
                    style={[styles.muscleChipText, styles.previousWorkoutChipTextCompact, themeTextStyle]}
                    numberOfLines={fluidChipLayoutEnabled ? undefined : 1}
                    ellipsizeMode="tail"
                    adjustsFontSizeToFit={!fluidChipLayoutEnabled}
                    minimumFontScale={chipMinimumFontScale}
                  >
                    {group.label}
                  </Text>
                </View>
              ))}
              {display.hiddenCount > 0 ? (
                <View
                  style={[
                    styles.muscleChip,
                    styles.previousWorkoutChipCompact,
                    twoColumnChipStyle,
                    styles.previousWorkoutChipOverflowCompact,
                    themeChipStyle,
                  ]}
                >
                  <View
                    style={[styles.muscleChipDot, styles.previousWorkoutChipDotCompact, { backgroundColor: overflowChipDotColor }]}
                  />
                  <Text style={[styles.muscleChipText, styles.previousWorkoutChipTextCompact, themeTextStyle]}>
                    {`(+${display.hiddenCount})`}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}
          <View style={styles.lastWorkoutTotalStack}>
            <Text style={[styles.lastWorkoutTotalLabel, themeTextMutedStyle]}>{display.totalVolumeTitleText}</Text>
            <Text style={[styles.lastWorkoutTotalValue, themeTextStyle, STAT_NUMBER_STYLE, compactTotalVolumeValueStyle]}>
              <Text style={[styles.lastWorkoutMetricNumber, themeTextStyle, compactTotalVolumeValueStyle]}>
                {display.totalVolumeNumber}
              </Text>
              {display.totalVolumeUnitLabel ? (
                <Text style={[styles.lastWorkoutMetricUnit, themeAccentTextStyle, compactTotalVolumeUnitStyle]}>
                  {` ${display.totalVolumeUnitLabel}`}
                </Text>
              ) : null}
            </Text>
          </View>
          {hasExercisePreview || reserveExercisePreview ? (
            <View
              style={hideReservedExercisePreview ? homeScreenStyles.previousWorkoutExercisePreviewHidden : null}
              pointerEvents={hideReservedExercisePreview ? 'none' : 'auto'}
            >
              <View style={[styles.lastWorkoutDivider, { backgroundColor: dividerColor }]} />
            </View>
          ) : null}
          {renderExamples()}
        </>
      )}

      {openLogAction === 'button' ? (
        <TouchableOpacity onPress={onOpenHistory} activeOpacity={0.85} hitSlop={8}>
          <Text style={[styles.lastWorkoutLink, themeLinkTextStyle]}>{openLogLabel}</Text>
        </TouchableOpacity>
      ) : openLogAction === 'text' ? (
        <Text style={[styles.lastWorkoutLink, themeLinkTextStyle]}>{openLogLabel}</Text>
      ) : null}
    </>
  );

  if (!wrapInCard) return content;

  return (
    <View ref={cardRef} onLayout={onCardLayout} style={[styles.lastWorkoutCard, cardStyle]}>
      {content}
    </View>
  );
}
