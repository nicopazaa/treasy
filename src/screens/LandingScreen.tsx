import React from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { PrimaryButton } from '../components/PrimaryButton';

interface Props {
  onContinue: () => void;
}

export const LandingScreen: React.FC<Props> = ({ onContinue }) => {
  return (
    <View style={styles.container}>
      <Image
        source={require('../assets/treasy-logo.png')}
        style={styles.logoImage}
        resizeMode="contain"
      />

      <View style={styles.buttonWrapper}>
        <PrimaryButton title="Open Treasy" onPress={onContinue} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  logoImage: {
    width: 130,
    height: 130,
    marginBottom: 24,
  },
  buttonWrapper: {
    marginTop: 24,
    alignSelf: 'stretch',
  },
});
