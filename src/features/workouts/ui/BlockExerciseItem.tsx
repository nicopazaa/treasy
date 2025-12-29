import React from 'react';
import type { GestureResponderEvent } from 'react-native';
import { Exercise } from '../model/types';
import { ExerciseRow } from '../../../shared/ui/ExerciseRow';
import { formatExerciseLabel } from '../../../shared/utils/exerciseLabel';

type Props = {
  exercise: Exercise;
  bestLabel: string | null;
  isMoving: boolean;
  onPress: () => void;
  onLongPress: () => void;
  onPressMenu: (event: GestureResponderEvent) => void;
};

export const BlockExerciseItem: React.FC<Props> = ({
  exercise,
  bestLabel,
  isMoving,
  onPress,
  onLongPress,
  onPressMenu,
}) => {
  return (
    <ExerciseRow
      name={formatExerciseLabel(exercise)}
      bestLabel={bestLabel || undefined}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressMenu={onPressMenu}
      moving={isMoving}
    />
  );
};
