import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { RADIUS, SPACING, TEXT } from '../theme/tokens';

const BACKSPACE_KEY = '\u232B';
const CLEAR_KEY = 'C';

type BaseProps = {
  rows: string[][];
  style?: ViewStyle;
  disabled?: boolean;
  variant?: 'dark' | 'light';
};

type ChangeProps = BaseProps & {
  value?: string | null;
  onChange: (next: string) => void;
  onKeyPress?: never;
};

type KeyPressProps = BaseProps & {
  onKeyPress: (key: string) => void;
  value?: never;
  onChange?: never;
};

type Props = ChangeProps | KeyPressProps;

function isChangeProps(props: Props): props is ChangeProps {
  return 'onChange' in props;
}

export const QuickKeypad: React.FC<Props> = (props) => {
  const { rows, style, disabled = false, variant = 'dark' } = props;
  const isLight = variant === 'light';

  const press = (key: string) => {
    if (disabled) return;

    if (!isChangeProps(props)) {
      props.onKeyPress(key);
      return;
    }

    const currentValue = props.value ?? '';

    if (key === BACKSPACE_KEY) {
      if (!currentValue) return;
      props.onChange(currentValue.slice(0, -1));
      return;
    }

    if (key === CLEAR_KEY) {
      props.onChange('');
      return;
    }

    props.onChange(currentValue + key);
  };

  return (
    <View style={[styles.container, style]} pointerEvents={disabled ? 'none' : 'auto'}>
      {rows.map((row, rowIndex) => (
        <View key={`row-${rowIndex}`} style={styles.row}>
          {row.map((key) => (
            <TouchableOpacity
              key={key}
              style={[
                styles.key,
                isLight ? styles.keyLight : styles.keyDark,
                (key === BACKSPACE_KEY || key === CLEAR_KEY) && (isLight ? styles.keySecondaryLight : styles.keySecondaryDark),
              ]}
              onPress={() => press(key)}
              activeOpacity={0.8}
            >
              <Text style={[styles.keyText, isLight ? styles.keyTextLight : styles.keyTextDark]}>{key}</Text>
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyDark: {
    borderColor: '#1F2937',
    backgroundColor: '#0B1220',
  },
  keyLight: {
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  keySecondaryDark: {
    backgroundColor: '#111827',
    borderColor: '#374151',
  },
  keySecondaryLight: {
    backgroundColor: '#E2E8F0',
    borderColor: '#CBD5E1',
  },
  keyText: {
    fontSize: TEXT.lg,
    fontWeight: '700',
  },
  keyTextDark: {
    color: '#F9FAFB',
  },
  keyTextLight: {
    color: '#1E293B',
  },
});
