import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { RADIUS, SCREEN_PADDING, SPACING, TEXT } from '../theme/tokens';

export type QuickActionsMenuItem = {
  id: string;
  icon: string;
  label: string;
  subtitle?: string;
  onPress: () => void;
};

type Props = {
  visible: boolean;
  title: string;
  items: QuickActionsMenuItem[];
  onClose: () => void;
};

export const QuickActionsMenu: React.FC<Props> = ({ visible, title, items, onClose }) => {
  const [rendered, setRendered] = useState(visible);
  const progress = useRef(new Animated.Value(0)).current;
  const closingRef = useRef(false);
  const useNativeDriver = Platform.OS !== 'web';

  const open = () => {
    closingRef.current = false;
    progress.stopAnimation();
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver,
    }).start();
  };

  const close = () => {
    closingRef.current = true;
    progress.stopAnimation();
    Animated.timing(progress, {
      toValue: 0,
      duration: 140,
      easing: Easing.in(Easing.cubic),
      useNativeDriver,
    }).start(({ finished }) => {
      if (finished) {
        setRendered(false);
        closingRef.current = false;
      }
    });
  };

  useEffect(() => {
    if (visible) {
      setRendered(true);
      open();
      return;
    }
    if (rendered) close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const requestClose = () => {
    if (closingRef.current) return;
    onClose();
  };

  const cardStyle = useMemo(
    () => [
      styles.card,
      {
        opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }),
        transform: [
          {
            translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }),
          },
          {
            scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1] }),
          },
        ],
      },
    ],
    [progress]
  );

  return (
    <Modal visible={rendered} transparent animationType="none" onRequestClose={requestClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={requestClose} />
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            styles.backdropDim,
            { opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }) },
          ]}
        />

        <Animated.View style={cardStyle}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>{title}</Text>
            <Pressable
              onPress={requestClose}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={({ pressed }) => [styles.closeButton, pressed ? styles.closeButtonPressed : null]}
            >
              <Text style={styles.closeText}>{'×'}</Text>
            </Pressable>
          </View>

          <View style={styles.list}>
            {items.map((item, index) => (
              <Pressable
                key={item.id}
                onPress={() => {
                  requestClose();
                  requestAnimationFrame(() => item.onPress());
                }}
                style={({ pressed }) => [
                  styles.itemRow,
                  index > 0 ? styles.itemDivider : null,
                  pressed ? styles.itemPressed : null,
                  pressed ? { transform: [{ scale: 0.99 }] } : null,
                ]}
              >
                <Text style={styles.itemIcon}>{item.icon}</Text>
                <View style={styles.itemText}>
                  <Text style={styles.itemLabel}>{item.label}</Text>
                  {item.subtitle ? <Text style={styles.itemSubtitle}>{item.subtitle}</Text> : null}
                </View>
                <Text style={styles.itemChevron}>{'>'}</Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    padding: SCREEN_PADDING,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdropDim: {
    backgroundColor: 'rgba(2, 6, 23, 0.78)',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#0A111F',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#1E293B',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 14 },
    elevation: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1E293B',
  },
  title: {
    color: '#E5E7EB',
    fontSize: TEXT.md,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  closeButton: {
    minWidth: 36,
    minHeight: 36,
    borderRadius: RADIUS.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonPressed: {
    backgroundColor: 'rgba(96, 165, 250, 0.10)',
  },
  closeText: {
    color: '#93C5FD',
    fontSize: TEXT.xl,
    fontWeight: '700',
    marginTop: -2,
  },
  list: {
    paddingBottom: SPACING.xs,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    minHeight: 56,
    gap: SPACING.md,
  },
  itemDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#1E293B',
  },
  itemPressed: {
    backgroundColor: 'rgba(96, 165, 250, 0.08)',
  },
  itemIcon: {
    width: 28,
    textAlign: 'center',
    fontSize: TEXT.lg,
  },
  itemText: {
    flex: 1,
    minWidth: 0,
  },
  itemLabel: {
    color: '#E2E8F0',
    fontSize: TEXT.sm,
    fontWeight: '700',
  },
  itemSubtitle: {
    marginTop: 2,
    color: '#94A3B8',
    fontSize: TEXT.xs,
    fontWeight: '600',
  },
  itemChevron: {
    color: '#64748B',
    fontSize: TEXT.md,
    fontWeight: '800',
  },
});

