import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, typography } from '../theme';

const NAVY = '#16365A';
const ORANGE = '#F5821F';

export interface WorkoutSummary {
  status?: string;
  exercises_completed?: number;
  exercises_planned?: number;
  completion_ratio?: number;
  calories_burned?: number;
  xp_awarded?: number;
  xp_breakdown?: Array<{ source: string; amount: number }>;
  new_total_xp?: number;
  level?: number;
  streak?: { current?: number; longest?: number; milestone?: string | null };
  progression_flags?: Array<{ type?: string; exercise_name?: string; message?: string } | any>;
  badges_earned?: Array<{ badge_id?: string; name?: string; description?: string } | any>;
}

interface Props {
  visible: boolean;
  summary: WorkoutSummary | null;
  onClose: () => void;
}

const titleize = (s?: string) => (s ? s.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()) : '');

/**
 * Post-workout summary — renders the POST /api/session/:id/end response
 * (completion, calories, XP + breakdown, streak, badges, progressions).
 */
export default function WorkoutSummaryModal({ visible, summary, onClose }: Props) {
  if (!summary) return null;

  const done = summary.exercises_completed ?? 0;
  const planned = summary.exercises_planned ?? 0;
  const pct = summary.completion_ratio ?? 0;
  const badges = summary.badges_earned ?? [];
  const flags = summary.progression_flags ?? [];
  const milestone = summary.streak?.milestone;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <LinearGradient colors={['#2D6CA8', '#1E4E7E']} style={styles.header}>
            <Text style={styles.headerEmoji}>🎉</Text>
            <Text style={styles.headerTitle}>Workout Complete</Text>
            <Text style={styles.headerSub}>
              {done} of {planned} exercises · {pct}% complete
            </Text>
          </LinearGradient>

          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            {/* Headline stats */}
            <View style={styles.statRow}>
              <Stat label="XP earned" value={`+${summary.xp_awarded ?? 0}`} accent={ORANGE} />
              <Stat label="Calories" value={`${summary.calories_burned ?? 0}`} accent={colors.primary} />
              <Stat label="Level" value={`${summary.level ?? 1}`} accent={NAVY} />
            </View>

            {/* Streak */}
            {!!summary.streak && (
              <View style={styles.card}>
                <Text style={styles.cardLabel}>Streak</Text>
                <Text style={styles.cardValue}>
                  {summary.streak.current ?? 0} day{(summary.streak.current ?? 0) === 1 ? '' : 's'}
                  {milestone ? `  ·  ${milestone}` : ''}
                </Text>
              </View>
            )}

            {/* XP breakdown */}
            {!!summary.xp_breakdown?.length && (
              <View style={styles.card}>
                <Text style={styles.cardLabel}>XP breakdown</Text>
                {summary.xp_breakdown.map((b, i) => (
                  <View key={`${b.source}-${i}`} style={styles.lineRow}>
                    <Text style={styles.lineText}>{titleize(b.source)}</Text>
                    <Text style={styles.lineAmount}>+{b.amount}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Badges */}
            {badges.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.cardLabel}>🏆 New badges</Text>
                {badges.map((b: any, i: number) => (
                  <Text key={b.badge_id ?? i} style={styles.badgeText}>
                    {b.name ?? b.badge_id}{b.description ? ` — ${b.description}` : ''}
                  </Text>
                ))}
              </View>
            )}

            {/* Progressions */}
            {flags.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.cardLabel}>Ready to level up</Text>
                {flags.map((f: any, i: number) => (
                  <Text key={i} style={styles.lineText}>
                    {f.message || f.exercise_name || titleize(f.type) || 'Progression unlocked'}
                  </Text>
                ))}
              </View>
            )}
          </ScrollView>

          <Pressable onPress={onClose} style={styles.doneWrap} accessibilityRole="button" accessibilityLabel="Close summary">
            <LinearGradient colors={['#FFA24D', ORANGE]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.doneBtn}>
              <Text style={styles.doneText}>Done</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color: accent }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(16,32,54,0.55)', justifyContent: 'center', padding: spacing.lg },
  sheet: { backgroundColor: colors.background, borderRadius: 24, overflow: 'hidden', maxHeight: '85%' },
  header: { alignItems: 'center', paddingVertical: spacing.xl, paddingHorizontal: spacing.lg },
  headerEmoji: { fontSize: 36 },
  headerTitle: { ...typography.h1, fontSize: 24, color: '#FFFFFF', marginTop: spacing.sm },
  headerSub: { ...typography.caption, color: 'rgba(255,255,255,0.85)', marginTop: 4 },
  body: { padding: spacing.lg, gap: spacing.md },
  statRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xs },
  stat: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  statValue: { ...typography.h2 },
  statLabel: { ...typography.small, color: colors.textSecondary, marginTop: 2 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  cardLabel: { ...typography.small, color: colors.textSecondary, fontFamily: 'Inter_700Bold', letterSpacing: 0.5, marginBottom: spacing.sm },
  cardValue: { ...typography.h3, color: NAVY, fontFamily: 'Inter_700Bold' },
  lineRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 3 },
  lineText: { ...typography.caption, color: NAVY, flex: 1 },
  lineAmount: { ...typography.bodyBold, color: ORANGE },
  badgeText: { ...typography.caption, color: NAVY, paddingVertical: 3 },
  doneWrap: { margin: spacing.lg, borderRadius: 16, overflow: 'hidden' },
  doneBtn: { height: 52, alignItems: 'center', justifyContent: 'center' },
  doneText: { ...typography.bodyBold, color: '#FFFFFF', fontSize: 16 },
});
