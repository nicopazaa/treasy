import React from 'react';
import {
  GestureResponderEvent,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SPACING, TEXT, COLORS } from '../theme/tokens';

type Props = {
  name: string;
  bestLabel?: string | null;
  showStar?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
  onPressMenu: (event: GestureResponderEvent) => void;
  moving?: boolean;
};

export const ExerciseRow: React.FC<Props> = ({
  name,
  bestLabel,
  showStar = Boolean(bestLabel),
  onPress,
  onLongPress,
  onPressMenu,
  moving = false,
}) => {
  return (
    <TouchableOpacity
      style={[styles.row, moving && styles.rowMoving]}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={240}
      activeOpacity={0.85}
    >
      <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">
        {name}
      </Text>

      <View style={styles.right} pointerEvents="box-none">
        {bestLabel ? (
          <View style={styles.bestWrap} pointerEvents="none">
            <Text style={styles.bestText} numberOfLines={1} ellipsizeMode="tail">
              {bestLabel}
            </Text>
            {showStar ? <Text style={styles.star}>⭐</Text> : null}
          </View>
        ) : null}

        <TouchableOpacity
          style={styles.kebabButton}
          onPress={(event) => {
            event.stopPropagation?.();
            onPressMenu(event);
          }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.85}
        >
          <Text style={styles.kebabText}>{'...'}</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    minHeight: 56,
  },
  rowMoving: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  name: {
    flex: 1,
    color: '#F9FAFB',
    fontSize: TEXT.md,
    fontWeight: '700',
    marginRight: SPACING.sm,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flexShrink: 0,
  },
  bestWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    maxWidth: 180,
    flexShrink: 1,
    minWidth: 0,
  },
  bestText: {
    color: '#9CA3AF',
    fontSize: TEXT.xs,
    fontWeight: '600',
  },
  star: {
    fontSize: TEXT.md,
    lineHeight: TEXT.md + 2,
    color: COLORS.warning,
  },
  kebabButton: {
    width: 40,
    height: 40,
    minWidth: 40,
    minHeight: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: SPACING.xs,
  },
  kebabText: {
    color: '#E5E7EB',
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 22,
    marginTop: -2,
  },
});
