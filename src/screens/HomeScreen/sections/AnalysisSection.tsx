import React from 'react';
import { Text, TouchableOpacity, View, type LayoutChangeEvent, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { ProgressiveOverloadCard } from '../../../features/analytics/ui/ProgressiveOverloadCard';
import { PreviousWorkoutsTimeline } from '../../../features/analytics/ui/PreviousWorkoutsTimeline';
import type { AppLanguage } from '../../../shared/types';
import { STAT_NUMBER_STYLE } from '../../../shared/theme/typography';

type AnalysisSectionStyles = {
  analysisWrapper: StyleProp<ViewStyle>;
  analysisCards: StyleProp<ViewStyle>;
  analysisCardsPlain: StyleProp<ViewStyle>;
  volumeCard: StyleProp<ViewStyle>;
  volumeTitle: StyleProp<TextStyle>;
  volumeTopRow: StyleProp<ViewStyle>;
  volumeLabel: StyleProp<TextStyle>;
  volumeDeltaChip: StyleProp<ViewStyle>;
  volumeDeltaText: StyleProp<TextStyle>;
  volumeValue: StyleProp<TextStyle>;
  volumeToggleRow: StyleProp<ViewStyle>;
  volumeToggleText: StyleProp<TextStyle>;
  volumeToggleChevron: StyleProp<TextStyle>;
  volumeListWrapper: StyleProp<ViewStyle>;
  volumeEmptyText: StyleProp<TextStyle>;
  volumeList: StyleProp<ViewStyle>;
  volumeRow: StyleProp<ViewStyle>;
  volumeRowLabel: StyleProp<TextStyle>;
  volumeRowRight: StyleProp<ViewStyle>;
  volumeRowChange: StyleProp<TextStyle>;
  volumeRowValue: StyleProp<TextStyle>;
  analysisCard: StyleProp<ViewStyle>;
  cardTitle: StyleProp<TextStyle>;
  cardText: StyleProp<TextStyle>;
};

export type AnalysisVolumeRow = {
  id: string;
  label: string;
  changeText: string;
  changeColor: string;
  volumeText: string;
};

export type AnalysisSectionProps = {
  styles: AnalysisSectionStyles;
  onLayout: (event: LayoutChangeEvent) => void;
  progressiveOverload: {
    summary: string;
    deltaText: string | null;
    onPress: () => void;
    theme: React.ComponentProps<typeof ProgressiveOverloadCard>['theme'];
    borderless: boolean;
  };
  volume: {
    title: string;
    totalLabel: string;
    changeText: string;
    changeColor: string;
    deltaToneStyle: StyleProp<ViewStyle>;
    valueText: string;
    toggleLabel: string;
    toggleChevron: string;
    expanded: boolean;
    hasData: boolean;
    emptyText: string;
    rows: readonly AnalysisVolumeRow[];
    onToggleExpanded: () => void;
  };
  timeline: {
    language: AppLanguage;
    massUnit: 'kg' | 'lb';
    items: React.ComponentProps<typeof PreviousWorkoutsTimeline>['items'];
    resolveBlockLabel: (blockId: string | null) => string | null;
    resolveBlockColor: (blockId: string) => string;
    notesByDate: Record<string, string>;
    onPressDay: (dateKey: string) => void;
    theme: React.ComponentProps<typeof PreviousWorkoutsTimeline>['theme'];
    borderless: boolean;
  };
  bestLifts: {
    title: string;
    subtitle: string;
    onPress: () => void;
  };
  sectionSurfaceStyle: StyleProp<ViewStyle>;
  sectionBorderlessStyle: StyleProp<ViewStyle>;
  sectionAccentTextStyle: StyleProp<TextStyle>;
  sectionTextStyle: StyleProp<TextStyle>;
  sectionTextMutedStyle: StyleProp<TextStyle>;
  sectionLinkTextStyle: StyleProp<TextStyle>;
  volumeListStyle: StyleProp<ViewStyle>;
};

export function AnalysisSection(props: AnalysisSectionProps) {
  const {
    styles,
    onLayout,
    progressiveOverload,
    volume,
    timeline,
    bestLifts,
    sectionSurfaceStyle,
    sectionBorderlessStyle,
    sectionAccentTextStyle,
    sectionTextStyle,
    sectionTextMutedStyle,
    sectionLinkTextStyle,
    volumeListStyle,
  } = props;

  return (
    <View style={styles.analysisWrapper} onLayout={onLayout}>
      <View style={[styles.analysisCards, styles.analysisCardsPlain]}>
        <ProgressiveOverloadCard
          summary={progressiveOverload.summary}
          deltaText={progressiveOverload.deltaText}
          onPress={progressiveOverload.onPress}
          theme={progressiveOverload.theme}
          borderless={progressiveOverload.borderless}
        />

        <View style={[styles.volumeCard, sectionSurfaceStyle, sectionBorderlessStyle]}>
          <Text style={[styles.volumeTitle, sectionAccentTextStyle]}>{volume.title}</Text>
          <View style={styles.volumeTopRow}>
            <Text style={[styles.volumeLabel, sectionTextMutedStyle]}>{volume.totalLabel}</Text>
            <View style={[styles.volumeDeltaChip, volume.deltaToneStyle]}>
              <Text style={[styles.volumeDeltaText, { color: volume.changeColor }]}>{volume.changeText}</Text>
            </View>
          </View>
          <Text style={[styles.volumeValue, sectionTextStyle, STAT_NUMBER_STYLE]}>{volume.valueText}</Text>
          <TouchableOpacity onPress={volume.onToggleExpanded} activeOpacity={0.85} style={styles.volumeToggleRow} hitSlop={8}>
            <Text style={[styles.volumeToggleText, sectionLinkTextStyle]}>{volume.toggleLabel}</Text>
            <Text style={[styles.volumeToggleChevron, sectionTextMutedStyle]}>{volume.toggleChevron}</Text>
          </TouchableOpacity>
          {volume.expanded ? (
            <View style={[styles.volumeListWrapper, volumeListStyle]}>
              {!volume.hasData ? (
                <Text style={[styles.volumeEmptyText, sectionTextMutedStyle]}>{volume.emptyText}</Text>
              ) : (
                <View style={styles.volumeList}>
                  {volume.rows.map((row) => (
                    <View key={row.id} style={styles.volumeRow}>
                      <Text style={[styles.volumeRowLabel, sectionTextStyle]} numberOfLines={1}>
                        {row.label}
                      </Text>
                      <View style={styles.volumeRowRight}>
                        <Text style={[styles.volumeRowChange, STAT_NUMBER_STYLE, { color: row.changeColor }]}>{row.changeText}</Text>
                        <Text style={[styles.volumeRowValue, sectionTextMutedStyle, STAT_NUMBER_STYLE]}>{row.volumeText}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ) : null}
        </View>

        <PreviousWorkoutsTimeline
          language={timeline.language}
          massUnit={timeline.massUnit}
          items={timeline.items}
          resolveBlockLabel={timeline.resolveBlockLabel}
          resolveBlockColor={timeline.resolveBlockColor}
          notesByDate={timeline.notesByDate}
          onPressDay={timeline.onPressDay}
          theme={timeline.theme}
          borderless={timeline.borderless}
        />

        <TouchableOpacity style={[styles.analysisCard, sectionSurfaceStyle, sectionBorderlessStyle]} onPress={bestLifts.onPress} activeOpacity={0.9}>
          <Text style={[styles.cardTitle, sectionAccentTextStyle]}>{bestLifts.title}</Text>
          <Text style={[styles.cardText, sectionTextMutedStyle]}>{bestLifts.subtitle}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
