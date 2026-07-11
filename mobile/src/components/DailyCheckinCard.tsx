import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { apiGet, apiPost } from '../services/api';
import { colors, spacing, typography } from '../theme';

type Energy = 'low' | 'medium' | 'high';

const ENERGY: Array<{ key: Energy; label: string; emoji: string }> = [
  { key: 'low', label: 'Low', emoji: '🥱' },
  { key: 'medium', label: 'Okay', emoji: '🙂' },
  { key: 'high', label: 'Great', emoji: '⚡️' },
];

const SORENESS_AREAS = ['legs', 'back', 'arms', 'shoulders', 'core', 'chest'];

interface DailyCheckinCardProps {
  /** Called after a successful check-in (e.g. to refresh dashboard XP). */
  onComplete?: () => void;
}

/**
 * A once-per-day energy + soreness check-in. Self-manages its lifecycle:
 * it hides itself if the user already checked in today, and after a successful
 * submit. The soreness data helps the backend tailor future workouts, and the
 * check-in awards a small XP bonus.
 */
export default function DailyCheckinCard({ onComplete }: DailyCheckinCardProps) {
  const [status, setStatus] = useState<'loading' | 'open' | 'done'>('loading');
  const [energy, setEnergy] = useState<Energy | null>(null);
  const [soreness, setSoreness] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    apiGet<{ checked_in_today: boolean }>('/api/daily-checkin/today')
      .then((r) => {
        if (active) setStatus(r.checked_in_today ? 'done' : 'open');
      })
      .catch(() => {
        // If we can't tell, just hide the card rather than nag.
        if (active) setStatus('done');
      });
    return () => {
      active = false;
    };
  }, []);

  const toggleSore = useCallback((area: string) => {
    setSoreness((prev) => (prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]));
  }, []);

  const submit = useCallback(async () => {
    if (!energy) return;
    setSubmitting(true);
    try {
      // The backend expects soreness as { body_area, severity } objects, not
      // bare strings. We don't collect severity, so default to 'moderate'.
      const sorenessPayload = soreness.map((area) => ({ body_area: area, severity: 'moderate' as const }));
      await apiPost('/api/daily-checkin', { energy_level: energy, soreness: sorenessPayload });
      setStatus('done');
      onComplete?.();
    } catch {
      // Non-blocking — leave the card open so the user can retry.
    } finally {
      setSubmitting(false);
    }
  }, [energy, soreness, onComplete]);

  if (status === 'loading' || status === 'done') return null;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Daily Check-in</Text>
      <Text style={styles.sub}>How's your energy today?</Text>

      <View style={styles.energyRow}>
        {ENERGY.map((e) => {
          const sel = energy === e.key;
          return (
            <Pressable
              key={e.key}
              onPress={() => setEnergy(e.key)}
              style={[styles.energyBtn, sel && styles.energyBtnSel]}
              accessibilityRole="button"
              accessibilityLabel={`Energy ${e.label}`}
            >
              <Text style={styles.energyEmoji}>{e.emoji}</Text>
              <Text style={[styles.energyLabel, sel && styles.energyLabelSel]}>{e.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.sub}>Anything sore? (optional)</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.soreScroll}
        contentContainerStyle={styles.soreRow}
      >
        {SORENESS_AREAS.map((area) => {
          const sel = soreness.includes(area);
          return (
            <Pressable
              key={area}
              onPress={() => toggleSore(area)}
              style={[styles.soreChip, sel && styles.soreChipSel]}
            >
              <Text style={[styles.soreText, sel && styles.soreTextSel]}>
                {area.charAt(0).toUpperCase() + area.slice(1)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Pressable
        onPress={submit}
        disabled={!energy || submitting}
        style={[styles.submitBtn, (!energy || submitting) && styles.submitBtnDisabled]}
      >
        {submitting ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          <Text style={styles.submitText}>Check In  ·  +10 XP</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1C1C1E',
    borderRadius: 18,
    padding: spacing.md,
    marginBottom: spacing.md,
    shadowColor: '#1E4E7E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  title: { ...typography.h3, fontSize: 18, lineHeight: 22, color: '#FFFFFF', fontFamily: 'Inter_700Bold' },
  sub: { ...typography.caption, color: colors.textSecondary, marginTop: 2, marginBottom: 6 },
  energyRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  energyBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: 14,
    backgroundColor: '#2C2C2E',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  energyBtnSel: { borderColor: 'rgb(166, 250, 4)', backgroundColor: 'rgba(166,250,4,0.15)' },
  energyEmoji: { fontSize: 20 },
  energyLabel: { ...typography.small, color: colors.textSecondary, marginTop: 2, fontFamily: 'Inter_600SemiBold' },
  energyLabelSel: { color: 'rgb(166, 250, 4)' },
  soreScroll: { flexGrow: 0, marginBottom: spacing.md },
  soreRow: { flexDirection: 'row', gap: 8, paddingRight: spacing.sm },
  soreChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#2C2C2E',
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  soreChipSel: { backgroundColor: 'rgba(166,250,4,0.15)', borderColor: 'rgb(166, 250, 4)' },
  soreText: { ...typography.small, color: '#FFFFFF', fontFamily: 'Inter_600SemiBold' },
  soreTextSel: { color: 'rgb(166, 250, 4)' },
  submitBtn: {
    backgroundColor: 'rgb(166, 250, 4)',
    borderRadius: 14,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: { opacity: 0.4 },
  submitText: { ...typography.bodyBold, color: '#000000', fontSize: 16 },
});
