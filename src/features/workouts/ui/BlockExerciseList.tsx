import React from 'react';
import { FlatList, StyleSheet, View, Text } from 'react-native';
import { SPACING, TEXT } from '../../../shared/theme/tokens';
import { Surface } from '../../../shared/ui/Surface';

type Props<ItemT> = {
  data: ItemT[];
  renderItem: ({ item }: { item: ItemT }) => React.ReactElement;
  keyExtractor: (item: ItemT) => string;
  emptyText: string;
  extraBottomPadding?: number;
};

export function BlockExerciseList<ItemT>({
  data,
  renderItem,
  keyExtractor,
  emptyText,
  extraBottomPadding = 0,
}: Props<ItemT>) {
  return (
    <Surface style={styles.container}>
      <FlatList
        data={data}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={[
          styles.listContent,
          extraBottomPadding ? { paddingBottom: extraBottomPadding } : null,
          data.length === 0 && styles.emptyContent,
        ]}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={<Text style={styles.emptyText}>{emptyText}</Text>}
      />
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  listContent: {
    paddingVertical: 0,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginLeft: SPACING.lg,
    marginRight: SPACING.lg,
  },
  emptyContent: {
    paddingVertical: SPACING.md,
  },
  emptyText: {
    color: '#9CA3AF',
    fontSize: TEXT.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
});
