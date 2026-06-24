import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { colors, spacing, typography } from '../theme';
import type { OnboardingData } from '../stores/onboardingStore';

interface ProfileSummaryCardProps {
  data: OnboardingData;
  loading: boolean;
  onBuild: () => void;
}

const titleize = (s: string) =>
  s.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

export default function ProfileSummaryCard({ data, loading, onBuild }: ProfileSummaryCardProps) {
  const equipmentLabel =
    data.equipment.length === 0 || data.equipment.every((e) => e === 'none')
      ? 'None of these'
      : data.equipment.map(titleize).join(', ');

  const conditionsLabel =
    data.injuries.length === 0 || data.injuries.every((i) => i === 'none')
      ? 'None'
      : data.injuries.map(titleize).join(', ');

  const rows: Array<{ label: string; value: string }> = [
    { label: 'Name', value: data.name || '—' },
    { label: 'Age', value: data.age ? `${data.age} Years` : '—' },
    { label: 'Weight', value: data.weight_kg ? `${data.weight_kg} Kg` : '—' },
    { label: 'Height', value: data.height_cm ? `${data.height_cm} Cm` : '—' },
    { label: 'Goal', value: data.fitness_goal ? titleize(data.fitness_goal) : '—' },
    { label: 'Activity Level', value: data.activity_level ? titleize(data.activity_level) : '—' },
    { label: 'Equipment', value: equipmentLabel },
    { label: 'Conditions', value: conditionsLabel },
  ];

  return (
    <View style={styles.card}>
      <LinearGradient
        colors={['#274B73', '#3A7CA8']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <Text style={styles.overline}>YOUR PROFILE</Text>
        <Text style={styles.headerTitle}>Here's what I know about you</Text>
      </LinearGradient>

      <View style={styles.body}>
        {rows.map((row, i) => (
          <View key={row.label} style={[styles.row, i < rows.length - 1 && styles.rowDivider]}>
            <Text style={styles.rowLabel}>{row.label}</Text>
            <Text style={styles.rowValue} numberOfLines={1}>{row.value}</Text>
          </View>
        ))}

        <Pressable
          accessibilityRole="button"
          onPress={onBuild}
          disabled={loading}
          style={({ pressed }) => [styles.buttonWrap, pressed && styles.buttonPressed]}
        >
          <LinearGradient
            colors={['#FFA24D', '#F5821F']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.button}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Build My Plan  ›</Text>
            )}
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
    borderRadius: 20,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  overline: {
    ...typography.small,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  headerTitle: {
    ...typography.h3,
    color: '#FFFFFF',
  },
  body: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.08)',
  },
  rowLabel: {
    ...typography.body,
    fontSize: 15,
    color: colors.textSecondary,
  },
  rowValue: {
    ...typography.bodyBold,
    fontSize: 15,
    color: colors.text,
    flexShrink: 1,
    textAlign: 'right',
    marginLeft: spacing.md,
  },
  buttonWrap: {
    marginTop: spacing.lg,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#F5821F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonPressed: {
    opacity: 0.9,
  },
  button: {
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    ...typography.bodyBold,
    fontSize: 17,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
});
