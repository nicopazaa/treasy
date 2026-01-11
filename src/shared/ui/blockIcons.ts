import type { ImageSourcePropType } from 'react-native';

import type { TrainingBlockId } from '../../features/workouts';

export const BLOCK_ICON_SOURCES: Record<TrainingBlockId, ImageSourcePropType> = {
  chest: require('../../assets/chest.png'),
  shoulders: require('../../assets/shoulder.png'),
  back: require('../../assets/back.png'),
  arms: require('../../assets/arms.png'),
  core: require('../../assets/core.png'),
  legs: require('../../assets/leggs.png'),
  cardio: require('../../assets/cardio.png'),
  bodyweight: require('../../assets/bodyweight.png'),
};

