import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Polyline } from 'react-native-svg';

import { colors, spacing, typography } from '../theme';
import type { BundleExercise } from '../../../shared/types';

const ORANGE = '#F5821F';

/* phase / metric helpers ------------------------------------------------ */
function phaseLabel(ex: BundleExercise, idx: number, total: number): string {
  const p = (ex as any).workout_phase as string | undefined;
  if (p) return p.replace(/_/g, ' ').toUpperCase();
  if (idx === 0) return 'WARM-UP';
  if (idx === total - 1) return 'COOL-DOWN';
  return 'MAIN SET';
}

function isTimed(ex: BundleExercise, idx: number, total: number): boolean {
  const p = (ex as any).workout_phase as string | undefined;
  // Warm-up / cool-down / stretch blocks stay time-based (intro / outro).
  if (p && /warm|cool|stretch/.test(p)) return true;
  // Any other exercise that has a real rep range is rep-based — show sets × reps.
  const repMax = (ex as any).rep_max as number | undefined;
  if (typeof repMax === 'number' && repMax > 0) return false;
  // No rep data — fall back to the original time-based heuristic.
  if (p) return /cardio|mobility|finisher/.test(p);
  return idx === 0 || idx === total - 1;
}

function timedMinutes(ex: BundleExercise, idx: number, total: number): number {
  const d = (ex as any).duration_min as number | undefined;
  if (d) return d;
  if (idx === 0) return 5;
  if (idx === total - 1) return 3;
  return 3;
}

