import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Line, Path, Polyline, Rect } from 'react-native-svg';

import KinAvatar from '../components/KinAvatar';
import { apiGet, apiPut } from '../services/api';
import { signOutCurrentUser } from '../services/auth';
import { useUserStore } from '../stores/userStore';
import { colors, spacing, typography } from '../theme';

const NAVY = '#16365A';
const ORANGE = '#F5821F';

/* ───────────────── Icons ───────────────── */
type Glyph =
  | 'sparkle' | 'chat' | 'mic' | 'flame' | 'heart' | 'bolt' | 'leaf' | 'waves'
  | 'target' | 'dumbbell' | 'bell' | 'shield' | 'person' | 'chevron' | 'signout'
  | 'check' | 'pencil';

function Icon({ name, size = 20, color = colors.primary }: { name: Glyph; size?: number; color?: string }) {
  const s = { stroke: color, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  switch (name) {
    case 'sparkle':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M12 3l1.8 4.7L18.5 9.5 13.8 11.3 12 16l-1.8-4.7L5.5 9.5l4.7-1.8z" {...s} />
          <Path d="M18 14l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" {...s} />
        </Svg>
      );
    case 'chat':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M4 5h16v11H9l-4 3v-3H4z" {...s} />
        </Svg>
      );
    case 'mic':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Rect x={9} y={3} width={6} height={11} rx={3} {...s} />
          <Path d="M5 11a7 7 0 0 0 14 0" {...s} />
          <Line x1={12} y1={18} x2={12} y2={21} {...s} />
        </Svg>
      );
    case 'flame':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M12 3c2 3 4.5 4.8 4.5 8.5a4.5 4.5 0 0 1-9 0c0-1.6.8-2.8 1.6-3.6 0 1.2.9 2 1.9 2-1-2.4.2-5 0-6.9z" {...s} />
        </Svg>
      );
    case 'heart':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M12 20s-7-4.3-7-9.2A3.8 3.8 0 0 1 12 7a3.8 3.8 0 0 1 7 3.8C19 15.7 12 20 12 20z" {...s} />
        </Svg>
      );
    case 'bolt':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M13 3L5 13h6l-1 8 8-10h-6z" {...s} />
        </Svg>
      );
    case 'leaf':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M5 19C5 11 11 5 19 5C19 13 13 19 5 19Z" {...s} />
          <Path d="M5 19L15 9" {...s} />
        </Svg>
      );
    case 'waves':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M3 9c3-3 6 3 9 0s6-3 9 0" {...s} />
          <Path d="M3 15c3-3 6 3 9 0s6-3 9 0" {...s} />
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
    case 'shield':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" {...s} />
        </Svg>
      );
    case 'person':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Circle cx={12} cy={8} r={4} {...s} />
          <Path d="M4 20c0-4 4-6 8-6s8 2 8 6" {...s} />
        </Svg>
      );
    case 'chevron':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Polyline points="9 6 15 12 9 18" {...s} />
        </Svg>
      );
    case 'signout':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M15 4h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-3" {...s} />
          <Polyline points="10 8 14 12 10 16" {...s} />
          <Line x1={14} y1={12} x2={4} y2={12} {...s} />
        </Svg>
      );
    case 'check':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M5 12l4 4 10-10" {...s} strokeWidth={2.5} />
        </Svg>
      );
    case 'pencil':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path d="M4 20l4-1 10-10-3-3L5 16z" stroke="#FFFFFF" strokeWidth={2} strokeLinejoin="round" fill="none" />
        </Svg>
      );
    default:
      return null;
  }
}

