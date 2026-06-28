import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Line, Path, Polyline, Text as SvgText } from 'react-native-svg';

import { apiGet } from '../services/api';
import { useUserStore } from '../stores/userStore';
import { colors, spacing, typography } from '../theme';

const NAVY = '#16365A';
const ORANGE = '#F5821F';
const BLUE = '#5BB7E8';
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Baseline exercises so the Strength Progress interface shows from day one
// (zeroed bars). Real per-exercise data from the backend replaces these.
const DEFAULT_STRENGTH = [
  { name: 'Push-Ups', start_reps: 0, current_reps: 0 },
  { name: 'Squats', start_reps: 0, current_reps: 0 },
  { name: 'Plank', start_reps: 0, current_reps: 0 },
  { name: 'Lunges', start_reps: 0, current_reps: 0 },
];

type Range = 'week' | 'month';

interface WeeklyResp {
  range: string;
  current_period: {
    sessions: number;
    total_sets: number;
    total_reps: number;
    total_xp: number;
    days_active: number;
    by_day: Record<string, number>;
  };
  previous_period: { sessions: number };
  change: number;
}
interface HistoryItem {
  date: string;
  duration_min: number;
  status: string;
  xp_awarded: number;
}
interface GoalResp {
  total_workouts: number;
  workouts_last_30_days: number;
  sessions_per_week_avg: number;
  current_streak: number;
  longest_streak: number;
  level: number;
  total_xp: number;
  exercises_progressed: number;
}
interface DashResp {
  weekly_progress: { completed: number; planned: number; calories_burned: { low: number; high: number } };
}
interface StrengthExercise {
  name: string;
  start_reps: number;
  current_reps: number;
}
interface StrengthResp {
  exercises: StrengthExercise[];
}
interface WeightPoint {
  label: string;
  kg: number;
}
interface WeightResp {
  points: WeightPoint[];
}

/* ───────────────── small icons ───────────────── */
function TrendIcon({ dir, color }: { dir: 'down' | 'up' | 'pulse'; color: string }) {
  const s = { stroke: color, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  if (dir === 'down') {
    return (
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Path d="M3 7l6 6 4-4 8 8" {...s} />
        <Path d="M21 17v-5h-5" {...s} />
      </Svg>
    );
  }
  if (dir === 'up') {
    return (
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Path d="M3 17l6-6 4 4 8-8" {...s} />
        <Path d="M21 7v5h-5" {...s} />
      </Svg>
    );
  }
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M3 12h4l2-6 4 12 2-6h6" {...s} />
    </Svg>
  );
}

