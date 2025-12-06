import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
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

      <Text style={styles.appName}>Treasy</Text>
      <Text style={styles.tagline}>Train Easy With Treasy</Text>

      <Text style={styles.description}>
        Logg øktene dine enkelt, følg progresjonen din og la Treasy gi deg raske
        svar på alt du lurer på om treningen din – direkte fra loggen på
        telefonen.
      </Text>

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
    marginBottom: 20,
  },
  appName: {
    fontSize: 32,
    fontWeight: '800',
    color: '#F9FAFB',
  },
  tagline: {
    fontSize: 16,
    fontWeight: '500',
    color: '#93C5FD',
    marginTop: 4,
    marginBottom: 16,
  },
  description: {
    color: '#9CA3AF',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  buttonWrapper: {
    marginTop: 32,
    alignSelf: 'stretch',
  },
});
