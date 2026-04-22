import React from 'react';
import type { GestureResponderEvent } from 'react-native';
import type { Exercise } from '..';
import { ExerciseRow } from '../../../shared/ui/ExerciseRow';
import { getBlockTone } from '../../../shared/theme/blockTone';
import { formatExerciseLabel } from '../../../shared/utils/exerciseLabel';

type Props = {
  exercise: Exercise;
  bestLabel: string | null;
  isMoving: boolean;
  variant?: 'dark' | 'light';
  onPress: () => void;
  onLongPress: () => void;
  onPressMenu: (event: GestureResponderEvent) => void;
};

export const BlockExerciseItem: React.FC<Props> = ({
  exercise,
  bestLabel,
  isMoving,
  variant = 'dark',
  onPress,
  onLongPress,
  onPressMenu,
}) => {
  const tone = getBlockTone(exercise.blockId);
  return (
    <ExerciseRow
      name={formatExerciseLabel(exercise)}
      bestLabel={bestLabel || undefined}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressMenu={onPressMenu}
      moving={isMoving}
      accentColor={tone.accent}
      variant={variant}
    />
  );
};