/* ───────────────── Data ───────────────── */
const TALK_LEVELS = ['Silent', 'Quiet', 'Balanced', 'Chatty', 'Very Chatty'];
const TALK_DESC = [
  'Kin stays quiet unless you ask',
  'Kin checks in occasionally',
  'Kin gives balanced guidance',
  'Kin will cheer and coach throughout',
  'Kin talks you through everything',
];
const VOICES: Array<{ key: string; label: string; sub: string; icon: Glyph }> = [
  { key: 'calm', label: 'Calm', sub: 'Soft & soothing', icon: 'waves' },
  { key: 'energetic', label: 'Energetic', sub: 'High-energy hype', icon: 'bolt' },
  { key: 'friendly', label: 'Friendly', sub: 'Warm & casual', icon: 'heart' },
  { key: 'professional', label: 'Professional', sub: 'Focused & precise', icon: 'target' },
];
const PERSONAS: Array<{ key: string; label: string; sub: string; icon: Glyph }> = [
  { key: 'motivational', label: 'Motivational Coach', sub: 'Pushes you harder every session', icon: 'flame' },
  { key: 'friendly', label: 'Friendly Buddy', sub: 'Supportive and fun companion', icon: 'heart' },
  { key: 'strict', label: 'Strict Trainer', sub: 'Discipline-first, results-driven', icon: 'bolt' },
  { key: 'zen', label: 'Zen Guide', sub: 'Mindful, calm, balanced approach', icon: 'leaf' },
];
const PREVIEW: Record<string, (name: string) => string> = {
  motivational: (n) => `Let's go, ${n}. Every rep counts. You're building something real — don't stop now.`,
  friendly: (n) => `Hey ${n}! So good to see you. Let's have some fun and get a solid session in today.`,
  strict: (n) => `No excuses, ${n}. We have work to do. Lock in and let's execute the plan.`,
  zen: (n) => `Breathe, ${n}. Move with intention today. Progress is built one mindful rep at a time.`,
};

const GOAL_LABELS: Record<string, string> = {
  strength: 'Strength',
  hypertrophy: 'Hypertrophy',
  mobility: 'Mobility',
  general_fitness: 'General Fitness',
  weight_loss: 'Weight Loss',
  home_workout: 'Home Workout',
};
const ACTIVITY_TO_LEVEL: Record<string, string> = {
  sedentary: 'Beginner',
  lightly_active: 'Beginner',
  moderately_active: 'Intermediate',
  very_active: 'Advanced',
};

