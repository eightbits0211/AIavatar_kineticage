import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../theme';

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
  title: { ...typography.h2, color: '#FFFFFF', fontFamily: 'Inter_700Bold' },
  subtitle: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2C2C2E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeX: { fontSize: 16, color: '#8A98A8', fontFamily: 'Inter_700Bold' },

  list: { paddingHorizontal: spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  rowCurrent: { borderColor: ORANGE, backgroundColor: 'rgba(245,130,31,0.15)' },
  badge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2C2C2E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeReached: { backgroundColor: 'rgba(74,144,194,0.2)' },
  badgeCurrent: { backgroundColor: ORANGE },
  badgeNum: { ...typography.h3, color: colors.textLight, fontFamily: 'Inter_700Bold' },
  badgeNumOn: { color: '#FFFFFF' },
  rowTitle: { ...typography.bodyBold, color: '#FFFFFF' },
  rowSub: { ...typography.small, color: colors.textSecondary, marginTop: 2 },
  textMuted: { color: colors.textLight },
  barTrack: { height: 6, borderRadius: 3, backgroundColor: '#2C2C2E', overflow: 'hidden', marginTop: 6 },
  barFill: { height: '100%', borderRadius: 3, backgroundColor: ORANGE },
  pill: { borderRadius: 10, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  pillCurrent: { backgroundColor: '#FCEBDD' },
  pillReached: { backgroundColor: '#2C2C2E' },
  pillLocked: { backgroundColor: '#2C2C2E' },
  pillText: { ...typography.small, fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 0.3 },
  pillTextCurrent: { color: ORANGE },
  pillTextReached: { color: colors.primary },
  pillTextLocked: { color: colors.textSecondary },
});
