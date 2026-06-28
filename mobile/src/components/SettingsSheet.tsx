import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

import { colors, spacing, typography } from '../theme';

const { height: SCREEN_H } = Dimensions.get('window');
const SHEET_HEIGHT = Math.min(SCREEN_H * 0.82, 720);

const NAVY = '#16365A';
const TEAL = '#4FC3E8';

/* ───────────────────────── Section icons ───────────────────────── */
type IconName = 'robot' | 'target' | 'alert' | 'dumbbell' | 'bell';

function SectionIcon({ name, size = 18, color = colors.primary }: { name: IconName; size?: number; color?: string }) {
  const s = { stroke: color, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  switch (name) {
    case 'robot':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Rect x={5} y={8} width={14} height={11} rx={3} {...s} />
          <Path d="M12 5V8" {...s} />
          <Circle cx={12} cy={4} r={1.5} {...s} />
          <Circle cx={9.5} cy={13} r={1} fill={color} stroke={color} />
          <Circle cx={14.5} cy={13} r={1} fill={color} stroke={color} />
          <Path d="M3 12V15M21 12V15" {...s} />
        </Svg>
      );
    case 'target':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle cx={12} cy={12} r={8} {...s} />
          <Circle cx={12} cy={12} r={4} {...s} />
          <Circle cx={12} cy={12} r={1} fill={color} stroke={color} />
        </Svg>
      );
    case 'alert':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle cx={12} cy={12} r={9} {...s} />
          <Line x1={12} y1={8} x2={12} y2={13} {...s} />
          <Circle cx={12} cy={16.5} r={0.6} fill={color} stroke={color} />
        </Svg>
      );
    case 'dumbbell':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Line x1={9} y1={12} x2={15} y2={12} {...s} />
          <Line x1={6.5} y1={9.5} x2={6.5} y2={14.5} {...s} />
          <Line x1={9} y1={8.5} x2={9} y2={15.5} {...s} />
          <Line x1={15} y1={8.5} x2={15} y2={15.5} {...s} />
          <Line x1={17.5} y1={9.5} x2={17.5} y2={14.5} {...s} />
        </Svg>
      );
    case 'bell':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" {...s} />
          <Path d="M10 20a2 2 0 0 0 4 0" {...s} />
        </Svg>
      );
    default:
      return null;
  }
}

