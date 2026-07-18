import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, spacing, typography } from '../theme';

const ORANGE = '#F5821F';

interface Props {
  visible: boolean;
  streak: number;
  longestStreak: number;
  onClose: () => void;
}

/** Flame glyph, sized + colored for the streak hero. */
function Flame({ size = 64, color = ORANGE }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3c2 3 4.5 4.8 4.5 8.5a4.5 4.5 0 0 1-9 0c0-1.6.8-2.8 1.6-3.6 0 1.2.9 2 1.9 2-1-2.4.2-5 0-6.9z"
        stroke={color}
        strokeWidth={1.6}
        strokeLinejoin="round"
        fill={`${color}22`}
      />
    </Svg>
  );
}

/**
 * Apple-Fitness-style streak card. A single warm, specific line tuned to the
 * streak length — celebratory when you're consistent, gently encouraging when
 * you've slipped. Kept short and second-person, the way Apple would phrase it.
 */
function streakCopy(streak: number, longest: number): { headline: string; message: string } {
  if (streak <= 0) {
    return {
      headline: 'Start your streak',
      message:
        longest > 0
          ? `Your best run was ${longest} day${longest === 1 ? '' : 's'}. Today's a great day to start a new one.`
          : 'Every streak starts with a single day. Do one workout today and you\u2019re on the board.',
    };
  }
  if (streak === 1) {
    return {
      headline: 'Day one',
      message: 'You showed up. Come back tomorrow and momentum starts working for you.',
    };
  }
  if (streak < 3) {
    return {
      headline: 'Building momentum',
      message: `${streak} days in a row. Two more and it starts to feel automatic \u2014 keep going.`,
    };
  }
  if (streak < 7) {
    return {
      headline: 'Nice rhythm',
      message: `${streak} days straight. You\u2019re turning this into a habit. Don\u2019t break the chain now.`,
    };
  }
  if (streak < 14) {
    return {
      headline: 'A full week, and then some',
      message: `${streak} days without missing. This is what consistency looks like \u2014 seriously well done.`,
    };
  }
  if (streak < 30) {
    return {
      headline: 'You\u2019re on fire',
      message: `${streak} days in a row. Your body expects this now. Keep protecting the streak.`,
    };
  }
  return {
    headline: 'Unstoppable',
    message: `${streak} days. This isn\u2019t a streak anymore \u2014 it\u2019s just who you are. Incredible.`,
  };
}

export default function StreakModal({ visible, streak, longestStreak, onClose }: Props) {
  const { headline, message } = streakCopy(streak, longestStreak);
  const isRecord = streak > 0 && streak >= longestStreak;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Streak</Text>
              <Text style={styles.subtitle}>Your daily consistency</Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel="Close streak">
              <Text style={styles.closeX}>{'\u2715'}</Text>
            </Pressable>
          </View>

          <View style={styles.hero}>
            <Flame size={72} />
            <View style={styles.countRow}>
              <Text style={styles.count}>{streak}</Text>
              <Text style={styles.countUnit}>{streak === 1 ? 'day' : 'days'}</Text>
            </View>
            <Text style={styles.headline}>{headline}</Text>
            <Text style={styles.message}>{message}</Text>
          </View>

          <View style={styles.metaRow}>
            <View style={styles.metaCell}>
              <Text style={styles.metaValue}>{streak}</Text>
              <Text style={styles.metaLabel}>Current</Text>
            </View>
            <View style={styles.metaDivider} />
            <View style={styles.metaCell}>
              <Text style={[styles.metaValue, { color: ORANGE }]}>{Math.max(streak, longestStreak)}</Text>
              <Text style={styles.metaLabel}>Best{isRecord ? ' \u2713' : ''}</Text>
            </View>
          </View>

          {isRecord && streak > 1 && (
            <View style={styles.recordPill}>
              <Text style={styles.recordText}>{'You\u2019re at your best streak ever'}</Text>
            </View>
          )}
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
    backgroundColor: colors.background,
    borderRadius: 24,
    overflow: 'hidden',
    paddingBottom: spacing.lg,
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

  hero: { alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  countRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: spacing.sm },
  count: { fontSize: 56, lineHeight: 62, color: '#FFFFFF', fontFamily: 'Inter_700Bold' },
  countUnit: { ...typography.body, color: colors.textSecondary, marginBottom: 12, marginLeft: 6 },
  headline: { ...typography.h3, color: ORANGE, fontFamily: 'Inter_700Bold', marginTop: spacing.sm, textAlign: 'center' },
  message: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.sm, lineHeight: 22 },

  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
  },
  metaCell: { flex: 1, alignItems: 'center' },
  metaDivider: { width: 1, alignSelf: 'stretch', backgroundColor: '#2C2C2E' },
  metaValue: { ...typography.h3, color: '#FFFFFF', fontFamily: 'Inter_700Bold' },
  metaLabel: { ...typography.small, color: colors.textSecondary, marginTop: 2 },

  recordPill: {
    alignSelf: 'center',
    backgroundColor: 'rgba(245,130,31,0.16)',
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    marginTop: spacing.md,
  },
  recordText: { ...typography.small, color: ORANGE, fontFamily: 'Inter_600SemiBold' },
});