/* ───────────────── bar chart (View-based, RN-Web safe) ───────────────── */
function BarChart({
  data,
  maxValue,
  color,
  yTicks,
}: {
  data: Array<{ label: string; value: number }>;
  maxValue: number;
  color: string;
  yTicks: number[];
}) {
  const max = Math.max(maxValue, 1);
  return (
    <View style={styles.chart}>
      <View style={styles.yAxis}>
        {yTicks.map((t) => (
          <Text key={t} style={styles.yTick}>{t}</Text>
        ))}
      </View>
      <View style={styles.barsArea}>
        {data.map((d, i) => (
          <View key={i} style={styles.barCol}>
            <View style={styles.barTrackV}>
              <View style={[styles.bar, { height: `${Math.min(100, (d.value / max) * 100)}%`, backgroundColor: color }]} />
            </View>
            <Text style={styles.barLabel}>{d.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/* ───────────────── line chart (weight trend) ───────────────── */
function LineChart({ axisLabels, points }: { axisLabels: string[]; points: number[] }) {
  const [w, setW] = useState(0);
  const height = 170;
  const padL = 32;
  const padR = 14;
  const padT = 16;
  const padB = 26;

  // Y scale: pad around the data; handle the single-point (flat) case nicely.
  let lo: number;
  let hi: number;
  if (points.length === 0) {
    lo = 0;
    hi = 1;
  } else {
    const minV = Math.min(...points);
    const maxV = Math.max(...points);
    if (minV === maxV) {
      lo = minV - 4;
      hi = maxV + 4;
    } else {
      const r = maxV - minV;
      lo = minV - r * 0.4;
      hi = maxV + r * 0.4;
    }
  }
  const span = hi - lo || 1;

  const innerW = Math.max(0, w - padL - padR);
  const innerH = height - padT - padB;
  const n = axisLabels.length;
  const x = (i: number) => padL + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v: number) => padT + (1 - (v - lo) / span) * innerH;
  const linePts = points.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  const ticks = [hi, (hi + lo) / 2, lo];

  return (
    <View style={{ height }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {w > 0 && (
        <Svg width={w} height={height}>
          {/* horizontal gridlines */}
          {ticks.map((t, i) => {
            const yy = padT + (i / (ticks.length - 1)) * innerH;
            return <Line key={`g${i}`} x1={padL} y1={yy} x2={w - padR} y2={yy} stroke="#EAEFF5" strokeWidth={1} strokeDasharray="3 4" />;
          })}
          {/* y-axis tick labels */}
          {ticks.map((t, i) => {
            const yy = padT + (i / (ticks.length - 1)) * innerH;
            return (
              <SvgText key={`t${i}`} x={padL - 6} y={yy + 3} fontSize={10} fill="#A6B0BD" textAnchor="end">
                {Math.round(t)}
              </SvgText>
            );
          })}
          {/* line (only when 2+ points) */}
          {points.length >= 2 && (
            <Polyline points={linePts} fill="none" stroke={BLUE} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          )}
          {/* plotted points */}
          {points.map((v, i) => (
            <Circle key={`p${i}`} cx={x(i)} cy={y(v)} r={4} fill="#FFFFFF" stroke={BLUE} strokeWidth={2.5} />
          ))}
          {/* x-axis labels (full week frame) */}
          {axisLabels.map((l, i) => (
            <SvgText key={`x${i}`} x={x(i)} y={height - 7} fontSize={10} fill="#7F8C8D" textAnchor="middle">
              {l}
            </SvgText>
          ))}
        </Svg>
      )}
    </View>
  );
}

/* ───────────────── strength row (per-exercise progress bar) ───────────────── */
function StrengthRow({ ex, scaleMax }: { ex: StrengthExercise; scaleMax: number }) {
  const max = Math.max(scaleMax, 1);
  const change = ex.current_reps - ex.start_reps;
  const fillPct = Math.min(100, (ex.current_reps / max) * 100);
  const startPct = Math.min(100, (ex.start_reps / max) * 100);
  return (
    <View style={styles.strengthRow}>
      <View style={styles.strengthTop}>
        <Text style={styles.strengthName}>{ex.name}</Text>
        <Text style={styles.strengthChange}>{change >= 0 ? '+' : ''}{change} reps</Text>
      </View>
      <View style={styles.strengthBarRow}>
        <View style={styles.strengthBarWrap}>
          <View style={styles.strengthTrack} />
          <LinearGradient
            colors={[BLUE, ORANGE]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.strengthFill, { width: `${fillPct}%` }]}
          />
          <View style={[styles.strengthStartMarker, { left: `${startPct}%` }]} />
        </View>
        <Text style={styles.strengthCurrent}>{ex.current_reps}</Text>
      </View>
      <View style={styles.strengthBottom}>
        <Text style={styles.strengthMeta}>Start: {ex.start_reps}</Text>
        <Text style={styles.strengthMeta}>Current: {ex.current_reps}</Text>
      </View>
    </View>
  );
}

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const user = useUserStore((s) => s.user);

  const [range, setRange] = useState<Range>('week');
  const [weekly, setWeekly] = useState<WeeklyResp | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [goal, setGoal] = useState<GoalResp | null>(null);
  const [dash, setDash] = useState<DashResp | null>(null);
  const [strength, setStrength] = useState<StrengthExercise[] | null>(null);
  const [weightData, setWeightData] = useState<WeightResp | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (r: Range) => {
    setLoading(true);
    try {
      const [w, h, g, d, st, wt] = await Promise.all([
        apiGet<WeeklyResp>(`/api/progress/weekly?range=${r}`).catch(() => null),
        apiGet<{ history: HistoryItem[] }>('/api/progress/history?limit=999').catch(() => null),
        apiGet<GoalResp>('/api/progress/goal').catch(() => null),
        apiGet<DashResp>('/api/dashboard').catch(() => null),
        apiGet<StrengthResp>('/api/progress/strength').catch(() => null),
        apiGet<WeightResp>(`/api/progress/weight?range=${r}`).catch(() => null),
      ]);
      if (w) setWeekly(w);
      if (h) setHistory(h.history ?? []);
      if (g) setGoal(g);
      if (d) setDash(d);
      setStrength(st?.exercises ?? null);
      setWeightData(wt ?? null);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(range);
    }, [load, range])
  );

  const switchRange = (r: Range) => {
    if (r !== range) {
      setRange(r);
      load(r);
    }
  };

  // ── derived: activity buckets from real session history ──
  const now = new Date();
  const year = now.getFullYear();
  const monthIdx = now.getMonth();
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();

  // Start of the current week (Sunday) — used for the calorie rate derivation.
  const weekStart = (() => {
    const d = new Date(now);
    d.setDate(now.getDate() - now.getDay());
    d.setHours(0, 0, 0, 0);
    return d;
  })();

  // Build the activity buckets for the selected range.
  let activityData: Array<{ label: string; value: number }>;
  if (range === 'week') {
    const mins = [0, 0, 0, 0, 0, 0, 0]; // Mon..Sun
    for (const s of history) {
      const dt = new Date(s.date);
      if (dt >= weekStart) mins[(dt.getDay() + 6) % 7] += s.duration_min || 0;
    }
    activityData = WEEKDAYS.map((l, i) => ({ label: l, value: mins[i] }));
  } else {
    const weeks = Math.ceil(daysInMonth / 7);
    const mins = new Array(weeks).fill(0);
    for (const s of history) {
      const dt = new Date(s.date);
      if (dt.getFullYear() === year && dt.getMonth() === monthIdx) {
        const wk = Math.min(weeks - 1, Math.floor((dt.getDate() - 1) / 7));
        mins[wk] += s.duration_min || 0;
      }
    }
    activityData = mins.map((v, i) => ({ label: `W${i + 1}`, value: v }));
  }
  const totalMinutes = activityData.reduce((a, b) => a + b.value, 0);

  // ── calories: derive a kcal/min rate from this week's real total, then apply
  // to each bucket's real minutes so week AND month scale correctly. ──
  const cal = dash?.weekly_progress?.calories_burned;
  const weeklyCalories = cal ? Math.round((cal.low + cal.high) / 2) : 0;
  let weekMinutes = 0;
  for (const s of history) {
    if (new Date(s.date) >= weekStart) weekMinutes += s.duration_min || 0;
  }
  const kcalPerMin = weekMinutes > 0 ? weeklyCalories / weekMinutes : 0;
  const calorieData = activityData.map((b) => ({ label: b.label, value: Math.round(b.value * kcalPerMin) }));
  const periodCalories = calorieData.reduce((a, b) => a + b.value, 0);

  // ── summary metrics (all real) ──
  const daysActive = weekly?.current_period?.days_active ?? 0;
  const totalDays = range === 'week' ? 7 : daysInMonth;
  const consistency = totalDays > 0 ? Math.min(100, Math.round((daysActive / totalDays) * 100)) : 0;
  const totalWorkouts = goal?.total_workouts ?? 0;
  const streak = goal?.current_streak ?? user?.gamification?.current_streak ?? 0;

  const bmi = user?.calculated_metrics?.bmi;
  const bmiCat = user?.calculated_metrics?.bmi_category;
  const weight = user?.weight_kg;

  const maxMin = Math.max(60, ...activityData.map((d) => d.value));
  const maxCal = Math.max(380, ...calorieData.map((d) => d.value));

  // Always-present interfaces (seeded baselines until backend data arrives).
  const strengthRows = strength && strength.length > 0 ? strength : DEFAULT_STRENGTH;
  const strengthScaleMax = Math.max(1, ...strengthRows.map((e) => e.current_reps));
  const weightPoints =
    weightData && weightData.points.length > 0
      ? weightData.points
      : weight
        ? [{ label: 'W1', kg: weight }]
        : [];

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator contentContainerStyle={styles.scroll}>
        {/* ── Header ── */}
        <LinearGradient
          colors={['#2D6CA8', '#1E4E7E']}
          style={[styles.header, { paddingTop: Math.max(insets.top, 24) + spacing.md }]}
        >
          <Text style={styles.title}>Progress</Text>
          <Text style={styles.subtitle}>Track your transformation</Text>

          <View style={styles.summaryRow}>
            <SummaryCard icon={<TrendIcon dir="pulse" color={BLUE} />} value={`${consistency}%`} label="Consistency" />
            <SummaryCard icon={<TrendIcon dir="up" color={ORANGE} />} value={`${totalWorkouts}`} label="Workouts" />
            <SummaryCard icon={<TrendIcon dir="up" color="#FFD54A" />} value={`${streak}`} label="Day Streak" />
          </View>
        </LinearGradient>

        <View style={styles.body}>
          {/* Range toggle */}
          <View style={styles.toggle}>
            {(['week', 'month'] as const).map((r) => {
              const active = range === r;
              return (
                <Pressable key={r} style={styles.toggleBtn} onPress={() => switchRange(r)}>
                  {active ? (
                    <LinearGradient colors={[BLUE, '#3A93C9']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.toggleActive}>
                      <Text style={styles.toggleTextActive}>{r === 'week' ? 'This Week' : 'This Month'}</Text>
                    </LinearGradient>
                  ) : (
                    <Text style={styles.toggleText}>{r === 'week' ? 'This Week' : 'This Month'}</Text>
                  )}
                </Pressable>
              );
            })}
          </View>

          {loading && !weekly ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
          ) : (
            <>
              {/* Calories Burned (real weekly total, distributed) */}
              <View style={styles.card}>
                <View style={styles.cardHead}>
                  <Text style={styles.cardTitle}>Calories Burned</Text>
                  <Text style={styles.cardAccentOrange}>{periodCalories.toLocaleString()} this {range === 'week' ? 'week' : 'month'}</Text>
                </View>
                <BarChart
                  data={calorieData}
                  maxValue={maxCal}
                  color={ORANGE}
                  yTicks={[Math.round(maxCal), Math.round(maxCal / 2), Math.round(maxCal / 4), 0]}
                />
                <Text style={styles.footnote}>Estimated from your workouts' calorie ranges.</Text>
              </View>

              {/* Activity (real, minutes) */}
              <View style={styles.card}>
                <View style={styles.cardHead}>
                  <Text style={styles.cardTitle}>{range === 'week' ? 'Weekly' : 'Monthly'} Activity</Text>
                  <Text style={styles.cardAccent}>{daysActive}/{totalDays} days active</Text>
                </View>
                <BarChart
                  data={activityData}
                  maxValue={maxMin}
                  color={BLUE}
                  yTicks={[Math.round(maxMin), Math.round(maxMin * 0.75), Math.round(maxMin / 2), Math.round(maxMin / 4), 0]}
                />
              </View>

              {/* Strength Progress (interface seeded; fills as rep data arrives) */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Strength Progress</Text>
                <View style={{ marginTop: spacing.sm }}>
                  {strengthRows.map((ex) => (
                    <StrengthRow key={ex.name} ex={ex} scaleMax={strengthScaleMax} />
                  ))}
                </View>
              </View>

              {/* Weight Trend (interface seeded with current weight as start) */}
              <View style={styles.card}>
                <View style={styles.cardHead}>
                  <Text style={styles.cardTitle}>Weight Trend</Text>
                  {weightPoints.length > 0 && (
                    <Text style={styles.cardAccent}>{weightPoints[weightPoints.length - 1].kg} kg</Text>
                  )}
                </View>
                {weightPoints.length > 0 ? (
                  <>
                    <Text style={styles.weightSub}>
                      kg · 6-week view
                      {weightPoints.length >= 2
                        ? (() => {
                            const diff = weightPoints[0].kg - weightPoints[weightPoints.length - 1].kg;
                            return diff > 0 ? `   ↓ ${diff.toFixed(1)} kg from start` : diff < 0 ? `   ↑ ${Math.abs(diff).toFixed(1)} kg from start` : '';
                          })()
                        : '   tracking from today'}
                    </Text>
                    <LineChart
                      axisLabels={weightPoints.length >= 2 ? weightPoints.map((p) => p.label) : ['W1', 'W2', 'W3', 'W4', 'W5', 'W6']}
                      points={weightPoints.map((p) => p.kg)}
                    />
                  </>
                ) : (
                  <Empty text="Add your weight in your profile to start tracking your trend." />
                )}
              </View>

              {/* BMI Tracker (real) */}
              <View style={styles.card}>
                <Text style={styles.cardTitle}>BMI Tracker</Text>
                {bmi ? (
                  <>
                    <Text style={styles.bmiValue}>{bmi.toFixed(1)}</Text>
                    <Text style={styles.bmiLabel}>Current BMI</Text>
                    {!!bmiCat && (
                      <View style={styles.bmiCatPill}>
                        <Text style={styles.bmiCatText}>{bmiCat.charAt(0).toUpperCase() + bmiCat.slice(1)}</Text>
                      </View>
                    )}
                    <BmiScale bmi={bmi} />
                  </>
                ) : (
                  <Empty text="Complete onboarding to see your BMI." />
                )}
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function SummaryCard({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <View style={styles.summaryCard}>
      <View style={styles.summaryIcon}>{icon}</View>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

/** Gradient BMI scale (15–35) with a marker at the current BMI. */
function BmiScale({ bmi }: { bmi: number }) {
  const pct = Math.max(0, Math.min(1, (bmi - 15) / (35 - 15))) * 100;
  return (
    <View style={styles.bmiScaleWrap}>
      <View style={styles.bmiBarWrap}>
        <LinearGradient
          colors={['#5BB7E8', '#34C759', '#FFD54A', '#FF8A3D', '#EF4444']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.bmiBar}
        />
        <View style={[styles.bmiMarker, { left: `${pct}%` }]} />
      </View>
      <View style={styles.bmiScaleLabels}>
        <Text style={styles.bmiScaleTick}>15{'\n'}Under</Text>
        <Text style={styles.bmiScaleTick}>18.5{'\n'}Normal</Text>
        <Text style={styles.bmiScaleTick}>25{'\n'}Over</Text>
        <Text style={styles.bmiScaleTick}>35{'\n'}Obese</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingBottom: spacing.xl },

  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  title: { ...typography.h1, color: '#FFFFFF' },
  subtitle: { ...typography.caption, color: 'rgba(255,255,255,0.8)', marginTop: 2 },

  summaryRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  summaryCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 16,
    padding: spacing.md,
  },
  summaryIcon: { marginBottom: spacing.sm },
  summaryValue: { ...typography.h2, color: '#FFFFFF' },
  summaryLabel: { ...typography.small, color: 'rgba(255,255,255,0.75)', marginTop: 2 },

  body: { paddingHorizontal: spacing.lg, marginTop: spacing.lg },

  toggle: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 5,
    marginBottom: spacing.lg,
    shadowColor: '#1E4E7E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  toggleBtn: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  toggleActive: { width: '100%', alignItems: 'center', borderRadius: 24, paddingVertical: 12 },
  toggleTextActive: { ...typography.bodyBold, color: '#FFFFFF' },
  toggleText: { ...typography.bodyBold, color: colors.textSecondary, paddingVertical: 12 },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: spacing.lg,
    marginBottom: spacing.md,
    shadowColor: '#1E4E7E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  cardTitle: { ...typography.h3, color: NAVY, fontFamily: 'Inter_700Bold' },
  cardAccent: { ...typography.bodyBold, color: colors.primary },
  cardAccentOrange: { ...typography.bodyBold, color: ORANGE },
  footnote: { ...typography.small, color: colors.textLight, marginTop: spacing.sm },

  chart: { flexDirection: 'row', height: 170, marginTop: spacing.sm },
  yAxis: { width: 30, justifyContent: 'space-between', paddingBottom: 22 },
  yTick: { ...typography.small, fontSize: 10, color: colors.textLight, textAlign: 'right' },
  barsArea: { flex: 1, flexDirection: 'row', alignItems: 'flex-end' },
  barCol: { flex: 1, alignItems: 'center' },
  barTrackV: { flex: 1, width: '100%', justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 6 },
  bar: { width: 16, borderRadius: 6 },
  barLabel: { ...typography.small, fontSize: 10, color: colors.textSecondary, height: 16 },

  bmiValue: { fontSize: 40, fontFamily: 'Inter_700Bold', color: colors.primary, marginTop: spacing.sm },
  bmiLabel: { ...typography.caption, color: colors.textSecondary },
  weightSub: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.sm },
  strengthRow: { marginBottom: spacing.lg },
  strengthTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  strengthName: { ...typography.bodyBold, color: NAVY },
  strengthChange: { ...typography.bodyBold, color: ORANGE },
  strengthBarRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  strengthBarWrap: { flex: 1, height: 10, justifyContent: 'center' },
  strengthTrack: { position: 'absolute', left: 0, right: 0, height: 8, borderRadius: 4, backgroundColor: '#EAEFF5' },
  strengthFill: { height: 8, borderRadius: 4 },
  strengthStartMarker: { position: 'absolute', width: 2, height: 14, backgroundColor: '#9FB2C4', marginLeft: -1 },
  strengthCurrent: { ...typography.bodyBold, color: colors.primary, minWidth: 28, textAlign: 'right' },
  strengthBottom: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  strengthMeta: { ...typography.small, color: colors.textSecondary },
  bmiCatPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#EAF2FB',
    borderRadius: 10,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    marginTop: spacing.sm,
  },
  bmiCatText: { ...typography.small, color: colors.primary, fontFamily: 'Inter_600SemiBold' },
  bmiScaleWrap: { marginTop: spacing.lg },
  bmiBarWrap: { height: 12, justifyContent: 'center' },
  bmiBar: { height: 8, borderRadius: 4 },
  bmiMarker: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: colors.primary,
    marginLeft: -8,
  },
  bmiScaleLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
  bmiScaleTick: { ...typography.small, fontSize: 10, color: colors.textLight, textAlign: 'center' },

  empty: {
    backgroundColor: '#F4F7FB',
    borderRadius: 12,
    padding: spacing.lg,
    marginTop: spacing.sm,
  },
  emptyText: { ...typography.caption, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
});