function CloseX({ size = 16, color = '#8A98A8' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Line x1={6} y1={6} x2={18} y2={18} stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Line x1={18} y1={6} x2={6} y2={18} stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function CheckMark({ size = 14, color = '#FFFFFF' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 12l4 4 10-10" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

/* ───────────────────────── Slider ───────────────────────── */
function Slider({
  value,
  min,
  max,
  step = 5,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  const widthRef = useRef(0);
  const set = (x: number) => {
    const w = widthRef.current;
    if (!w) return;
    const r = Math.max(0, Math.min(1, x / w));
    let val = Math.round((min + r * (max - min)) / step) * step;
    val = Math.max(min, Math.min(max, val));
    onChange(val);
  };
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => set(e.nativeEvent.locationX),
      onPanResponderMove: (e) => set(e.nativeEvent.locationX),
    })
  ).current;
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <View
      style={styles.sliderHit}
      onLayout={(e) => {
        widthRef.current = e.nativeEvent.layout.width;
      }}
      {...pan.panHandlers}
    >
      <View style={styles.sliderTrack}>
        <View style={[styles.sliderFill, { width: `${pct}%` }]} />
      </View>
      <View style={[styles.sliderThumb, { left: `${pct}%` }]} />
    </View>
  );
}

/* ───────────────────────── Data ───────────────────────── */
const GOALS = ['Weight Loss', 'Muscle Gain', 'Mobility', 'Rehabilitation', 'Healthy Aging'];
const CONSTRAINTS = ['Knee Issues', 'Back Pain', 'Shoulder Pain', 'Arthritis', 'Limited Mobility'];
const INTENSITIES = ['Light', 'Moderate', 'Challenging', 'Intense'];
const PERSONALITIES: Array<{ key: string; desc: string }> = [
  { key: 'Supportive', desc: 'Gentle, encouraging, empathetic' },
  { key: 'Motivational', desc: 'High energy, pushes you harder' },
  { key: 'Strict', desc: 'Discipline-first, no excuses' },
  { key: 'Professional', desc: 'Precise, data-driven, clinical' },
  { key: 'Friendly', desc: 'Casual, warm, like a workout buddy' },
];
const REMINDERS: Array<{ key: keyof RemindersState; title: string; sub: string }> = [
  { key: 'workout', title: 'Workout Reminders', sub: 'Daily at 6:00 AM' },
  { key: 'recovery', title: 'Recovery Reminders', sub: 'After intense sessions' },
  { key: 'streak', title: 'Streak Reminders', sub: "If you're about to break" },
  { key: 'weekly', title: 'Weekly Challenge Reminders', sub: 'Every Sunday evening' },
];

interface RemindersState {
  workout: boolean;
  recovery: boolean;
  streak: boolean;
  weekly: boolean;
}

interface SettingsSheetProps {
  visible: boolean;
  onClose: () => void;
  onSave?: (prefs: any) => void;
}

export default function SettingsSheet({ visible, onClose, onSave }: SettingsSheetProps) {
  const [mounted, setMounted] = useState(visible);
  const slide = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const fade = useRef(new Animated.Value(0)).current;

  const [goal, setGoal] = useState('Weight Loss');
  const [constraints, setConstraints] = useState<string[]>([]);
  const [duration, setDuration] = useState(45);
  const [intensity, setIntensity] = useState('Challenging');
  const [location, setLocation] = useState<'Home' | 'Gym'>('Home');
  const [personality, setPersonality] = useState('Motivational');
  const [reminders, setReminders] = useState<RemindersState>({
    workout: true,
    recovery: false,
    streak: true,
    weekly: false,
  });

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(slide, { toValue: 0, useNativeDriver: true, bounciness: 3, speed: 14 }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(fade, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(slide, { toValue: SHEET_HEIGHT, duration: 220, useNativeDriver: true }),
      ]).start(({ finished }) => finished && setMounted(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!mounted) return null;

  const toggleConstraint = (c: string) =>
    setConstraints((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  const handleSave = () => {
    onSave?.({ goal, constraints, duration, intensity, location, personality, reminders });
    onClose();
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Blurred backdrop */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade }]}>
        <BlurView intensity={26} tint="dark" style={StyleSheet.absoluteFill}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close settings" />
        </BlurView>
      </Animated.View>

      {/* Sheet */}
      <Animated.View style={[styles.sheet, { height: SHEET_HEIGHT, transform: [{ translateY: slide }] }]}>
        <View style={styles.handleWrap}>
          <View style={styles.handle} />
        </View>

        <View style={styles.header}>
          <SectionIcon name="robot" size={22} color={colors.primary} />
          <Text style={styles.title}>Kin AI Settings</Text>
          <Pressable onPress={onClose} style={styles.closeBtn} accessibilityLabel="Close">
            <CloseX />
          </Pressable>
        </View>

        <ScrollView
          showsVerticalScrollIndicator
          contentContainerStyle={styles.scroll}
          style={{ flex: 1 }}
        >
          {/* Fitness Goals */}
          <View style={styles.sectionHead}>
            <SectionIcon name="target" />
            <Text style={styles.sectionTitle}>Fitness Goals</Text>
          </View>
          <View style={styles.chipWrap}>
            {GOALS.map((g) => {
              const sel = goal === g;
              return (
                <Pressable key={g} onPress={() => setGoal(g)} style={[styles.chip, sel && styles.chipSel]}>
                  {sel && <CheckMark size={13} />}
                  <Text style={[styles.chipText, sel && styles.chipTextSel]}>{g}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* Physical Constraints */}
          <View style={styles.sectionHead}>
            <SectionIcon name="alert" />
            <Text style={styles.sectionTitle}>Physical Constraints</Text>
          </View>
          <View style={styles.chipWrap}>
            {CONSTRAINTS.map((c) => {
              const sel = constraints.includes(c);
              return (
                <Pressable key={c} onPress={() => toggleConstraint(c)} style={[styles.chip, sel && styles.chipSel]}>
                  {sel && <CheckMark size={13} />}
                  <Text style={[styles.chipText, sel && styles.chipTextSel]}>{c}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* Workout Preferences */}
          <View style={styles.sectionHead}>
            <SectionIcon name="dumbbell" />
            <Text style={styles.sectionTitle}>Workout Preferences</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.cardRowBetween}>
              <Text style={styles.cardLabel}>Session Duration</Text>
              <Text style={styles.cardValue}>{duration} min</Text>
            </View>
            <Slider value={duration} min={15} max={90} step={5} onChange={setDuration} />
            <View style={styles.cardRowBetween}>
              <Text style={styles.rangeLabel}>15 min</Text>
              <Text style={styles.rangeLabel}>90 min</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={[styles.cardLabel, { marginBottom: spacing.sm }]}>Intensity Level</Text>
            <View style={styles.segmentRow}>
              {INTENSITIES.map((i) => {
                const sel = intensity === i;
                return (
                  <Pressable key={i} onPress={() => setIntensity(i)} style={[styles.segment, sel && styles.segmentSel]}>
                    <Text style={[styles.segmentText, sel && styles.segmentTextSel]}>{i}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.locationRow}>
            {(['Home', 'Gym'] as const).map((loc) => {
              const sel = location === loc;
              return (
                <Pressable key={loc} onPress={() => setLocation(loc)} style={[styles.locBtn, sel ? styles.locBtnSel : styles.locBtnUnsel]}>
                  <Text style={[styles.locText, sel ? styles.locTextSel : styles.locTextUnsel]}>{loc}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* AI Personality */}
          <View style={styles.sectionHead}>
            <SectionIcon name="robot" />
            <Text style={styles.sectionTitle}>AI Personality</Text>
          </View>
          {PERSONALITIES.map((p) => {
            const sel = personality === p.key;
            return (
              <Pressable key={p.key} onPress={() => setPersonality(p.key)} style={[styles.persona, sel && styles.personaSel]}>
                <View style={[styles.radio, sel && styles.radioSel]}>{sel && <View style={styles.radioDot} />}</View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.personaTitle, sel && styles.personaTitleSel]}>{p.key}</Text>
                  <Text style={[styles.personaDesc, sel && styles.personaDescSel]}>{p.desc}</Text>
                </View>
                {sel && <CheckMark size={16} />}
              </Pressable>
            );
          })}

          {/* Reminder Preferences */}
          <View style={styles.sectionHead}>
            <SectionIcon name="bell" />
            <Text style={styles.sectionTitle}>Reminder Preferences</Text>
          </View>
          <View style={styles.card}>
            {REMINDERS.map((r, idx) => (
              <View key={r.key} style={[styles.reminderRow, idx > 0 && styles.reminderDivider]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.reminderTitle}>{r.title}</Text>
                  <Text style={styles.reminderSub}>{r.sub}</Text>
                </View>
                <Switch
                  value={reminders[r.key]}
                  onValueChange={(v) => setReminders((prev) => ({ ...prev, [r.key]: v }))}
                  trackColor={{ false: '#D5DCE3', true: TEAL }}
                  thumbColor="#FFFFFF"
                  ios_backgroundColor="#D5DCE3"
                />
              </View>
            ))}
          </View>
        </ScrollView>

        {/* Sticky Save */}
        <View style={styles.footer}>
          <Pressable onPress={handleSave} style={styles.saveWrap} accessibilityLabel="Save preferences">
            <LinearGradient colors={['#FFA24D', '#F5821F']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.saveBtn}>
              <Text style={styles.saveText}>Save Preferences</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#F4F7FB',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 16,
  },
  handleWrap: { alignItems: 'center', paddingTop: 10, paddingBottom: 6 },
  handle: { width: 40, height: 5, borderRadius: 3, backgroundColor: '#C7D0DA' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: { ...typography.h3, color: NAVY, flex: 1, fontFamily: 'Inter_700Bold' },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#E5EAF1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },

  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.lg, marginBottom: spacing.md },
  sectionTitle: { ...typography.h3, fontSize: 17, color: NAVY, fontFamily: 'Inter_700Bold' },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chipSel: { backgroundColor: NAVY, borderColor: NAVY },
  chipText: { ...typography.caption, color: NAVY, fontFamily: 'Inter_600SemiBold' },
  chipTextSel: { color: '#FFFFFF' },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
    shadowColor: '#1E4E7E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardRowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardLabel: { ...typography.bodyBold, color: NAVY },
  cardValue: { ...typography.bodyBold, color: colors.primary },
  rangeLabel: { ...typography.small, color: colors.textSecondary, marginTop: 8 },

  sliderHit: { height: 28, justifyContent: 'center', marginTop: spacing.sm },
  sliderTrack: { height: 6, borderRadius: 3, backgroundColor: '#E2E8F0', overflow: 'hidden' },
  sliderFill: { height: '100%', borderRadius: 3, backgroundColor: colors.primary },
  sliderThumb: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: colors.primary,
    marginLeft: -10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },

  segmentRow: { flexDirection: 'row', gap: 8 },
  segment: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#F1F4F8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentSel: { backgroundColor: TEAL },
  segmentText: { ...typography.small, color: colors.textSecondary, fontFamily: 'Inter_600SemiBold' },
  segmentTextSel: { color: '#FFFFFF' },

  locationRow: { flexDirection: 'row', gap: 12, marginBottom: spacing.sm },
  locBtn: { flex: 1, paddingVertical: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  locBtnSel: { backgroundColor: NAVY },
  locBtnUnsel: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0' },
  locText: { ...typography.bodyBold },
  locTextSel: { color: '#FFFFFF' },
  locTextUnsel: { color: NAVY },

  persona: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: 10,
  },
  personaSel: { backgroundColor: NAVY },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#C7D0DA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSel: { borderColor: '#FFFFFF' },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFFFFF' },
  personaTitle: { ...typography.bodyBold, color: NAVY },
  personaTitleSel: { color: '#FFFFFF' },
  personaDesc: { ...typography.small, color: colors.textSecondary, marginTop: 2 },
  personaDescSel: { color: 'rgba(255,255,255,0.7)' },

  reminderRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md },
  reminderDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E2E8F0' },
  reminderTitle: { ...typography.bodyBold, color: NAVY, fontSize: 15 },
  reminderSub: { ...typography.small, color: colors.textSecondary, marginTop: 2 },

  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    backgroundColor: '#F4F7FB',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E2E8F0',
  },
  saveWrap: { borderRadius: 16, overflow: 'hidden' },
  saveBtn: { height: 54, alignItems: 'center', justifyContent: 'center' },
  saveText: { ...typography.bodyBold, color: '#FFFFFF', fontSize: 17 },
});
