import { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { colors, spacing, typography } from '../theme';
import { useUIStore } from '../stores/uiStore';
import type { ExerciseBundle } from '../../../shared/types';

const titleize = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

/** Filled play triangle with rounded corners — matches the bundle card start button. */
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

export default function BundleDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const bundle: ExerciseBundle = route.params?.bundle;

  // Hide the floating tab bar while viewing workout details; restore on exit.
  const setHideTabBar = useUIStore((s) => s.setHideTabBar);
  useFocusEffect(
    useCallback(() => {
      setHideTabBar(true);
      return () => setHideTabBar(false);
    }, [setHideTabBar]),
  );

  if (!bundle) return null;

  const cal = bundle.estimated_calorie_burn;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: Math.max(insets.top, 24) + spacing.lg }]} showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => navigation.goBack()} style={styles.back} accessibilityRole="button">
          <Text style={styles.backText}>‹  Back</Text>
        </Pressable>

        <View style={styles.headerRow}>
          <View style={styles.headerInfo}>
            <Text style={styles.title}>{bundle.title}</Text>
            <View style={styles.metaRow}>
              <Text style={styles.meta}>{bundle.estimated_duration_min} min</Text>
              <Text style={styles.dot}>·</Text>
              <Text style={styles.meta}>{bundle.exercises.length} exercises</Text>
              <Text style={styles.dot}>·</Text>
              <Text style={styles.meta}>{cal.low}–{cal.high} cal</Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Start ${bundle.title}`}
            onPress={() => navigation.navigate('WorkoutSession', { bundle })}
            style={({ pressed }) => [styles.startBtn, pressed && { opacity: 0.85 }]}
          >
            <PlayIcon size={24} color="#000000" />
          </Pressable>
        </View>

        {!!bundle.rationale && <Text style={styles.rationale}>{bundle.rationale}</Text>}

        <Text style={styles.sectionTitle}>Exercises</Text>
        {bundle.exercises.map((ex, i) => (
          <View key={`${ex.exercise_id}-${i}`} style={styles.exerciseRow}>
            <View style={styles.exerciseIndex}>
              <Text style={styles.exerciseIndexText}>{i + 1}</Text>
            </View>
            <View style={styles.exerciseBody}>
              <Text style={styles.exerciseName}>{ex.name}</Text>
              <Text style={styles.exerciseMeta}>
                {ex.sets} sets · {ex.rep_min}–{ex.rep_max} reps · {ex.rest_seconds}s rest
              </Text>
              {ex.muscle_groups?.length > 0 && (
                <Text style={styles.muscles}>{ex.muscle_groups.map(titleize).join(', ')}</Text>
              )}
            </View>
          </View>
        ))}

        <Text style={styles.formNote}>
          Choose a weight you can control with good form. When in doubt, go lighter.
        </Text>
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
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  back: {
    marginBottom: spacing.sm,
    alignSelf: 'flex-start',
  },
  backText: {
    ...typography.body,
    color: colors.primary,
    fontFamily: 'Inter_600SemiBold',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  headerInfo: {
    flex: 1,
  },
  startBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgb(166, 250, 4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.h1,
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
  rationale: {
    ...typography.body,
    fontSize: 15,
    color: colors.textSecondary,
    marginTop: spacing.md,
    lineHeight: 21,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  exerciseIndex: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: '#EAF2FB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  exerciseIndexText: {
    ...typography.bodyBold,
    fontSize: 13,
    color: colors.primary,
  },
  exerciseBody: {
    flex: 1,
  },
  exerciseName: {
    ...typography.bodyBold,
    fontSize: 15,
    color: colors.text,
  },
  exerciseMeta: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  muscles: {
    ...typography.small,
    color: colors.textLight,
    marginTop: 4,
  },
  formNote: {
    ...typography.caption,
    color: colors.textSecondary,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
  },
});
