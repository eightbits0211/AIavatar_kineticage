import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../theme';

const NAVY = '#16365A';
const ORANGE = '#F5821F';

interface Props {
  visible: boolean;
  level: number;
  totalXp: number;
  xpIntoLevel: number;
  xpNeeded: number;
  onClose: () => void;
}

// Matches the backend formula (gamification.ts): cumulative XP to REACH level N
// is 100·N·(N-1); each level N spans 200·N XP.
const xpToReach = (n: number) => 100 * n * (n - 1);

/**
 * Floating, centered level ladder — same style as the badges popup. Shows
 * levels reached (unlocked), the current level with progress, and upcoming
 * locked levels with their XP requirement.
 */
export default function LevelsModal({ visible, level, totalXp, xpIntoLevel, xpNeeded, onClose }: Props) {
  // Show every level up to a few beyond the current one.
  const maxLevel = level + 4;
  const rows: number[] = [];
  for (let n = 1; n <= maxLevel; n++) rows.push(n);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Levels</Text>
              <Text style={styles.subtitle}>
                Level {level} · {totalXp.toLocaleString()} XP
              </Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel="Close levels">
              <Text style={styles.closeX}>✕</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
            {rows.map((n) => {
              const reached = n < level;
              const isCurrent = n === level;
              const pct = xpNeeded > 0 ? Math.min(100, Math.round((xpIntoLevel / xpNeeded) * 100)) : 0;
              return (
                <View key={n} style={[styles.row, isCurrent && styles.rowCurrent]}>
                  <View
                    style={[
                      styles.badge,
                      reached && styles.badgeReached,
                      isCurrent && styles.badgeCurrent,
                    ]}
                  >
                    <Text
                      style={[
                        styles.badgeNum,
                        (reached || isCurrent) && styles.badgeNumOn,
                      ]}
                    >
                      {n}
                    </Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowTitle, !reached && !isCurrent && styles.textMuted]}>Level {n}</Text>
                    {isCurrent ? (
                      <>
                        <Text style={styles.rowSub}>
                          {xpIntoLevel.toLocaleString()} / {xpNeeded.toLocaleString()} XP
                        </Text>
                        <View style={styles.barTrack}>
                          <View style={[styles.barFill, { width: `${pct}%` }]} />
                        </View>
                      </>
                    ) : reached ? (
                      <Text style={styles.rowSub}>Reached</Text>
                    ) : (
                      <Text style={[styles.rowSub, styles.textMuted]}>
                        Reach at {xpToReach(n).toLocaleString()} XP
                      </Text>
                    )}
                  </View>

                  <View
                    style={[
                      styles.pill,
                      isCurrent ? styles.pillCurrent : reached ? styles.pillReached : styles.pillLocked,
                    ]}
                  >
                    <Text
                      style={[
                        styles.pillText,
                        isCurrent ? styles.pillTextCurrent : reached ? styles.pillTextReached : styles.pillTextLocked,
                      ]}
                    >
                      {isCurrent ? 'Current' : reached ? 'Reached' : 'Locked'}
                    </Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(16,32,54,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  sheet: {
    width: '100%',
    maxHeight: '80%',
    backgroundColor: colors.background,
    borderRadius: 24,
    overflow: 'hidden',
    paddingBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: { ...typography.h2, color: NAVY, fontFamily: 'Inter_700Bold' },
  subtitle: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E5EAF1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeX: { fontSize: 16, color: '#8A98A8', fontFamily: 'Inter_700Bold' },

  list: { paddingHorizontal: spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: '#EAF2FB',
  },
  rowCurrent: { borderColor: ORANGE, backgroundColor: '#FFF6EE' },
  badge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E8EDF3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeReached: { backgroundColor: '#EAF2FB' },
  badgeCurrent: { backgroundColor: ORANGE },
  badgeNum: { ...typography.h3, color: colors.textLight, fontFamily: 'Inter_700Bold' },
  badgeNumOn: { color: NAVY },
  rowTitle: { ...typography.bodyBold, color: NAVY },
  rowSub: { ...typography.small, color: colors.textSecondary, marginTop: 2 },
  textMuted: { color: colors.textLight },
  barTrack: { height: 6, borderRadius: 3, backgroundColor: '#E2E8F0', overflow: 'hidden', marginTop: 6 },
  barFill: { height: '100%', borderRadius: 3, backgroundColor: ORANGE },
  pill: { borderRadius: 10, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  pillCurrent: { backgroundColor: '#FCEBDD' },
  pillReached: { backgroundColor: '#EAF2FB' },
  pillLocked: { backgroundColor: '#E8EDF3' },
  pillText: { ...typography.small, fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 0.3 },
  pillTextCurrent: { color: ORANGE },
  pillTextReached: { color: colors.primary },
  pillTextLocked: { color: colors.textSecondary },
});
