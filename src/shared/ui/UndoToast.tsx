import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ViewStyle, StyleProp } from 'react-native';
import { SPACING, TEXT, RADIUS, COLORS } from '../theme/tokens';

type Props = {
  visible: boolean;
  message: string;
  actionLabel: string;
  onAction: () => void;
  style?: StyleProp<ViewStyle>;
};

export const UndoToast: React.FC<Props> = ({ visible, message, actionLabel, onAction, style }) => {
  if (!visible) return null;

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.message}>{message}</Text>
      <TouchableOpacity
        onPress={onAction}
        style={styles.actionButton}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        activeOpacity={0.85}
      >
        <Text style={styles.actionText}>{actionLabel}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: '#0B1220',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#1F2937',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    gap: SPACING.sm,
  },
  message: {
    flex: 1,
    color: '#F9FAFB',
    fontSize: TEXT.sm,
    fontWeight: '700',
  },
  actionButton: {
    minWidth: 44,
    minHeight: 44,
    paddingHorizontal: SPACING.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionText: {
    color: COLORS.blue2,
    fontSize: TEXT.sm,
    fontWeight: '800',
  },
});