const titleize = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const user = useUserStore((st) => st.user);
  const setUser = useUserStore((st) => st.setUser);

  const [workouts, setWorkouts] = useState(0);
  const [personalityOpen, setPersonalityOpen] = useState(true);
  const [talkIndex, setTalkIndex] = useState(3);
  const [voice, setVoice] = useState('energetic');
  const [persona, setPersona] = useState('motivational');
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    apiGet<{ history: unknown[] }>('/api/progress/history?limit=999')
      .then((r) => setWorkouts(r.history?.length ?? 0))
      .catch(() => setWorkouts(0));
  }, []);

  // Seed AI settings from the stored profile once.
  useEffect(() => {
    const t = user?.companion_preferences?.talkativeness;
    if (t === 'minimal') setTalkIndex(1);
    else if (t === 'high') setTalkIndex(3);
    else if (t === 'balanced') setTalkIndex(2);
    if (user?.companion_preferences?.voice_id) setVoice(user.companion_preferences.voice_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id]);

  const name = user?.name && user.name !== 'Guest' ? user.name : 'Athlete';
  const email = user?.email || 'guest@kineticage.app';
  const level = user?.gamification?.level ?? 1;
  const streak = user?.gamification?.current_streak ?? 0;
  const badges = user?.gamification?.badges?.length ?? 0;
  const bmi = user?.calculated_metrics?.bmi;
  const bmiCat = user?.calculated_metrics?.bmi_category;
  const goalLabel = user?.fitness_goal ? GOAL_LABELS[user.fitness_goal] : '—';
  const fitnessLevel = user?.activity_level ? ACTIVITY_TO_LEVEL[user.activity_level] : '—';
  const equipmentLabel =
    user?.equipment?.length
      ? user.equipment.map((e) => (e === 'none' ? 'No equipment' : titleize(e))).join(', ')
      : 'No equipment';

  const handleSave = useCallback(async () => {
    setSaving(true);
    const talkativeness = talkIndex <= 1 ? 'minimal' : talkIndex === 2 ? 'balanced' : 'high';
    try {
      const updated = await apiPut<typeof user>('/api/profile', {
        companion_preferences: {
          ...(user?.companion_preferences ?? {}),
          voice_id: voice,
          talkativeness,
        },
      } as any);
      if (updated) setUser(updated as any);
    } catch {
      // Non-blocking — keep local selection even if the save fails.
    } finally {
      setSaving(false);
    }
  }, [talkIndex, voice, user, setUser]);

  const handleSignOut = useCallback(async () => {
    setSigningOut(true);
    try {
      await signOutCurrentUser();
    } finally {
      setSigningOut(false);
    }
  }, []);

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator contentContainerStyle={styles.scroll}>
        {/* ── Header ── */}
        <LinearGradient
          colors={['#2D6CA8', '#1E4E7E']}
          style={[styles.header, { paddingTop: Math.max(insets.top, 24) + spacing.md }]}
        >
          <View style={styles.headerTop}>
            <View>
              <KinAvatar size={84} />
              <View style={styles.editBadge}>
                <Icon name="pencil" size={13} />
              </View>
            </View>
            <View style={styles.headerInfo}>
              <Text style={styles.name}>{name}</Text>
              <Text style={styles.email}>{email}</Text>
              <View style={styles.levelPill}>
                <Text style={styles.levelPillText}>Level {level} Achiever</Text>
              </View>
            </View>
          </View>

          <View style={styles.statsRow}>
            <Stat value={workouts} label="Workouts" />
            <Stat value={streak} label="Streak" />
            <Stat value={level} label="Level" />
            <Stat value={badges} label="Badges" />
          </View>
        </LinearGradient>

        <View style={styles.body}>
          {/* ── Kin AI Personality (collapsible) ── */}
          <Pressable style={styles.collapseHead} onPress={() => setPersonalityOpen((v) => !v)}>
            <Icon name="sparkle" size={18} color={ORANGE} />
            <Text style={styles.collapseTitle}>KIN AI PERSONALITY</Text>
            <View style={{ transform: [{ rotate: personalityOpen ? '-90deg' : '90deg' }] }}>
              <Icon name="chevron" size={18} color={colors.textSecondary} />
            </View>
          </Pressable>

          {personalityOpen && (
            <>
              {/* Talkativeness */}
              <View style={styles.card}>
                <View style={styles.cardTitleRow}>
                  <Icon name="chat" size={18} />
                  <Text style={styles.cardTitle}>Talkativeness</Text>
                </View>
                <Text style={styles.cardSub}>How much Kin communicates during workouts</Text>
                <View style={styles.talkBarWrap}>
                  <LinearGradient
                    colors={['#5BB7E8', ORANGE]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.talkBar, { width: `${(talkIndex / 4) * 100}%` }]}
                  />
                  <View style={styles.talkBarTrack} />
                </View>
                <View style={styles.talkLabels}>
                  {TALK_LEVELS.map((l, i) => (
                    <Pressable key={l} style={styles.talkLabelBtn} onPress={() => setTalkIndex(i)}>
                      <Text style={[styles.talkLabel, i === talkIndex && styles.talkLabelActive]}>{l}</Text>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.talkDescPill}>
                  <Text style={styles.talkDescText}>{TALK_DESC[talkIndex]}</Text>
                </View>
              </View>

              {/* Voice Style */}
              <View style={styles.card}>
                <View style={styles.cardTitleRow}>
                  <Icon name="mic" size={18} />
                  <Text style={styles.cardTitle}>Voice Style</Text>
                </View>
                <Text style={styles.cardSub}>Choose how Kin sounds</Text>
                <View style={styles.voiceGrid}>
                  {VOICES.map((v) => {
                    const sel = voice === v.key;
                    return (
                      <Pressable key={v.key} style={[styles.voiceCard, sel && styles.voiceCardSel]} onPress={() => setVoice(v.key)}>
                        <View style={[styles.voiceIcon, sel && styles.voiceIconSel]}>
                          <Icon name={v.icon} size={18} color={sel ? ORANGE : colors.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.voiceLabel}>{v.label}</Text>
                          <Text style={styles.voiceSub}>{v.sub}</Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </>
          )}

          {/* ── Personality ── */}
          <View style={styles.sectionHead}>
            <Icon name="sparkle" size={18} />
            <Text style={styles.sectionTitle}>Personality</Text>
          </View>
          <Text style={styles.sectionSub}>How Kin approaches your fitness journey</Text>
          {PERSONAS.map((p) => {
            const sel = persona === p.key;
            return (
              <Pressable key={p.key} style={[styles.persona, sel && styles.personaSel]} onPress={() => setPersona(p.key)}>
                <View style={[styles.personaIcon, sel && styles.personaIconSel]}>
                  <Icon name={p.icon} size={18} color={sel ? '#FFFFFF' : ORANGE} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.personaLabel, sel && styles.personaLabelSel]}>{p.label}</Text>
                  <Text style={[styles.personaSub, sel && styles.personaSubSel]}>{p.sub}</Text>
                </View>
                {sel && (
                  <View style={styles.personaCheck}>
                    <Icon name="check" size={14} color="#FFFFFF" />
                  </View>
                )}
              </Pressable>
            );
          })}

          {/* Kin preview */}
          <View style={styles.previewCard}>
            <KinAvatar size={40} />
            <View style={{ flex: 1 }}>
              <Text style={styles.previewLabel}>KIN PREVIEW</Text>
              <Text style={styles.previewQuote}>"{PREVIEW[persona](name)}"</Text>
            </View>
          </View>

          {/* Save */}
          <Pressable onPress={handleSave} disabled={saving} style={styles.saveWrap}>
            <LinearGradient colors={['#FFA24D', ORANGE]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.saveBtn}>
              {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveText}>Save AI Settings</Text>}
            </LinearGradient>
          </Pressable>

          {/* Fitness profile */}
          <Text style={styles.overline}>FITNESS PROFILE</Text>
          <View style={styles.card}>
            <View style={styles.fitnessGrid}>
              <Field label="Age" value={user?.age ? `${user.age} years` : '—'} />
              <Field label="Weight" value={user?.weight_kg ? `${user.weight_kg} kg` : '—'} />
              <Field label="Height" value={user?.height_cm ? `${user.height_cm} cm` : '—'} />
              <Field label="BMI" value={bmi ? `${bmi.toFixed(1)} — ${bmiCat ? titleize(bmiCat) : ''}` : '—'} />
              <Field label="Fitness Level" value={fitnessLevel} />
              <Field label="Primary Goal" value={goalLabel} />
            </View>
          </View>

          {/* Personal */}
          <Text style={styles.overline}>PERSONAL</Text>
          <View style={styles.card}>
            <Row icon="person" title="Edit Profile" sub="Name, age, height, weight" />
            <Divider />
            <Row icon="target" title="Fitness Goals" sub={`${goalLabel} · ${fitnessLevel}`} />
            <Divider />
            <Row icon="dumbbell" title="Equipment" sub={equipmentLabel} last />
          </View>

          {/* Preferences */}
          <Text style={styles.overline}>PREFERENCES</Text>
          <View style={styles.card}>
            <Row icon="bell" title="Notifications" sub="Daily reminders at 6:00 AM" />
            <Divider />
            <Row icon="shield" title="Privacy" sub="Data usage settings" last />
          </View>

          {/* Current plan */}
          <Text style={styles.overline}>CURRENT PLAN</Text>
          <View style={styles.card}>
            <View style={styles.planRow}>
              <View style={styles.planIcon}>
                <Icon name="target" size={20} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.planTitle}>Personalised 4-Week Plan</Text>
                <Text style={styles.planSub}>Week 3 of 4 · 5 days / week</Text>
              </View>
            </View>
            <View style={styles.planBarTrack}>
              <LinearGradient colors={['#5BB7E8', ORANGE]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.planBarFill, { width: '68%' }]} />
            </View>
            <Text style={styles.planPct}>68% complete</Text>
          </View>

          {/* Sign out */}
          <Pressable onPress={handleSignOut} disabled={signingOut} style={styles.signOut}>
            {signingOut ? (
              <ActivityIndicator color={colors.error} />
            ) : (
              <>
                <Icon name="signout" size={20} color={colors.error} />
                <Text style={styles.signOutText}>Sign Out</Text>
              </>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}

function Row({ icon, title, sub, last }: { icon: Glyph; title: string; sub: string; last?: boolean }) {
  return (
    <Pressable style={styles.row}>
      <View style={styles.rowIcon}>
        <Icon name={icon} size={18} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSub}>{sub}</Text>
      </View>
      <Icon name="chevron" size={18} color={colors.textLight} />
    </Pressable>
  );
}

function Divider() {
  return <View style={styles.rowDivider} />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingBottom: spacing.xl },

  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  editBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#2D6CA8',
  },
  headerInfo: { flex: 1 },
  name: { ...typography.h1, fontSize: 24, color: '#FFFFFF' },
  email: { ...typography.caption, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  levelPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(245,130,31,0.85)',
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    marginTop: spacing.sm,
  },
  levelPillText: { ...typography.small, color: '#FFFFFF', fontFamily: 'Inter_700Bold' },

  statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xl },
  stat: { alignItems: 'center', flex: 1 },
  statValue: { ...typography.h2, color: '#FFFFFF' },
  statLabel: { ...typography.small, color: 'rgba(255,255,255,0.75)', marginTop: 2 },

  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },

  collapseHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.md },
  collapseTitle: { ...typography.bodyBold, color: NAVY, flex: 1, letterSpacing: 0.5, fontFamily: 'Inter_700Bold' },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: spacing.md,
    marginBottom: spacing.md,
    shadowColor: '#1E4E7E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { ...typography.h3, fontSize: 17, color: NAVY, fontFamily: 'Inter_700Bold' },
  cardSub: { ...typography.caption, color: colors.textSecondary, marginTop: 4, marginBottom: spacing.md },

  talkBarWrap: { height: 8, justifyContent: 'center', marginTop: spacing.xs },
  talkBarTrack: { position: 'absolute', left: 0, right: 0, height: 8, borderRadius: 4, backgroundColor: '#E2E8F0', zIndex: -1 },
  talkBar: { height: 8, borderRadius: 4 },
  talkLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
  talkLabelBtn: { flex: 1, alignItems: 'center' },
  talkLabel: { ...typography.small, fontSize: 11, color: colors.textLight },
  talkLabelActive: { color: ORANGE, fontFamily: 'Inter_700Bold' },
  talkDescPill: {
    backgroundColor: '#FCEBDD',
    borderRadius: 12,
    paddingVertical: spacing.sm,
    marginTop: spacing.md,
    alignItems: 'center',
  },
  talkDescText: { ...typography.caption, color: ORANGE, fontFamily: 'Inter_600SemiBold' },

  voiceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  voiceCard: {
    width: '47.5%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: '#F4F7FB',
    borderRadius: 14,
    padding: spacing.sm,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  voiceCardSel: { borderColor: ORANGE, backgroundColor: '#FFF6EE' },
  voiceIcon: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: '#E8F0F8',
    alignItems: 'center', justifyContent: 'center',
  },
  voiceIconSel: { backgroundColor: '#FCEBDD' },
  voiceLabel: { ...typography.bodyBold, fontSize: 14, color: NAVY },
  voiceSub: { ...typography.small, fontSize: 11, color: colors.textSecondary },

  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.sm },
  sectionTitle: { ...typography.h3, fontSize: 18, color: NAVY, fontFamily: 'Inter_700Bold' },
  sectionSub: { ...typography.caption, color: colors.textSecondary, marginTop: 2, marginBottom: spacing.md },

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
  personaIcon: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#FFF6EE',
    alignItems: 'center', justifyContent: 'center',
  },
  personaIconSel: { backgroundColor: 'rgba(255,255,255,0.15)' },
  personaLabel: { ...typography.bodyBold, color: NAVY },
  personaLabelSel: { color: '#FFFFFF' },
  personaSub: { ...typography.small, color: colors.textSecondary, marginTop: 2 },
  personaSubSel: { color: 'rgba(255,255,255,0.7)' },
  personaCheck: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },

  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: '#EAF3FB',
    borderRadius: 16,
    padding: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  previewLabel: { ...typography.small, color: colors.primary, fontFamily: 'Inter_700Bold', letterSpacing: 0.5 },
  previewQuote: { ...typography.body, fontSize: 15, color: NAVY, marginTop: 4, fontStyle: 'italic' },

  saveWrap: { borderRadius: 16, overflow: 'hidden', marginBottom: spacing.lg },
  saveBtn: { height: 54, alignItems: 'center', justifyContent: 'center' },
  saveText: { ...typography.bodyBold, color: '#FFFFFF', fontSize: 17 },

  overline: { ...typography.small, color: colors.textSecondary, fontFamily: 'Inter_700Bold', letterSpacing: 1, marginBottom: spacing.sm, marginTop: spacing.xs },

  fitnessGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  field: { width: '50%', paddingVertical: spacing.sm },
  fieldLabel: { ...typography.small, color: colors.textSecondary },
  fieldValue: { ...typography.bodyBold, color: NAVY, marginTop: 2 },

  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  rowIcon: {
    width: 38, height: 38, borderRadius: 12, backgroundColor: '#EAF2FB',
    alignItems: 'center', justifyContent: 'center',
  },
  rowTitle: { ...typography.bodyBold, color: NAVY },
  rowSub: { ...typography.small, color: colors.textSecondary, marginTop: 2 },
  rowDivider: { height: StyleSheet.hairlineWidth, backgroundColor: '#E2E8F0', marginLeft: 50 },

  planRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  planIcon: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: '#EAF2FB',
    alignItems: 'center', justifyContent: 'center',
  },
  planTitle: { ...typography.bodyBold, color: NAVY },
  planSub: { ...typography.small, color: colors.textSecondary, marginTop: 2 },
  planBarTrack: { height: 8, borderRadius: 4, backgroundColor: '#E2E8F0', overflow: 'hidden' },
  planBarFill: { height: '100%', borderRadius: 4 },
  planPct: { ...typography.small, color: colors.textSecondary, marginTop: spacing.sm },

  signOut: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: '#FCE9E9',
    borderRadius: 16,
    height: 54,
    marginTop: spacing.sm,
  },
  signOutText: { ...typography.bodyBold, color: colors.error, fontSize: 16 },
});
