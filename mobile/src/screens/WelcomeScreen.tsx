import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';

import KinAvatar from '../components/KinAvatar';
import FeatureIcon, { type FeatureIconName } from '../components/FeatureIcon';
import { colors, spacing, typography } from '../theme';

const FEATURES: Array<{
  icon: FeatureIconName;
  title: string;
  subtitle: string;
  tint: string;
  iconColor: string;
}> = [
  { icon: 'coaching', title: 'AI Coaching', subtitle: 'Personalized every day', tint: '#EAF2FB', iconColor: '#4A90C2' },
  { icon: 'progress', title: 'Progress', subtitle: 'Track every milestone', tint: '#E8F1FB', iconColor: '#4A90C2' },
  { icon: 'goals', title: 'Smart Goals', subtitle: 'Adaptive to your life', tint: '#FDECEC', iconColor: '#E8772E' },
  { icon: 'achievements', title: 'Achievements', subtitle: 'Celebrate your wins', tint: '#FBF3E0', iconColor: '#E0A21A' },
];

export default function WelcomeScreen() {
  const navigation = useNavigation<any>();

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Clean gradient header with a smooth rounded bottom */}
        <LinearGradient
          colors={['#4A90C2', '#3A7CA8']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <Text style={styles.brand}>Kinetic Age</Text>
          <Text style={styles.tagline}>Move. Progress. Repeat.</Text>
        </LinearGradient>

        <View style={styles.avatarWrap}>
          <KinAvatar size={96} />
        </View>

        <View style={styles.introCard}>
          <Text style={styles.introText}>
            Hi, I'm <Text style={styles.introBold}>Kin</Text> — your AI fitness companion. I'll build
            personalized workouts, guide every session, and help you reach your goals. Just for you.
          </Text>
        </View>

        <View style={styles.grid}>
          {FEATURES.map((f) => (
            <View key={f.title} style={styles.featureCard}>
              <View style={[styles.featureIcon, { backgroundColor: f.tint }]}>
                <FeatureIcon name={f.icon} size={20} color={f.iconColor} />
              </View>
              <View style={styles.featureText}>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureSubtitle}>{f.subtitle}</Text>
              </View>
            </View>
          ))}
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate('Auth', { mode: 'signup' })}
          style={({ pressed }) => [styles.ctaWrap, pressed && styles.ctaPressed]}
        >
          <LinearGradient
            colors={['#FFA24D', '#F5821F']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.cta}
          >
            <Text style={styles.ctaText}>Get Started  ›</Text>
          </LinearGradient>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate('Auth', { mode: 'login' })}
          style={styles.signInRow}
        >
          <Text style={styles.signInText}>
            Already have an account? <Text style={styles.signInLink}>Sign In</Text>
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    paddingBottom: spacing.xl,
  },
  header: {
    paddingTop: spacing.xxl + spacing.md,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  brand: {
    ...typography.h1,
    fontSize: 30,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  tagline: {
    ...typography.body,
    color: 'rgba(255,255,255,0.85)',
    marginTop: spacing.xs,
  },
  avatarWrap: {
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  introCard: {
    marginHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  introText: {
    ...typography.body,
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
    textAlign: 'center',
  },
  introBold: {
    fontFamily: 'Inter_700Bold',
    color: colors.primary,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },
  featureCard: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: spacing.md,
    marginBottom: spacing.md,
    minHeight: 64,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    ...typography.bodyBold,
    fontSize: 14,
    color: colors.text,
  },
  featureSubtitle: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: 2,
  },
  ctaWrap: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#F5821F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  ctaPressed: {
    opacity: 0.9,
  },
  cta: {
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    ...typography.bodyBold,
    fontSize: 17,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  signInRow: {
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  signInText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  signInLink: {
    color: colors.primary,
    fontFamily: 'Inter_600SemiBold',
  },
});
