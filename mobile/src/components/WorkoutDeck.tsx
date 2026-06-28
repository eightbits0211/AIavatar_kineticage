import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Line, Path, Polyline } from 'react-native-svg';

import { colors, spacing, typography } from '../theme';
import type { BundleExercise } from '../../../shared/types';

const NAVY = '#16365A';
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
  if (p) return /warm|cool|cardio|mobility|finisher|stretch/.test(p);
  return idx === 0 || idx === total - 1;
}

function timedMinutes(ex: BundleExercise, idx: number, total: number): number {
  const d = (ex as any).duration_min as number | undefined;
  if (d) return d;
  if (idx === 0) return 5;
  if (idx === total - 1) return 3;
  return 3;
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

interface WorkoutDeckProps {
  exercise: BundleExercise;
  index: number;
  total: number;
  paused: boolean;
  onDone: () => void;
  onSkip: () => void;
  onPause: () => void;
}

export default function WorkoutDeck({ exercise, index, total, paused, onDone, onSkip, onPause }: WorkoutDeckProps) {
  const timed = isTimed(exercise, index, total);
  const metric = timed
    ? `${timedMinutes(exercise, index, total)} min`
    : `${exercise.sets} × ${exercise.rep_min}-${exercise.rep_max}`;
  const sub = `${exercise.sets} set${exercise.sets > 1 ? 's' : ''}`;

  return (
    <View style={styles.wrap}>
      {/* ── Exercise deck ── */}
      <View style={styles.deck}>
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
          {/* animation placeholder (left blank for now) */}
          <View style={styles.animBox} />

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

        {/* Done */}
        <Pressable onPress={onDone} style={styles.doneWrap}>
          <LinearGradient colors={['#FFA24D', ORANGE]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.doneBtn}>
            <CheckIcon />
            <Text style={styles.doneText}>Done</Text>
          </LinearGradient>
        </Pressable>
      </View>

      {/* ── Control bar (dots · pause · skip) ── */}
      <View style={styles.controlBar}>
        <View style={styles.dots}>
          {Array.from({ length: total }).map((_, i) => (
            <View key={i} style={[styles.dot, i <= index && styles.dotOn]} />
          ))}
        </View>
        <View style={styles.controlRight}>
          <Pressable onPress={onPause} style={styles.pauseBtn} accessibilityLabel={paused ? 'Resume' : 'Pause'}>
            {paused ? <PlayIcon /> : <PauseIcon />}
          </Pressable>
          <Pressable onPress={onSkip} style={styles.skipWrap} accessibilityLabel="Skip">
            <LinearGradient colors={['#FFA24D', ORANGE]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.skipBtn}>
              <SkipIcon />
              <Text style={styles.skipText}>Skip</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.md },
  deck: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: spacing.md,
    paddingBottom: 0,
    overflow: 'hidden',
    shadowColor: '#1E4E7E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  segs: { flex: 1, flexDirection: 'row', gap: 4 },
  seg: { flex: 1, height: 5, borderRadius: 3, backgroundColor: '#E2E8F0' },
  segOn: { backgroundColor: colors.primary },
  count: { ...typography.small, color: colors.textSecondary, fontFamily: 'Inter_600SemiBold' },

  mainRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.md, marginBottom: spacing.md },
  animBox: {
    width: 72,
    height: 72,
    borderRadius: 16,
    backgroundColor: '#EEF3F8',
  },
  info: { flex: 1 },
  phase: { ...typography.small, color: colors.textSecondary, fontFamily: 'Inter_700Bold', letterSpacing: 0.5 },
  name: { ...typography.h3, color: NAVY, fontFamily: 'Inter_700Bold', marginTop: 2 },
  metric: { ...typography.h2, color: colors.primary, marginTop: 2 },
  sub: { ...typography.small, color: colors.textSecondary },
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EAF2FB',
    borderRadius: 14,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    gap: 2,
  },
  badgeText: { ...typography.small, fontSize: 10, color: colors.primary },

  doneWrap: { marginHorizontal: -spacing.md },
  doneBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, height: 52 },
  doneText: { ...typography.bodyBold, color: '#FFFFFF', fontSize: 16 },

  controlBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: spacing.sm,
    marginTop: -10,
    marginHorizontal: spacing.sm,
    shadowColor: '#1E4E7E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  dots: { flexDirection: 'row', gap: 6, paddingLeft: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#E2E8F0' },
  dotOn: { backgroundColor: ORANGE },
  controlRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pauseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F4F8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipWrap: { borderRadius: 22, overflow: 'hidden' },
  skipBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.lg, height: 44, justifyContent: 'center' },
  skipText: { ...typography.bodyBold, color: '#FFFFFF' },
});
