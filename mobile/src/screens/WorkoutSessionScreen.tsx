import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

import { colors, spacing, typography } from '../theme';
import type { ExerciseBundle } from '../../../shared/types';

/**
 * Placeholder for the Workout Session screen.
 *
 * The full guided session (set tracking, rest timer, pause/resume, state
 * machine) is built in the next task. This stub exists so the "Start Workout"
 * action from the bundle detail screen has a destination.
 */
export default function WorkoutSessionScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const bundle: ExerciseBundle | undefined = route.params?.bundle;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{bundle?.title ?? 'Workout'}</Text>
      <Text style={styles.note}>Guided session coming next — set tracking, rest timer & more.</Text>
      <Pressable onPress={() => navigation.goBack()} style={styles.button} accessibilityRole="button">
        <Text style={styles.buttonText}>Back to workout</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  title: {
    ...typography.h1,
    color: colors.text,
    textAlign: 'center',
  },
  note: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  button: {
    marginTop: spacing.xl,
  },
  buttonText: {
    ...typography.bodyBold,
    color: colors.primary,
  },
});
