import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '../theme';

export default function LoadingScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.brand}>KineticAge</Text>
      <ActivityIndicator color={colors.primary} size="large" style={styles.spinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  brand: {
    ...typography.h1,
    color: colors.primary,
  },
  spinner: {
    marginTop: spacing.lg,
  },
});
