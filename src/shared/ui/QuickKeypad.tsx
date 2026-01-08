import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { RADIUS, SPACING, TEXT } from '../theme/tokens';

type Props = {
  value?: string | null;
  onChange: (next: string) => void;
  rows: string[][];
  style?: ViewStyle;
  disabled?: boolean;
};

export const QuickKeypad: React.FC<Props> = ({ value, onChange, rows, style, disabled = false }) => {
  const press = (key: string) => {
    if (disabled) return;

    const currentValue = value ?? '';

    if (key === '⌫' || key === 'ƒO®') {
      if (!currentValue) return;
      onChange(currentValue.slice(0, -1));
      return;
    }

    if (key === 'C') {
      onChange('');
      return;
    }

    onChange(currentValue + key);
  };

  return (
    <View style={[styles.container, style]} pointerEvents={disabled ? 'none' : 'auto'}>
      {rows.map((row, rowIndex) => (
        <View key={`row-${rowIndex}`} style={styles.row}>
          {row.map((key) => (
            <TouchableOpacity
              key={key}
              style={[styles.key, (key === '⌫' || key === 'ƒO®' || key === 'C') && styles.keySecondary]}
              onPress={() => press(key)}
              activeOpacity={0.8}
            >
              <Text style={styles.keyText}>{key}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  row: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  key: {
    flex: 1,
    minHeight: 44,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#1F2937',
    backgroundColor: '#0B1220',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keySecondary: {
    backgroundColor: '#111827',
    borderColor: '#374151',
  },
  keyText: {
    color: '#F9FAFB',
    fontSize: TEXT.lg,
    fontWeight: '700',
  },
});
