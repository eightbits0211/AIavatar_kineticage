import { StyleSheet, View } from 'react-native';
import TabBarIcon from './TabBarIcon';

const GREEN = 'rgb(166, 250, 4)';

/**
 * Kin's brand mark — the green AI Coach glyph in a dark circle.
 * Used anywhere Kin is represented (chat bubbles, onboarding header, etc.).
 */
export default function KinLogo({ size = 36 }: { size?: number }) {
  return (
    <View style={[styles.wrap, { width: size, height: size, borderRadius: size / 2 }]}>
      <TabBarIcon name="coach" color={GREEN} size={Math.round(size * 0.6)} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#1C1C1E',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
