import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { ExerciseBundle } from '../../../shared/types';
import { colors, spacing, typography } from '../theme';

/** Filled play triangle with rounded corners. */
function PlayIcon({ size = 24, color = '#000000' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M8 5.5 L18.5 12 L8 18.5 Z"
        fill={color}
        stroke={color}
        strokeWidth={3}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </Svg>
  );
}

interface BundleCardProps {
  bundle: ExerciseBundle;
  onPress: () => void;
  /** When provided, shows a "Start" button that begins this workout in chat. */
  onStart?: () => void;
}

const titleize = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

export default function BundleCard({ bundle, onPress, onStart }: BundleCardProps) {
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

      {!!onStart && (
        <View style={styles.footer}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Start ${bundle.title}`}
            onPress={onStart}
            style={({ pressed }) => [styles.startBtn, pressed && styles.pressed]}
          >
            <PlayIcon size={24} color="#000000" />
          </Pressable>
        </View>
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
    borderColor: 'rgba(255,255,255,0.08)',
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
    backgroundColor: 'rgba(74,144,194,0.18)',
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
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: spacing.md,
  },
  startBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgb(166, 250, 4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