/** Format seconds as M:SS. */
function mmss(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/* tiny icons ------------------------------------------------------------ */
function ClockIcon({ size = 18, color = colors.primary }: { size?: number; color?: string }) {
  const s = { stroke: color, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={8} {...s} />
      <Path d="M12 8v4l3 2" {...s} />
    </Svg>
  );
}
function DumbbellIcon({ size = 18, color = colors.primary }: { size?: number; color?: string }) {
  const s = { stroke: color, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Line x1={9} y1={12} x2={15} y2={12} {...s} />
      <Line x1={6.5} y1={9.5} x2={6.5} y2={14.5} {...s} />
      <Line x1={9} y1={8.5} x2={9} y2={15.5} {...s} />
      <Line x1={15} y1={8.5} x2={15} y2={15.5} {...s} />
      <Line x1={17.5} y1={9.5} x2={17.5} y2={14.5} {...s} />
    </Svg>
  );
}
function CheckIcon({ size = 18, color = '#FFFFFF' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 12l4 4 10-10" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}
function SkipIcon({ size = 18, color = '#FFFFFF' }: { size?: number; color?: string }) {
  const s = { stroke: color, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Polyline points="6 5 14 12 6 19" {...s} />
      <Line x1={18} y1={5} x2={18} y2={19} {...s} />
    </Svg>
  );
}
function PauseIcon({ size = 16, color = colors.textSecondary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Line x1={9} y1={5} x2={9} y2={19} stroke={color} strokeWidth={2.5} strokeLinecap="round" />
      <Line x1={15} y1={5} x2={15} y2={19} stroke={color} strokeWidth={2.5} strokeLinecap="round" />
    </Svg>
  );
}
function PlayIcon({ size = 16, color = colors.textSecondary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M7 5l11 7-11 7z" fill={color} />
    </Svg>
  );
}
/** Cross (X) with rounded corners — the End Workout stop glyph. */
function CrossIcon({ size = 16, color = '#E5484D' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Line x1={5} y1={5} x2={19} y2={19} stroke={color} strokeWidth={2.5} strokeLinecap="round" />
      <Line x1={19} y1={5} x2={5} y2={19} stroke={color} strokeWidth={2.5} strokeLinecap="round" />
    </Svg>
  );
}

interface WorkoutDeckProps {
  exercise: BundleExercise;
  index: number;
  total: number;
  paused: boolean;
  onDone: (reps: number) => void;
  onSkip: () => void;
  onPause: () => void;
  /** End the whole workout early (saves progress so far). */
  onEnd: () => void;
  /** Hide the small inline demo GIF (used in focus mode where a large GIF shows above). */
  hideImage?: boolean;
  /** Use the translucent surface (matches the tab/search bars) so chat flows behind. */
  transparent?: boolean;
}

export default function WorkoutDeck({ exercise, index, total, paused, onDone, onSkip, onPause, onEnd, hideImage, transparent }: WorkoutDeckProps) {
  const timed = isTimed(exercise, index, total);
  const metric = timed
    ? `${timedMinutes(exercise, index, total)} min`
    : `${exercise.sets} × ${exercise.rep_min}-${exercise.rep_max}`;
  const sub = `${exercise.sets} set${exercise.sets > 1 ? 's' : ''}`;

  // Reps the user actually completed (per set). Defaults to the top of the
  // prescribed range and resets whenever the exercise changes.
  const defaultReps = exercise.rep_max ?? exercise.rep_min ?? 10;
  const [reps, setReps] = useState<number>(defaultReps);
  useEffect(() => {
    setReps(exercise.rep_max ?? exercise.rep_min ?? 10);
  }, [exercise]);

  // Cosmetic countdown for timed exercises — runs down and then shows "Timer
  // ended". Purely informational: it never skips/advances the exercise. Resets
  // when the exercise changes.
  const [secondsLeft, setSecondsLeft] = useState<number>(0);
  // Initialize (and reset) the countdown ONLY when the exercise itself changes —
  // not on pause/resume — so resuming continues from where it left off.
  useEffect(() => {
    if (!timed) {
      setSecondsLeft(0);
      return;
    }
    setSecondsLeft(Math.max(1, timedMinutes(exercise, index, total) * 60));
  }, [exercise, timed, index, total]);
  // Tick once per second, but only while running (timed and not paused). Pausing
  // clears the interval — freezing the value — and resuming starts a fresh
  // interval from the current value instead of restarting from the top.
  useEffect(() => {
    if (!timed || paused) return;
    const id = setInterval(() => {
      setSecondsLeft((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [timed, paused]);

  const surface = transparent ? 'rgba(24,24,26,0.96)' : undefined;

  return (
    <View style={styles.wrap}>
      {/* ── Exercise deck ── */}
      <View style={[styles.deck, surface ? { backgroundColor: surface } : null]}>
        {/* segmented progress + count */}
        <View style={styles.progressRow}>
          <View style={styles.segs}>
            {Array.from({ length: total }).map((_, i) => (
              <View key={i} style={[styles.seg, i <= index && styles.segOn]} />
            ))}
          </View>
          <Text style={styles.count}>{index + 1}/{total}</Text>
        </View>

        <View style={styles.mainRow}>
          {/* Exercise demo GIF (image_url), placeholder while none/loading.
              Hidden in focus mode, where a large GIF is shown above the card. */}
          {!hideImage &&
            (exercise.image_url ? (
              <Image source={{ uri: exercise.image_url }} style={styles.animBox} resizeMode="cover" />
            ) : (
              <View style={styles.animBox} />
            ))}

          <View style={styles.info}>
            <Text style={styles.phase}>{phaseLabel(exercise, index, total)}</Text>
            <Text style={styles.name} numberOfLines={2}>{exercise.name}</Text>
            <Text style={styles.metric}>{metric}</Text>
            <Text style={styles.sub}>{sub}</Text>
          </View>

          <View style={styles.badge}>
            {timed ? <ClockIcon /> : <DumbbellIcon />}
            <Text style={styles.badgeText}>{timed ? 'timed' : 'reps'}</Text>
          </View>
        </View>

        {/* Reps stepper — rep-based exercises only */}
        {!timed && (
          <View style={styles.repRow}>
            <Text style={styles.repLabel}>Reps completed</Text>
            <View style={styles.stepper}>
              <Pressable
                onPress={() => setReps((r) => Math.max(0, r - 1))}
                style={styles.stepBtn}
                accessibilityLabel="Decrease reps"
              >
                <Text style={styles.stepSign}>−</Text>
              </Pressable>
              <Text style={styles.repValue}>{reps}</Text>
              <Pressable
                onPress={() => setReps((r) => Math.min(99, r + 1))}
                style={styles.stepBtn}
                accessibilityLabel="Increase reps"
              >
                <Text style={styles.stepSign}>+</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Countdown — timed exercises only. Cosmetic; ends with a message. */}
        {timed && (
          <View style={styles.timerRow}>
            {secondsLeft > 0 ? (
              <>
                <Text style={styles.timerLabel}>Time remaining</Text>
                <Text style={styles.timerValue}>{mmss(secondsLeft)}</Text>
              </>
            ) : (
              <Text style={styles.timerDone}>⏱  Timer ended</Text>
            )}
          </View>
        )}

        {/* Done — no fill; blue icon + text matching the sets/reps numbers */}
        <Pressable onPress={() => onDone(reps)} style={styles.doneWrap}>
          <View style={styles.doneBtn}>
            <CheckIcon size={26} color={colors.primary} />
            <Text style={styles.doneText}>Done</Text>
          </View>
        </Pressable>

        {/* ── Control bar (dots · pause · skip) — same card as the details ── */}
        <View style={styles.controlBar}>
          <View style={styles.dots}>
            {Array.from({ length: total }).map((_, i) => (
              <View key={i} style={[styles.dot, i <= index && styles.dotOn]} />
            ))}
          </View>
          <View style={styles.controlRight}>
            <Pressable onPress={onEnd} style={styles.endBtn} accessibilityRole="button" accessibilityLabel="End workout">
              <CrossIcon size={24} color="#E5484D" />
            </Pressable>
            <Pressable onPress={onPause} style={styles.pauseBtn} accessibilityLabel={paused ? 'Resume' : 'Pause'}>
              {paused ? <PlayIcon size={24} color="#2E9E5B" /> : <PauseIcon size={24} color="#2E9E5B" />}
            </Pressable>
            <Pressable onPress={onSkip} style={styles.skipWrap} accessibilityLabel="Skip">
              <View style={styles.skipBtn}>
                <SkipIcon color="rgb(221, 188, 1)" />
                <Text style={styles.skipText}>Skip</Text>
              </View>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.md },
  deck: {
    backgroundColor: '#1C1C1E',
    borderRadius: 20,
    padding: spacing.md,
    overflow: 'hidden',
    shadowColor: '#1E4E7E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  segs: { flex: 1, flexDirection: 'row', gap: 4 },
  seg: { flex: 1, height: 5, borderRadius: 3, backgroundColor: '#2C2C2E' },
  segOn: { backgroundColor: colors.primary },
  count: { ...typography.small, color: colors.textSecondary, fontFamily: 'Inter_600SemiBold' },

  mainRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.md, marginBottom: spacing.md },
  animBox: {
    width: 72,
    height: 72,
    borderRadius: 16,
    backgroundColor: '#2C2C2E',
  },
  info: { flex: 1 },
  phase: { ...typography.small, color: colors.textSecondary, fontFamily: 'Inter_700Bold', letterSpacing: 0.5 },
  name: { ...typography.h3, color: '#FFFFFF', fontFamily: 'Inter_700Bold', marginTop: 2 },
  metric: { ...typography.h2, color: colors.primary, marginTop: 2 },
  sub: { ...typography.small, color: colors.textSecondary },
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2C2C2E',
    borderRadius: 14,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    gap: 2,
  },
  badgeText: { ...typography.small, fontSize: 10, color: colors.primary },

  repRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#2C2C2E',
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  repLabel: { ...typography.bodyBold, color: '#FFFFFF' },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#2C2C2E',
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  timerLabel: { ...typography.bodyBold, color: 'rgb(221, 188, 1)' },
  timerValue: { ...typography.h2, color: 'rgb(221, 188, 1)', fontFamily: 'Inter_700Bold' },
  timerDone: { ...typography.bodyBold, color: 'rgb(221, 188, 1)', flex: 1, textAlign: 'center' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stepBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#2C2C2E',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  stepSign: { fontSize: 22, lineHeight: 24, color: colors.primary, fontFamily: 'Inter_700Bold' },
  repValue: { ...typography.h3, color: '#FFFFFF', minWidth: 30, textAlign: 'center', fontFamily: 'Inter_700Bold' },

  doneWrap: { alignSelf: 'center', marginTop: spacing.sm },
  doneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 44,
    borderRadius: 22,
    paddingHorizontal: spacing.xl,
    backgroundColor: '#2C2C2E', // same grey as the reps-completed counters
  },
  doneText: { ...typography.bodyBold, color: colors.primary, fontSize: 20 },

  controlBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  dots: { flexDirection: 'row', gap: 6, paddingLeft: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2C2C2E' },
  dotOn: { backgroundColor: ORANGE },
  controlRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pauseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(46,158,91,0.18)', // dark-mode green tint
    alignItems: 'center',
    justifyContent: 'center',
  },
  endBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(229,72,77,0.18)', // dark-mode red tint
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipWrap: { borderRadius: 22, overflow: 'hidden' },
  skipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.lg,
    height: 44,
    justifyContent: 'center',
    backgroundColor: 'rgba(221,188,1,0.16)', // timer-color tint
  },
  skipText: { ...typography.bodyBold, color: 'rgb(221, 188, 1)' },
});
