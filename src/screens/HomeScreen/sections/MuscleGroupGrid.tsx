import React from 'react';
import {
  Text,
  TouchableOpacity,
  View,
  type ImageSourcePropType,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import type { TrainingBlock } from '../../../features/workouts';
import { getBlockTone } from '../../../shared/theme/blockTone';

type TileInteraction = {
  pressed: boolean;
  hovered: boolean;
};

type HomeTileButtonProps = {
  onPress: () => void;
  style: StyleProp<ViewStyle>;
  children: (interaction: TileInteraction) => React.ReactNode;
};

type HomeTileIconProps = {
  source: ImageSourcePropType | null;
  active: boolean;
  tintColor: string;
  activeTintColor: string;
};

type MuscleGroupGridStyles = {
  groupsColumn: StyleProp<ViewStyle>;
  groupsTitle: StyleProp<TextStyle>;
  groupsList: StyleProp<ViewStyle>;
  groupRow: StyleProp<ViewStyle>;
  groupDotSmall: StyleProp<ViewStyle>;
  groupRowText: StyleProp<TextStyle>;
  groupRowTextTight: StyleProp<TextStyle>;
  groupAction: StyleProp<ViewStyle>;
  groupActionText: StyleProp<TextStyle>;
  groupIconWrap: StyleProp<ViewStyle>;
};

export type MuscleGroupGridProps = {
  styles: MuscleGroupGridStyles;
  title: string | null;
  showList: boolean;
  blocks: readonly TrainingBlock[];
  themeTextStyle: StyleProp<TextStyle>;
  themeSurfaceStyle: StyleProp<ViewStyle>;
  groupIconWrapStyle: StyleProp<ViewStyle>;
  groupIconTintColor: string;
  groupIconActiveTintColor: string;
  onSelectBlock: (blockId: string) => void;
  onStartCardio?: () => void;
  showCardioStartAction?: boolean;
  labelForBlock: (block: TrainingBlock) => string;
  resolveBlockIcon: (blockId: string) => ImageSourcePropType | null;
  resolveDotColor: (blockId: string) => string;
  HomeTileButton: React.ComponentType<HomeTileButtonProps>;
  HomeTileIcon: React.ComponentType<HomeTileIconProps>;
};

export function MuscleGroupGrid(props: MuscleGroupGridProps) {
  const {
    styles,
    title,
    showList,
    blocks,
    themeTextStyle,
    themeSurfaceStyle,
    groupIconWrapStyle,
    groupIconTintColor,
    groupIconActiveTintColor,
    onSelectBlock,
    onStartCardio,
    showCardioStartAction,
    labelForBlock,
    resolveBlockIcon,
    resolveDotColor,
    HomeTileButton,
    HomeTileIcon,
  } = props;

  return (
    <View style={styles.groupsColumn}>
      {title ? <Text style={[styles.groupsTitle, themeTextStyle]}>{title}</Text> : null}
      {showList ? (
        <View style={styles.groupsList}>
          {blocks.map((block) => {
            const tone = getBlockTone(block.id);
            const icon = resolveBlockIcon(block.id);
            const blockText = labelForBlock(block);
            return (
              <HomeTileButton
                key={block.id}
                style={[styles.groupRow, themeSurfaceStyle]}
                onPress={() => onSelectBlock(block.id)}
              >
                {({ pressed, hovered }) => (
                  <>
                    <View style={[styles.groupDotSmall, { backgroundColor: resolveDotColor(block.id) }]} />
                    <Text
                      style={[styles.groupRowText, blockText.length >= 9 ? styles.groupRowTextTight : null, themeTextStyle]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                      adjustsFontSizeToFit
                      minimumFontScale={0.72}
                    >
                      {blockText}
                    </Text>
                    {showCardioStartAction && block.id === 'cardio' ? (
                      <TouchableOpacity
                        onPress={(e) => {
                          e.stopPropagation();
                          onStartCardio?.();
                        }}
                        style={[styles.groupAction, { backgroundColor: tone.accent }]}
                        activeOpacity={0.9}
                      >
                        <Text style={styles.groupActionText}>Start</Text>
                      </TouchableOpacity>
                    ) : null}
                    <View style={[styles.groupIconWrap, groupIconWrapStyle]}>
                      <HomeTileIcon
                        source={icon}
                        active={pressed || hovered}
                        tintColor={groupIconTintColor}
                        activeTintColor={groupIconActiveTintColor}
                      />
                    </View>
                  </>
                )}
              </HomeTileButton>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}
