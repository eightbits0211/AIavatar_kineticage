import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ExerciseBundle } from '../../../shared/types';
import { colors, spacing, typography } from '../theme';

interface BundleCardProps {
  bundle: ExerciseBundle;
  onPress: () => void;
}

const titleize = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

export default function BundleCard({ bundle, onPress }: BundleCardProps) {
  const recommended = bundle.is_recommended;
  const cal = bundle.estimated_calorie_burn;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        recommended && styles.cardRecommended,
        pressed && styles.pressed,
      ]}
    >
      {recommended && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>★  RECOMMENDED</Text>
        </View>
      )}

      <Text style={styles.title}>{bundle.title}</Text>

      <View style={styles.metaRow}>
        <Text style={styles.meta}>{bundle.estimated_duration_min} min</Text>
        <Text style={styles.dot}>·</Text>
        <Text style={styles.meta}>{bundle.exercises.length} exercises</Text>
        <Text style={styles.dot}>·</Text>
        <Text style={styles.meta}>{cal.low}–{cal.high} cal</Text>
      </View>

      {!!bundle.focus && (
        <View style={styles.focusChip}>
          <Text style={styles.focusText}>{titleize(bundle.focus)}</Text>
        </View>
      )}

      {!!bundle.rationale && (
        <Text style={styles.rationale} numberOfLines={2}>{bundle.rationale}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardRecommended: {
    borderColor: colors.primary,
    borderWidth: 1.5,
  },
  pressed: {
    opacity: 0.85,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    marginBottom: spacing.sm,
  },
  badgeText: {
    ...typography.small,
    color: '#FFFFFF',
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.5,
  },
  title: {
    ...typography.h3,
    color: colors.text,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    flexWrap: 'wrap',
  },
  meta: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  dot: {
    ...typography.caption,
    color: colors.textLight,
    marginHorizontal: spacing.sm,
  },
  focusChip: {
    alignSelf: 'flex-start',
    backgroundColor: '#EAF2FB',
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    marginTop: spacing.sm,
  },
  focusText: {
    ...typography.small,
    color: colors.primary,
    fontFamily: 'Inter_600SemiBold',
  },
  rationale: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    lineHeight: 19,
  },
});
