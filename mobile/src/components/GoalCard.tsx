import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { FitnessGoal } from '../../../shared/types';
import { colors, spacing, typography } from '../theme';
import GoalIcon from './GoalIcon';

interface GoalCardProps {
  goal: FitnessGoal;
  title: string;
  subtitle: string;
  tint: string;
  iconColor: string;
  onPress: () => void;
}

export default function GoalCard({ goal, title, subtitle, tint, iconColor, onPress }: GoalCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={[styles.iconCircle, { backgroundColor: tint }]}>
        <GoalIcon goal={goal} size={20} color={iconColor} />
      </View>
      <View style={styles.textBlock}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        <Text style={styles.subtitle} numberOfLines={2}>{subtitle}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  pressed: {
    opacity: 0.7,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  textBlock: {
    flex: 1,
  },
  title: {
    ...typography.bodyBold,
    fontSize: 14,
    color: colors.text,
  },
  subtitle: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: 2,
  },
});
