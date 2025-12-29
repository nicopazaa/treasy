import React from 'react';
import { View, StyleSheet, ViewProps } from 'react-native';
import { RADIUS } from '../theme/tokens';

type SurfaceVariant = 'default' | 'raised';

type Props = ViewProps & {
  variant?: SurfaceVariant;
};

export const Surface: React.FC<Props> = ({
  variant = 'default',
  style,
  children,
  ...rest
}) => {
  return (
    <View
      {...rest}
      style={[
        styles.base,
        variant === 'raised' && styles.raised,
        style,
      ]}
    >
      {children}
    </View>
  );
};

const HAIRLINE = StyleSheet.hairlineWidth;

const styles = StyleSheet.create({
  base: {
    backgroundColor: '#0B1220',
    borderRadius: RADIUS.lg,

    // One and only frame rule for all surfaces
    borderWidth: HAIRLINE,
    borderColor: 'rgba(255,255,255,0.06)',
  },

  raised: {
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
});
