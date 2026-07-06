import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../theme';

export interface BadgeItem {
  badge_id: string;
  name: string;
  description: string;
  earned?: boolean;
  earned_at?: string | null;
}

// A little visual flair per badge (backend only sends id/name/description).
const BADGE_EMOJI: Record<string, string> = {
  first_step: '👟',
  consistency_starter: '📅',
  week_warrior: '🔥',
  momentum: '🚀',
  comeback: '💪',
  leveling_up: '📈',
  goal_getter: '🎯',
};

interface Props {
  visible: boolean;
  badges: BadgeItem[];
  onClose: () => void;
}

/**
 * Floating, centered badge collection — shows every backend badge in unlocked
 * (earned) or locked (still to achieve) form, game-style.
 */
export default function BadgesModal({ visible, badges, onClose }: Props) {
  const earnedCount = badges.filter((b) => b.earned).length;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Badges</Text>
              <Text style={styles.subtitle}>
                {earnedCount} of {badges.length} unlocked
              </Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel="Close badges">
              <Text style={styles.closeX}>✕</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
            {badges.map((b) => {
              const emoji = BADGE_EMOJI[b.badge_id] || '🏅';
              const locked = !b.earned;
              return (
                <View key={b.badge_id} style={[styles.cell, locked && styles.cellLocked]}>
                  <View style={[styles.emojiWrap, locked && styles.emojiWrapLocked]}>
                    <Text style={[styles.emoji, locked && styles.emojiLocked]}>{locked ? '🔒' : emoji}</Text>
                  </View>
                  <Text style={[styles.name, locked && styles.textMuted]} numberOfLines={1}>
                    {b.name}
                  </Text>
                  <Text style={[styles.desc, locked && styles.textMuted]} numberOfLines={3}>
                    {b.description}
                  </Text>
                  <View style={[styles.statusPill, locked ? styles.statusLocked : styles.statusEarned]}>
                    <Text style={[styles.statusText, locked ? styles.statusTextLocked : styles.statusTextEarned]}>
                      {locked ? 'Locked' : 'Unlocked'}
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

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
  },
  cell: {
    width: '47.5%',
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  cellLocked: { backgroundColor: '#2C2C2E', borderColor: '#2C2C2E' },
  emojiWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(246,208,0,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  emojiWrapLocked: { backgroundColor: '#2C2C2E' },
  emoji: { fontSize: 28 },
  emojiLocked: { fontSize: 24, opacity: 0.7 },
  name: { ...typography.bodyBold, color: '#FFFFFF', textAlign: 'center' },
  desc: { ...typography.small, color: colors.textSecondary, textAlign: 'center', marginTop: 4, lineHeight: 16 },
  textMuted: { color: colors.textLight },
  statusPill: {
    borderRadius: 10,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    marginTop: spacing.sm,
  },
  statusEarned: { backgroundColor: 'rgba(246,208,0,0.14)' },
  statusLocked: { backgroundColor: '#2C2C2E' },
  statusText: { ...typography.small, fontSize: 11, fontFamily: 'Inter_700Bold', letterSpacing: 0.3, textTransform: 'uppercase' },
  statusTextEarned: { color: 'rgb(246, 208, 0)' },
  statusTextLocked: { color: colors.textSecondary },
});
