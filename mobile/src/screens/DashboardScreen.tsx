import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Line, Path, Polyline, Text as SvgText } from 'react-native-svg';

import { apiGet, apiPost, apiPut } from '../services/api';
import { useUserStore } from '../stores/userStore';
import { colors, spacing, typography } from '../theme';

const NAVY = '#16365A';
const ORANGE = '#F5821F';
const BLUE = '#5BB7E8';

// Enable smooth expand/collapse LayoutAnimation on Android.
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
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
  calories_burned: number;
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
interface StrengthExercise {
  name: string;
  start_reps: number;
  current_reps: number;
}
interface StrengthResp {
  exercises: StrengthExercise[];
  summary?: {
    total_exercises_tracked: number;
    overall_strength_change_pct: number;
  };
}
interface WeightEntry {
  date: string;
  weight_kg: number;
}
interface WeightResp {
  entries: WeightEntry[];
  summary?: {
    current_weight_kg: number;
    start_weight_kg: number;
    change_kg: number;
    total_entries: number;
  };
}
interface Insight {
  type: string;
  message: string;
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
          {ticks.map((_t, i) => {
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
function StrengthRow({ ex, scaleMax, last }: { ex: StrengthExercise; scaleMax: number; last?: boolean }) {
  const max = Math.max(scaleMax, 1);
  const change = ex.current_reps - ex.start_reps;
  const fillPct = Math.min(100, (ex.current_reps / max) * 100);
  const startPct = Math.min(100, (ex.start_reps / max) * 100);
  return (
    <View style={[styles.strengthRow, last && styles.strengthRowLast]}>
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

/* ───────────────── compact metric tile (Apple-Health style) ───────────────── */
function MetricTile({
  title,
  value,
  unit,
  color,
  data,
  chart,
  expanded,
  onPress,
}: {
  title: string;
  value: string;
  unit: string;
  color: string;
  data?: Array<{ label: string; value: number }>;
  chart?: React.ReactNode;
  expanded: boolean;
  onPress: () => void;
}) {
  const bars = data ?? [];
  const max = Math.max(1, ...bars.map((d) => d.value));
  return (
    <Pressable style={styles.tile} onPress={onPress} accessibilityRole="button" accessibilityLabel={`${title}, tap to ${expanded ? 'collapse' : 'expand'}`}>
      <View style={styles.tileHead}>
        <Text style={styles.tileTitle}>{title}</Text>
        <View style={styles.tileChevron}>
          <Text style={styles.tileChevronText}>{expanded ? '▾' : '›'}</Text>
        </View>
      </View>
      <Text style={[styles.tileValue, { color }]}>
        {value}
        <Text style={styles.tileUnit}>{` ${unit}`}</Text>
      </Text>
      {chart ? (
        <View style={styles.miniChartWrap}>{chart}</View>
      ) : (
        <View style={styles.miniBars}>
          {bars.map((d, i) => (
            <View key={i} style={styles.miniBarCol}>
              <View style={[styles.miniBar, { height: `${Math.max(4, (d.value / max) * 100)}%`, backgroundColor: color }]} />
            </View>
          ))}
        </View>
      )}
    </Pressable>
  );
}

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const user = useUserStore((s) => s.user);
  const setUser = useUserStore((s) => s.setUser);

  const [range, setRange] = useState<Range>('week');
  // Which metric tile is expanded into its full chart (null = both collapsed).
  const [expanded, setExpanded] = useState<'calories' | 'activity' | null>(null);
  const [expandedB, setExpandedB] = useState<'weight' | 'bmi' | null>(null);
  const [strengthExpanded, setStrengthExpanded] = useState(false);
  const toggleStrength = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setStrengthExpanded((v) => !v);
  };
  const [weekly, setWeekly] = useState<WeeklyResp | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [goal, setGoal] = useState<GoalResp | null>(null);
  const [strength, setStrength] = useState<StrengthExercise[] | null>(null);
  const [strengthChangePct, setStrengthChangePct] = useState<number>(0);
  const [weightData, setWeightData] = useState<WeightResp | null>(null);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [weightInput, setWeightInput] = useState('');
  const [loggingWeight, setLoggingWeight] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (r: Range) => {
    setLoading(true);
    try {
      const [w, h, g, st, wt, ins] = await Promise.all([
        apiGet<WeeklyResp>(`/api/progress/weekly?range=${r}`).catch(() => null),
        apiGet<{ history: HistoryItem[] }>('/api/progress/history?limit=999').catch(() => null),
        apiGet<GoalResp>('/api/progress/goal').catch(() => null),
        apiGet<StrengthResp>('/api/progress/strength').catch(() => null),
        apiGet<WeightResp>(`/api/progress/weight?range=${r}`).catch(() => null),
        apiGet<{ insights: Insight[] }>('/api/progress/insights').catch(() => null),
      ]);
      if (w) setWeekly(w);
      if (h) setHistory(h.history ?? []);
      if (g) setGoal(g);
      setStrength(st?.exercises ?? null);
      setStrengthChangePct(st?.summary?.overall_strength_change_pct ?? 0);
      setWeightData(wt ?? null);
      setInsights(ins?.insights ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  // Log today's body weight, then refresh the trend + insights.
  const logWeight = useCallback(async () => {
    const kg = parseFloat(weightInput);
    if (!kg || kg < 20 || kg > 300) return;
    setLoggingWeight(true);
    try {
      // 1. Log the entry (feeds the weight graph history).
      await apiPost('/api/progress/weight', { weight_kg: kg });
      // 2. Recalculate BMI/metrics via the profile update (the weight route
      //    alone doesn't) and sync the store so the Profile tab's fitness card
      //    reflects the new weight + BMI immediately.
      try {
        const updated = await apiPut('/api/profile', { weight_kg: kg });
        if (updated) setUser(updated as any);
      } catch {
        // Metrics refresh is best-effort.
      }
      setWeightInput('');
      await load(range);
    } catch {
      // Non-blocking — keep the typed value so the user can retry.
    } finally {
      setLoggingWeight(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weightInput, range, load, setUser]);

  useFocusEffect(
    useCallback(() => {
      load(range);
    }, [load, range])
  );

  // Cold-start safety net: if the screen mounted/loaded before auth + user
  // were hydrated (empty charts), reload once the user becomes available.
  const reloadedForUser = useRef<string | null>(null);
  useEffect(() => {
    const uid = user?._id ?? null;
    if (uid && reloadedForUser.current !== uid) {
      reloadedForUser.current = uid;
      load(range);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id]);

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

  // Build the activity (minutes) and calorie buckets for the selected range,
  // both summed from real per-session data.
  let activityData: Array<{ label: string; value: number }>;
  let calorieData: Array<{ label: string; value: number }>;
  if (range === 'week') {
    const mins = [0, 0, 0, 0, 0, 0, 0]; // Mon..Sun
    const cals = [0, 0, 0, 0, 0, 0, 0];
    for (const s of history) {
      const dt = new Date(s.date);
      if (dt >= weekStart) {
        const i = (dt.getDay() + 6) % 7;
        mins[i] += s.duration_min || 0;
        cals[i] += s.calories_burned || 0;
      }
    }
    activityData = WEEKDAYS.map((l, i) => ({ label: l, value: mins[i] }));
    calorieData = WEEKDAYS.map((l, i) => ({ label: l, value: cals[i] }));
  } else {
    const weeks = Math.ceil(daysInMonth / 7);
    const mins = new Array(weeks).fill(0);
    const cals = new Array(weeks).fill(0);
    for (const s of history) {
      const dt = new Date(s.date);
      if (dt.getFullYear() === year && dt.getMonth() === monthIdx) {
        const wk = Math.min(weeks - 1, Math.floor((dt.getDate() - 1) / 7));
        mins[wk] += s.duration_min || 0;
        cals[wk] += s.calories_burned || 0;
      }
    }
    activityData = mins.map((v, i) => ({ label: `W${i + 1}`, value: v }));
    calorieData = cals.map((v, i) => ({ label: `W${i + 1}`, value: v }));
  }

  // Total calories / active minutes for the selected period (real, summed).
  const periodCalories = calorieData.reduce((a, b) => a + b.value, 0);
  const periodMinutes = activityData.reduce((a, b) => a + b.value, 0);

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
  // Highest-reps first; shrunk view shows the top 2.
  const strengthSorted = [...strengthRows].sort((a, b) => b.current_reps - a.current_reps);
  const strengthVisible = strengthExpanded ? strengthSorted : strengthSorted.slice(0, 2);
  const weightEntries = weightData?.entries ?? [];
  const weightPoints =
    weightEntries.length > 0
      ? weightEntries.map((e) => ({
          label: new Date(e.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
          kg: e.weight_kg,
        }))
      : weight
        ? [{ label: 'W1', kg: weight }]
        : [];

  // Mini bars for the weight tile — normalized to the min so the trend shows
  // (raw kg values are all near-identical and would render as full-height bars).
  const weightKgs = weightPoints.map((p) => p.kg);
  const weightMin = weightKgs.length ? Math.min(...weightKgs) : 0;
  const weightTileData = weightPoints.map((p, i) => ({ label: String(i), value: p.kg - weightMin + 1 }));
  const latestWeight = weightPoints.length ? weightPoints[weightPoints.length - 1].kg : null;
  // BMI marker position on the 15–35 mini scale.
  const bmiPct = bmi ? Math.max(0, Math.min(1, (bmi - 15) / 20)) * 100 : 0;

  return (
    <View style={styles.container}>
      {/* ── Fixed header (stays put while content scrolls) ── */}
      <LinearGradient
        colors={['#000000', '#000000']}
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

      <ScrollView showsVerticalScrollIndicator contentContainerStyle={styles.scroll}>
        <View style={styles.body}>
          {/* Range toggle */}
          <View style={styles.toggle}>
            {(['week', 'month'] as const).map((r) => {
              const active = range === r;
              return (
                <Pressable key={r} style={[styles.toggleBtn, active && styles.toggleBtnActive]} onPress={() => switchRange(r)}>
                  <Text style={[styles.toggleText, active && styles.toggleTextActive]}>{r === 'week' ? 'This Week' : 'This Month'}</Text>
                </Pressable>
              );
            })}
          </View>

          {loading && !weekly ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
          ) : (
            <>
              {/* Insights (AI-generated trend observations) */}
              {insights.length > 0 && (
                <View style={styles.card}>
                  <View style={styles.cardHead}>
                    <Text style={styles.cardTitle}>Insights</Text>
                  </View>
                  {insights.map((ins, i) => (
                    <View key={`${ins.type}-${i}`} style={styles.insightRow}>
                      <Text style={styles.insightText}>{ins.message}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Calories + Activity — compact tiles; tap to expand to the full chart */}
              <View style={styles.tileRow}>
                <MetricTile
                  title="Calories"
                  value={periodCalories.toLocaleString()}
                  unit="kcal"
                  color={ORANGE}
                  data={calorieData}
                  expanded={expanded === 'calories'}
                  onPress={() => setExpanded((e) => (e === 'calories' ? null : 'calories'))}
                />
                <MetricTile
                  title="Activity"
                  value={`${periodMinutes}`}
                  unit="min"
                  color={BLUE}
                  data={activityData}
                  expanded={expanded === 'activity'}
                  onPress={() => setExpanded((e) => (e === 'activity' ? null : 'activity'))}
                />
              </View>

              {/* Expanded Calories Burned */}
              {expanded === 'calories' && (
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
                  <Text style={styles.footnote}>Summed from each completed workout.</Text>
                </View>
              )}

              {/* Expanded Activity */}
              {expanded === 'activity' && (
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
              )}

              {/* Strength Progress — shrunk (top 2) with a chevron; expands in place */}
              <View style={styles.card}>
                <Pressable style={styles.strengthHead} onPress={toggleStrength} accessibilityRole="button" accessibilityLabel={strengthExpanded ? 'Collapse strength progress' : 'Expand strength progress'}>
                  <Text style={styles.cardTitle}>Strength Progress</Text>
                  <View style={styles.tileChevron}>
                    <Text style={styles.tileChevronText}>{strengthExpanded ? '▾' : '›'}</Text>
                  </View>
                </Pressable>
                {strengthChangePct !== 0 && (
                  <Text style={[styles.cardAccentOrange, styles.strengthPct]}>
                    {strengthChangePct > 0 ? '+' : ''}{strengthChangePct}% strength
                  </Text>
                )}
                <View style={{ marginTop: spacing.md }}>
                  {strengthVisible.map((ex, i) => (
                    <StrengthRow key={ex.name} ex={ex} scaleMax={strengthScaleMax} last={i === strengthVisible.length - 1} />
                  ))}
                </View>
              </View>

              {/* Weight + BMI — compact tiles; tap to expand */}
              <View style={styles.tileRow}>
                <MetricTile
                  title="Weight"
                  value={latestWeight != null ? `${latestWeight}` : '—'}
                  unit="kg"
                  color={BLUE}
                  data={weightTileData}
                  expanded={expandedB === 'weight'}
                  onPress={() => setExpandedB((e) => (e === 'weight' ? null : 'weight'))}
                />
                <MetricTile
                  title="BMI"
                  value={bmi ? bmi.toFixed(1) : '—'}
                  unit={bmiCat ? bmiCat.charAt(0).toUpperCase() + bmiCat.slice(1) : ''}
                  color={colors.primary}
                  expanded={expandedB === 'bmi'}
                  onPress={() => setExpandedB((e) => (e === 'bmi' ? null : 'bmi'))}
                  chart={
                    <View style={styles.miniBmiWrap}>
                      <LinearGradient
                        colors={['#5BB7E8', '#34C759', '#FFD54A', '#FF8A3D', '#EF4444']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.miniBmiBar}
                      />
                      {!!bmi && <View style={[styles.miniBmiMarker, { left: `${bmiPct}%` }]} />}
                    </View>
                  }
                />
              </View>

              {/* Expanded Weight Trend */}
              {expandedB === 'weight' && (
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
                  <Empty text="Log your weight below to start tracking your trend." />
                )}

                {/* Log today's weight */}
                <View style={styles.weightLogRow}>
                  <TextInput
                    style={styles.weightInput}
                    value={weightInput}
                    onChangeText={setWeightInput}
                    placeholder="Today's weight (kg)"
                    placeholderTextColor={colors.textLight}
                    keyboardType="numeric"
                    onSubmitEditing={logWeight}
                    returnKeyType="done"
                  />
                  <Pressable
                    onPress={logWeight}
                    disabled={loggingWeight || !weightInput.trim()}
                    style={[styles.weightLogBtn, (loggingWeight || !weightInput.trim()) && styles.weightLogBtnDisabled]}
                  >
                    {loggingWeight ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text style={styles.weightLogBtnText}>Log</Text>
                    )}
                  </Pressable>
                </View>
              </View>
              )}

              {/* Expanded BMI Tracker */}
              {expandedB === 'bmi' && (
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
              )}
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
  scroll: { paddingBottom: 124 },

  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
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
    backgroundColor: '#1C1C1E',
    borderRadius: 28,
    padding: 5,
    marginBottom: spacing.lg,
    shadowColor: '#1E4E7E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  toggleBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 24, paddingVertical: 12 },
  toggleBtnActive: { backgroundColor: '#2C2C2E' },
  toggleText: { ...typography.bodyBold, fontSize: 18, color: colors.textSecondary },
  toggleTextActive: { color: 'rgb(246, 208, 0)' },

  card: {
    backgroundColor: '#1C1C1E',
    borderRadius: 18,
    padding: spacing.lg,
    marginBottom: spacing.md,
    shadowColor: '#1E4E7E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  tileRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  tile: {
    flex: 1,
    backgroundColor: '#1C1C1E',
    borderRadius: 18,
    padding: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 2,
  },
  tileHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tileTitle: { ...typography.bodyBold, color: '#FFFFFF', fontSize: 16 },
  tileChevron: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  tileChevronText: { color: '#FFFFFF', fontSize: 14, fontFamily: 'Inter_700Bold', lineHeight: 16 },
  tileValue: { fontSize: 26, fontFamily: 'Inter_700Bold', marginTop: spacing.sm },
  tileUnit: { ...typography.small, color: colors.textSecondary, fontFamily: 'Inter_600SemiBold' },
  miniBars: { flexDirection: 'row', alignItems: 'flex-end', height: 46, gap: 3, marginTop: spacing.md },
  miniBarCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' },
  miniBar: { width: 4, borderRadius: 2, minHeight: 3 },
  miniChartWrap: { height: 46, justifyContent: 'center', marginTop: spacing.md },
  miniBmiWrap: { height: 14, justifyContent: 'center' },
  miniBmiBar: { height: 8, borderRadius: 4, width: '100%' },
  miniBmiMarker: {
    position: 'absolute', width: 3, height: 14, borderRadius: 1.5,
    backgroundColor: '#FFFFFF', marginLeft: -1.5,
  },

  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  strengthHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  strengthPct: { textAlign: 'right', marginTop: spacing.xs },
  cardTitle: { ...typography.h3, color: '#FFFFFF', fontFamily: 'Inter_700Bold' },
  cardAccent: { ...typography.bodyBold, color: colors.primary },
  cardAccentOrange: { ...typography.bodyBold, color: ORANGE },
  footnote: { ...typography.small, color: colors.textLight, marginTop: spacing.sm },

  chart: { flexDirection: 'row', height: 170, marginTop: spacing.sm },
  yAxis: { width: 30, justifyContent: 'space-between', paddingBottom: 22 },
  yTick: { ...typography.small, fontSize: 10, color: colors.textLight, textAlign: 'right' },
  barsArea: { flex: 1, flexDirection: 'row', alignItems: 'stretch' },
  barCol: { flex: 1, alignItems: 'center' },
  barTrackV: { flex: 1, width: '100%', justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 6 },
  bar: { width: 16, borderRadius: 6 },
  barLabel: { ...typography.small, fontSize: 10, color: colors.textSecondary, height: 16 },

  bmiValue: { fontSize: 40, fontFamily: 'Inter_700Bold', color: colors.primary, marginTop: spacing.sm },
  bmiLabel: { ...typography.caption, color: colors.textSecondary },
  weightSub: { ...typography.caption, color: colors.textSecondary, marginBottom: spacing.sm },

  insightRow: { marginBottom: spacing.sm },
  insightText: { ...typography.caption, color: '#FFFFFF', lineHeight: 20 },

  weightLogRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  weightInput: {
    flex: 1,
    height: 46,
    backgroundColor: '#2C2C2E',
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    ...typography.body,
    color: '#FFFFFF',
  },
  weightLogBtn: {
    height: 46,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 64,
  },
  weightLogBtnDisabled: { opacity: 0.4 },
  weightLogBtnText: { ...typography.bodyBold, color: '#FFFFFF' },
  strengthRow: { marginBottom: spacing.lg },
  strengthRowLast: { marginBottom: 2 },
  strengthTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  strengthName: { ...typography.bodyBold, color: '#FFFFFF' },
  strengthChange: { ...typography.bodyBold, color: ORANGE },
  strengthBarRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  strengthBarWrap: { flex: 1, height: 10, justifyContent: 'center' },
  strengthTrack: { position: 'absolute', left: 0, right: 0, height: 8, borderRadius: 4, backgroundColor: '#2C2C2E' },
  strengthFill: { height: 8, borderRadius: 4 },
  strengthStartMarker: { position: 'absolute', width: 2, height: 14, backgroundColor: '#9FB2C4', marginLeft: -1 },
  strengthCurrent: { ...typography.bodyBold, color: colors.primary, minWidth: 28, textAlign: 'right' },
  strengthBottom: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  strengthMeta: { ...typography.small, color: colors.textSecondary },
  bmiCatPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#2C2C2E',
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
    backgroundColor: '#2C2C2E',
    borderRadius: 12,
    padding: spacing.lg,
    marginTop: spacing.sm,
  },
  emptyText: { ...typography.caption, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
});
