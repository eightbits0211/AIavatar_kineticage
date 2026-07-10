import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import TabBarIcon from '../components/TabBarIcon';
import FeatureIcon, { type FeatureIconName } from '../components/FeatureIcon';
import { colors, spacing, typography } from '../theme';

const GREEN = 'rgb(166, 250, 4)';

const FEATURES: Array<{ icon: FeatureIconName; title: string; subtitle: string }> = [
  { icon: 'coaching', title: 'AI Coaching', subtitle: 'Personalized workouts and guidance, every single day.' },
  { icon: 'progress', title: 'Track Progress', subtitle: 'See your streaks, calories, and strength climb over time.' },
  { icon: 'goals', title: 'Smart Goals', subtitle: 'Plans that adapt to your body, equipment, and schedule.' },
  { icon: 'achievements', title: 'Achievements', subtitle: 'Earn XP and badges as you celebrate every win.' },
];

export default function WelcomeScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: Math.max(insets.top, 24) + spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Bare green Kin logo — no circle, ring, or glow */}
        <TabBarIcon name="coach" color={GREEN} size={52} />

        <Text style={styles.title}>Welcome to{'\n'}Kinetic Age</Text>
        <Text style={styles.subtitle}>Meet Kin — your AI fitness companion.</Text>

        <View style={styles.features}>
          {FEATURES.map((f) => (
            <View key={f.title} style={styles.featureRow}>
              <View style={styles.featureIcon}>
                <FeatureIcon name={f.icon} size={26} color={GREEN} />
              </View>
              <View style={styles.featureText}>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureSubtitle}>{f.subtitle}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Pinned bottom action */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.xxl }]}>
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate('Auth', { mode: 'signup' })}
          style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.ctaText}>Continue</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  title: {
    ...typography.h1,
    fontSize: 34,
    lineHeight: 40,
    color: '#FFFFFF',
    marginTop: spacing.lg,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  features: {
    marginTop: spacing.xxl,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.xl,
  },
  featureIcon: {
    width: 32,
    alignItems: 'center',
    marginRight: spacing.md,
    marginTop: 1,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    ...typography.bodyBold,
    fontSize: 17,
    color: '#FFFFFF',
  },
  featureSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 3,
    lineHeight: 19,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  cta: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2C2C2E',
    borderRadius: 30,
    paddingHorizontal: 72,
    paddingVertical: 18,
  },
  ctaText: {
    ...typography.bodyBold,
    color: '#FFFFFF',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 20,
  },
});
