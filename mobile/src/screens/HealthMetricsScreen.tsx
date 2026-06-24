import { ScrollView, StyleSheet, Text, View } from 'react-native';

import AppButton from '../components/AppButton';
import MetricCard from '../components/MetricCard';
import KinAvatar from '../components/KinAvatar';
import { colors, spacing, typography } from '../theme';
import { useOnboardingStore } from '../stores/onboardingStore';
import { useUserStore } from '../stores/userStore';

// Friendly, non-judgmental labels + accent colors for WHO BMI categories.
const BMI_CATEGORY: Record<string, { label: string; color: string }> = {
  underweight: { label: 'Underweight', color: '#4A90C2' },
  normal: { label: 'Normal', color: colors.success },
  overweight: { label: 'Overweight', color: colors.warning },
  obese: { label: 'Obese', color: colors.warning },
};

const formatNum = (n: number) => Math.round(n).toLocaleString();

export default function HealthMetricsScreen() {
  const metrics = useOnboardingStore((s) => s.metrics);
  const name = useOnboardingStore((s) => s.data.name);
  const setOnboarded = useUserStore((s) => s.setOnboarded);

  // Safety fallback: if we somehow arrive without metrics, let the user proceed.
  if (!metrics) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.fallbackText}>Your plan is ready!</Text>
        <AppButton label="Continue" variant="gradient" onPress={() => setOnboarded(true)} />
      </View>
    );
  }

  const category = BMI_CATEGORY[metrics.bmi_category] ?? {
    label: metrics.bmi_category,
    color: colors.text,
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <KinAvatar size={56} />
          <Text style={styles.title}>
            {name ? `Here's your snapshot, ${name}` : 'Your health snapshot'}
          </Text>
          <Text style={styles.subtitle}>
            A quick baseline so we can track your progress over time.
          </Text>
        </View>

        <MetricCard
          label="Body Mass Index (BMI)"
          value={metrics.bmi.toFixed(1)}
          caption={category.label}
          accent={category.color}
        />

        <MetricCard
          label="Daily Calorie Needs"
          value={`${formatNum(metrics.tdee_range.low)} – ${formatNum(metrics.tdee_range.high)}`}
          unit="kcal/day"
          caption="Estimated maintenance range (±5%)"
        />

        <MetricCard
          label="Max Heart Rate"
          value={`${metrics.max_heart_rate}`}
          unit="bpm"
          caption="Based on 220 − your age"
        />

        <MetricCard
          label="Target Training Zone"
          value={`${metrics.target_zone.low} – ${metrics.target_zone.high}`}
          unit="bpm"
          caption="60–80% of your max heart rate"
        />

        {/* Persistent disclaimer — required, not dismissible */}
        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>
            These numbers are estimates to guide your training — not medical advice.
            For health concerns, please consult a qualified professional.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <AppButton
          label="Let's get started →"
          variant="gradient"
          onPress={() => setOnboarded(true)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingTop: spacing.xxl,
    gap: spacing.md,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h2,
    color: colors.text,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  disclaimer: {
    backgroundColor: 'rgba(74,144,194,0.08)',
    borderRadius: 14,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  disclaimerText: {
    ...typography.small,
    color: colors.textSecondary,
    lineHeight: 18,
    textAlign: 'center',
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    backgroundColor: colors.background,
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.lg,
    backgroundColor: colors.background,
  },
  fallbackText: {
    ...typography.h2,
    color: colors.text,
  },
});
