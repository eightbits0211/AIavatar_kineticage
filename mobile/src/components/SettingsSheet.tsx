import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

import { colors, spacing, typography } from '../theme';
import { useUserStore } from '../stores/userStore';
import { apiPut } from '../services/api';

const { height: SCREEN_H } = Dimensions.get('window');
const SHEET_HEIGHT = Math.min(SCREEN_H * 0.82, 720);

const NAVY = '#16365A';
const TEAL = '#4FC3E8';

/* ───────────────────────── Section icons ───────────────────────── */
type IconName = 'robot' | 'target' | 'alert' | 'dumbbell' | 'bell' | 'person';

function SectionIcon({ name, size = 18, color = colors.primary }: { name: IconName; size?: number; color?: string }) {
  const s = { stroke: color, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  switch (name) {
    case 'person':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle cx={12} cy={8} r={4} {...s} />
          <Path d="M4 20c0-4 4-6 8-6s8 2 8 6" {...s} />
        </Svg>
      );
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

/* ───────────────────────── Data ─────────────────────────
 * label = what the user sees, value = the backend enum/token that actually
 * drives the Rules Engine + persona recalculation on PUT /api/profile.
 */
const GOALS: Array<{ label: string; value: string }> = [
  { label: 'Strength', value: 'strength' },
  { label: 'Muscle Gain', value: 'hypertrophy' },
  { label: 'Mobility', value: 'mobility' },
  { label: 'General Fitness', value: 'general_fitness' },
  { label: 'Weight Loss', value: 'weight_loss' },
  { label: 'Home Workout', value: 'home_workout' },
];
// Injury tokens matching onboarding + exercise contraindication data.
const CONSTRAINTS: Array<{ label: string; value: string }> = [
  { label: 'Knee', value: 'knee' },
  { label: 'Lower Back', value: 'lower_back' },
  { label: 'Shoulder', value: 'shoulder' },
  { label: 'Wrist', value: 'wrist' },
  { label: 'Ankle', value: 'ankle' },
];
// Maps to fitness_level, which gates the max exercise difficulty in the filter stage.
const INTENSITIES: Array<{ label: string; value: string }> = [
  { label: 'Light', value: 'beginner' },
  { label: 'Moderate', value: 'intermediate' },
  { label: 'Intense', value: 'advanced' },
];
const LOCATIONS: Array<{ label: string; value: 'home' | 'gym' }> = [
  { label: 'Home', value: 'home' },
  { label: 'Gym', value: 'gym' },
];
// Equipment tokens must match the exercise library's equipment_required values
// so the Rules Engine filter stage includes the right exercises. Empty → ['none'].
const EQUIPMENT: Array<{ label: string; value: string }> = [
  { label: 'Dumbbells', value: 'dumbbells' },
  { label: 'Barbell', value: 'barbell' },
  { label: 'Resistance Bands', value: 'resistance_bands' },
  { label: 'Kettlebell', value: 'kettlebell' },
  { label: 'Pull-up Bar', value: 'pull_up_bar' },
  { label: 'Bench', value: 'bench' },
  { label: 'Machines', value: 'machines' },
  { label: 'Cardio Equipment', value: 'cardio_equipment' },
];
// Snap the free-form duration slider to the backend's allowed values.
const snapDuration = (d: number): number =>
  [15, 30, 45, 60].reduce((prev, cur) => (Math.abs(cur - d) < Math.abs(prev - d) ? cur : prev));

interface SettingsSheetProps {
  visible: boolean;
  onClose: () => void;
  onSave?: (prefs: any) => void;
}

export default function SettingsSheet({ visible, onClose, onSave }: SettingsSheetProps) {
  const [mounted, setMounted] = useState(visible);
  const fade = useRef(new Animated.Value(0)).current;

  const user = useUserStore((s) => s.user);
  const setUser = useUserStore((s) => s.setUser);

  const [goal, setGoal] = useState('general_fitness');
  const [constraints, setConstraints] = useState<string[]>([]);
  const [duration, setDuration] = useState(30);
  const [intensity, setIntensity] = useState('beginner'); // → fitness_level
  const [location, setLocation] = useState<'home' | 'gym'>('home');
  const [equipment, setEquipment] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Seed the controls from the saved profile each time the sheet opens.
  useEffect(() => {
    if (!visible || !user) return;
    const u = user as any;
    if (u.fitness_goal) setGoal(u.fitness_goal);
    setConstraints((u.injuries || []).filter((i: string) => i && i !== 'none'));
    if (u.workout_duration) setDuration(u.workout_duration);
    if (u.fitness_level) setIntensity(u.fitness_level);
    if (u.workout_location === 'home' || u.workout_location === 'gym') setLocation(u.workout_location);
    setEquipment((u.equipment || []).filter((e: string) => e && e !== 'none'));
  }, [visible, user]);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    } else if (mounted) {
      Animated.timing(fade, { toValue: 0, duration: 180, useNativeDriver: true }).start(
        ({ finished }) => finished && setMounted(false)
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!mounted) return null;

  const toggleConstraint = (c: string) =>
    setConstraints((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  const toggleEquipment = (e: string) =>
    setEquipment((prev) => (prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]));

  const handleSave = async () => {
    setSaving(true);
    try {
      // Persist the fields that actually drive workout generation. PUT /api/profile
      // recalculates persona_tags, so the next generated bundles reflect these.
      const updated = await apiPut<any>('/api/profile', {
        fitness_goal: goal,
        injuries: constraints.length ? constraints : ['none'],
        workout_duration: snapDuration(duration),
        fitness_level: intensity,
        workout_location: location,
        equipment: equipment.length ? equipment : ['none'],
      });
      if (updated) setUser(updated);
    } catch {
      // Non-blocking — keep the sheet's selections even if the save fails.
    } finally {
      setSaving(false);
      // AI personality is managed only in the Profile tab.
      onSave?.({ goal, constraints, duration, intensity, location, equipment });
      onClose();
    }
  };

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      {/* Blurred backdrop */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade }]}>
        <BlurView intensity={26} tint="dark" style={[StyleSheet.absoluteFill, styles.scrim]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close settings" />
        </BlurView>
      </Animated.View>

      {/* Floating centered window */}
      <Animated.View
        style={[
          styles.sheet,
          {
            opacity: fade,
            transform: [{ scale: fade.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }],
          },
        ]}
      >
        <View style={styles.header}>
          <SectionIcon name="person" size={22} color={colors.primary} />
          <Text style={styles.title}>User Preferences</Text>
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
              const sel = goal === g.value;
              return (
                <Pressable key={g.value} onPress={() => setGoal(g.value)} style={[styles.chip, sel && styles.chipSel]}>
                  {sel && <CheckMark size={13} />}
                  <Text style={[styles.chipText, sel && styles.chipTextSel]}>{g.label}</Text>
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
              const sel = constraints.includes(c.value);
              return (
                <Pressable key={c.value} onPress={() => toggleConstraint(c.value)} style={[styles.chip, sel && styles.chipSel]}>
                  {sel && <CheckMark size={13} />}
                  <Text style={[styles.chipText, sel && styles.chipTextSel]}>{c.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* Equipment — multi-select; feeds the Rules Engine filter stage */}
          <View style={styles.sectionHead}>
            <SectionIcon name="dumbbell" />
            <Text style={styles.sectionTitle}>Equipment</Text>
          </View>
          <View style={styles.chipWrap}>
            {EQUIPMENT.map((e) => {
              const sel = equipment.includes(e.value);
              return (
                <Pressable key={e.value} onPress={() => toggleEquipment(e.value)} style={[styles.chip, sel && styles.chipSel]}>
                  {sel && <CheckMark size={13} />}
                  <Text style={[styles.chipText, sel && styles.chipTextSel]}>{e.label}</Text>
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
                const sel = intensity === i.value;
                return (
                  <Pressable key={i.value} onPress={() => setIntensity(i.value)} style={[styles.segment, sel && styles.segmentSel]}>
                    <Text style={[styles.segmentText, sel && styles.segmentTextSel]}>{i.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.locationRow}>
            {LOCATIONS.map((loc) => {
              const sel = location === loc.value;
              return (
                <Pressable key={loc.value} onPress={() => setLocation(loc.value)} style={[styles.locBtn, sel ? styles.locBtnSel : styles.locBtnUnsel]}>
                  <Text style={[styles.locText, sel ? styles.locTextSel : styles.locTextUnsel]}>{loc.label}</Text>
                </Pressable>
              );
            })}
          </View>

        </ScrollView>

        {/* Sticky Save */}
        <View style={styles.footer}>
          <Pressable onPress={handleSave} disabled={saving} style={styles.saveBtn} accessibilityLabel="Save preferences">
            {saving ? (
              <ActivityIndicator color="#F5821F" />
            ) : (
              <Text style={styles.saveText}>Save Preferences</Text>
            )}
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  scrim: { backgroundColor: 'rgba(24,24,26,0.5)' },
  sheet: {
    width: '100%',
    maxHeight: SHEET_HEIGHT,
    backgroundColor: '#1C1C1E',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
  },
  title: { ...typography.h3, color: '#FFFFFF', flex: 1, fontFamily: 'Inter_700Bold' },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#2C2C2E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },

  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.lg, marginBottom: spacing.md },
  sectionTitle: { ...typography.h3, fontSize: 17, color: '#FFFFFF', fontFamily: 'Inter_700Bold' },
  sectionNote: { ...typography.small, color: colors.textSecondary, marginTop: -spacing.sm, marginBottom: spacing.sm } as any,

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
    backgroundColor: '#2C2C2E',
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  chipSel: { backgroundColor: NAVY, borderColor: NAVY },
  chipText: { ...typography.caption, color: '#FFFFFF', fontFamily: 'Inter_600SemiBold' },
  chipTextSel: { color: '#FFFFFF' },

  card: {
    backgroundColor: '#2C2C2E',
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
  cardLabel: { ...typography.bodyBold, color: '#FFFFFF' },
  cardValue: { ...typography.bodyBold, color: colors.primary },
  rangeLabel: { ...typography.small, color: colors.textSecondary, marginTop: 8 },

  sliderHit: { height: 28, justifyContent: 'center', marginTop: spacing.sm },
  sliderTrack: { height: 6, borderRadius: 3, backgroundColor: '#2C2C2E', overflow: 'hidden' },
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
    backgroundColor: '#2C2C2E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentSel: { backgroundColor: TEAL },
  segmentText: { ...typography.caption, color: colors.textSecondary, fontFamily: 'Inter_600SemiBold' },
  segmentTextSel: { color: '#FFFFFF' },

  locationRow: { flexDirection: 'row', gap: 12, marginBottom: spacing.sm },
  locBtn: { flex: 1, paddingVertical: 16, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  locBtnSel: { backgroundColor: NAVY },
  locBtnUnsel: { backgroundColor: '#2C2C2E', borderWidth: 1, borderColor: '#2C2C2E' },
  locText: { ...typography.bodyBold },
  locTextSel: { color: '#FFFFFF' },
  locTextUnsel: { color: '#FFFFFF' },

  persona: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: '#2C2C2E',
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
  personaTitle: { ...typography.bodyBold, color: '#FFFFFF' },
  personaTitleSel: { color: '#FFFFFF' },
  personaDesc: { ...typography.small, color: colors.textSecondary, marginTop: 2 },
  personaDescSel: { color: 'rgba(255,255,255,0.7)' },

  reminderRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md },
  reminderDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#2C2C2E' },
  reminderTitle: { ...typography.bodyBold, color: '#FFFFFF', fontSize: 15 },
  reminderSub: { ...typography.small, color: colors.textSecondary, marginTop: 2 },

  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: '#1C1C1E',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#2C2C2E',
  },
  saveBtn: {
    alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(245,130,31,0.16)',
    borderRadius: 22, paddingHorizontal: spacing.lg, paddingVertical: 12,
  },
  saveText: { ...typography.caption, color: '#F5821F', fontFamily: 'Inter_600SemiBold', fontSize: 15 },
});
