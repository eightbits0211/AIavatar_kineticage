import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../theme';

interface MetricCardProps {
  /** e.g. "BMI", "Daily Calories" */
  label: string;
  /** The big headline value, e.g. "22.4" or "1,850 – 2,040" */
  value: string;
  /** Optional unit shown next to the value, e.g. "kcal/day" or "bpm" */
  unit?: string;
  /** Optional small descriptor below, e.g. "Normal" or "60–80% of max HR" */
  caption?: string;
  /** Optional accent color for the value (used for BMI category, etc.) */
  accent?: string;
}

export default function MetricCard({ label, value, unit, caption, accent }: MetricCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.valueRow}>
        <Text style={[styles.value, accent ? { color: accent } : null]}>{value}</Text>
        {!!unit && <Text style={styles.unit}>{unit}</Text>}
      </View>
      {!!caption && <Text style={styles.caption}>{caption}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  value: {
    fontFamily: 'Inter_700Bold',
    fontSize: 26,
    color: colors.text,
  },
  unit: {
    ...typography.caption,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
  },
  caption: {
    ...typography.small,
    color: colors.textLight,
    marginTop: spacing.xs,
  },
});
