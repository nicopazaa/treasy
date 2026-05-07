import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { splitExerciseLabelParentheses } from '../utils/exerciseLabel';

type Props = {
  label: string;
  style?: StyleProp<ViewStyle>;
  mainStyle: StyleProp<TextStyle>;
  secondaryStyle?: StyleProp<TextStyle>;
  mainNumberOfLines?: number;
  secondaryNumberOfLines?: number;
};

export const ExerciseLabelText: React.FC<Props> = ({
  label,
  style,
  mainStyle,
  secondaryStyle,
  mainNumberOfLines = 1,
  secondaryNumberOfLines = 1,
}) => {
  const parts = splitExerciseLabelParentheses(label);

  return (
    <View style={[styles.container, style]}>
      <Text style={mainStyle} numberOfLines={mainNumberOfLines} ellipsizeMode="tail">
        {parts.main}
      </Text>
      {parts.parentheses ? (
        <Text style={secondaryStyle} numberOfLines={secondaryNumberOfLines} ellipsizeMode="tail">
          {parts.parentheses}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    minWidth: 0,
  },
});
