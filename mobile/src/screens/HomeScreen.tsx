import { useCallback, useRef, useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

import KinAvatar from '../components/KinAvatar';
import SendIcon from '../components/SendIcon';
import MicIcon from '../components/MicIcon';
import ChipIcon, { type ChipIconName } from '../components/ChipIcon';
import BundleCard from '../components/BundleCard';
import { FlameIcon, BellIcon, SlidersIcon } from '../components/HeaderIcons';
import HistoryDrawer, { type HistoryItem } from '../components/HistoryDrawer';
import SettingsSheet from '../components/SettingsSheet';
import WorkoutDeck from '../components/WorkoutDeck';
import { apiGet, apiPost } from '../services/api';
import { useUserStore } from '../stores/userStore';
import { colors, spacing, typography } from '../theme';
import type { ExerciseBundle, BundleExercise } from '../../../shared/types';

interface DashboardData {
  greeting: string;
  persona_label: string;
  todays_workout: {
    state: string;
    bundle_id?: string;
    title?: string;
    focus?: string;
    exercise_count?: number;
    estimated_duration_min?: number;
  };
  streak: { current: number; longest: number };
  xp: { total: number; level: number; xp_into_level: number; xp_needed: number };
  badges: Array<{ badge_id: string; name: string; description?: string; earned: boolean; earned_at: string | null }>;
}

const timeGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning,';
  if (h < 18) return 'Good afternoon,';
  return 'Good evening,';
};

const titleize = (s?: string) => (s ? s.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()) : '');

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const user = useUserStore((s) => s.user);

  const [dash, setDash] = useState<DashboardData | null>(null);
  const [recommended, setRecommended] = useState<ExerciseBundle | null>(null);
  const [others, setOthers] = useState<ExerciseBundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [askText, setAskText] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // ── Chat thread (Ask Kin) ──
  type ChatMsg = { id: string; role: 'user' | 'kin'; text: string };
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [kinTyping, setKinTyping] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (messages.length || kinTyping) {
      const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
      return () => clearTimeout(t);
    }
  }, [messages, kinTyping]);

  const sendMessage = useCallback(async () => {
    const text = askText.trim();
    if (!text) return;
    setMessages((prev) => [...prev, { id: `${Date.now()}-u`, role: 'user', text }]);
    setAskText('');
    setKinTyping(true);
    try {
      // General home-screen chat: no session_id, so the backend skips history
      // persistence and just returns Kin's reply.
      const res = await apiPost<{ reply: string; action_intent: string | null }>(
        '/api/companion/message',
        { message: text, input_mode: 'text' }
      );
      setMessages((prev) => [
        ...prev,
        { id: `${Date.now()}-k`, role: 'kin', text: res.reply?.trim() || '…' },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-k`,
          role: 'kin',
          text: "I couldn't reach the coach just now. Please try again in a moment.",
        },
      ]);
    } finally {
      setKinTyping(false);
    }
  }, [askText]);

  // ── In-chat workout session ──
  type WorkoutState = { exercises: BundleExercise[]; index: number; paused: boolean; title: string };
  const [workout, setWorkout] = useState<WorkoutState | null>(null);

  const startWorkout = useCallback(() => {
    const exercises = recommended?.exercises ?? [];
    if (!exercises.length) {
      navigation.navigate('BundleSelection');
      return;
    }
    setMessages((prev) => [
      ...prev,
      { id: `${Date.now()}-u`, role: 'user', text: 'Start workout' },
      { id: `${Date.now()}-k`, role: 'kin', text: "Let's go." },
    ]);
    setWorkout({ exercises, index: 0, paused: false, title: recommended?.title ?? 'Workout' });
  }, [recommended, navigation]);

  // Advance on Done / Skip (same client-side step for now).
  const stepWorkout = useCallback(() => {
    if (!workout) return;
    const last = workout.index >= workout.exercises.length - 1;
    if (last) {
      setWorkout(null);
      setMessages((m) => [
        ...m,
        { id: `${Date.now()}-k`, role: 'kin', text: `🎉 Workout complete! Great job finishing ${workout.title}.` },
      ]);
    } else {
      setWorkout({ ...workout, index: workout.index + 1, paused: false });
    }
  }, [workout]);

  const togglePause = useCallback(() => setWorkout((p) => (p ? { ...p, paused: !p.paused } : p)), []);

  const makeEasier = useCallback(() => {
    setMessages((m) => [
      ...m,
      { id: `${Date.now()}-k`, role: 'kin', text: 'No problem — take it lighter. Drop a few reps or slow the tempo, and keep your form clean.' },
    ]);
  }, []);

  const openHistory = useCallback(async () => {
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const res = await apiGet<{ history: HistoryItem[] }>('/api/progress/history?limit=30');
      setHistory(res.history ?? []);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, active] = await Promise.all([
        apiGet<DashboardData>('/api/dashboard').catch(() => null),
        apiGet<{ bundles: ExerciseBundle[] }>('/api/bundles/active').catch(() => null),
      ]);
      if (d) setDash(d);

      let bundles = active?.bundles ?? [];
      // No active plan yet (e.g. right after onboarding) — generate the 3-4
      // bundles from the backend Rules Engine, one of which is recommended.
      if (bundles.length === 0) {
        const gen = await apiPost<{ bundles: ExerciseBundle[] }>('/api/bundles/generate', {}).catch(() => null);
        bundles = gen?.bundles ?? [];
      }
      if (bundles.length) {
        const rec = bundles.find((b) => b.is_recommended) ?? bundles[0];
        setRecommended(rec);
        setOthers(bundles.filter((b) => b._id !== rec._id));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const name = user?.name && user.name !== 'Guest' ? user.name : 'there';
  const streak = dash?.streak.current ?? user?.gamification?.current_streak ?? 0;
  const level = dash?.xp.level ?? user?.gamification?.level ?? 1;
  const into = dash?.xp.xp_into_level ?? 0;
  const needed = dash?.xp.xp_needed ?? 0;
  const levelTotal = into + needed;
  const pct = levelTotal > 0 ? Math.round((into / levelTotal) * 100) : 0;

  const latestBadge = (dash?.badges ?? [])
    .filter((b) => b.earned)
    .sort((a, b) => (b.earned_at || '').localeCompare(a.earned_at || ''))[0];

  const openBundles = () => navigation.navigate('BundleSelection');
  const openRecommended = () =>
    recommended ? navigation.navigate('BundleDetail', { bundle: recommended }) : openBundles();

  return (
    <View style={styles.container}>
      <ScrollView ref={scrollRef} style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* ── Header ── */}
        <LinearGradient
          colors={['#2D6CA8', '#1E4E7E']}
          style={[styles.header, { paddingTop: Math.max(insets.top, 24) + spacing.md }]}
        >
          <View style={styles.headerTop}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Workout history"
              onPress={openHistory}
              style={styles.menuBtn}
            >
              <View style={styles.menuLine} />
              <View style={styles.menuLine} />
              <View style={styles.menuLine} />
            </Pressable>
            <KinAvatar size={52} />
            <View style={styles.greetingBlock}>
              <Text style={styles.greetingSmall}>{timeGreeting()}</Text>
              <Text style={styles.name}>{name}</Text>
              <Text style={styles.greetingSub} numberOfLines={1}>
                {dash?.persona_label ?? 'Ready when you are.'}
              </Text>
            </View>
            <View style={styles.headerActions}>
              <View style={styles.streakPill}>
                <FlameIcon size={15} />
                <Text style={styles.streakText}>{streak}</Text>
              </View>
              <Pressable style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Notifications">
                <BellIcon size={19} />
                <View style={styles.iconBadge} />
              </Pressable>
              <Pressable style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Settings" onPress={() => setSettingsOpen(true)}>
                <SlidersIcon size={19} />
              </Pressable>
            </View>
          </View>

          {/* XP bar */}
          <View style={styles.xpRow}>
            <View style={styles.levelPill}>
              <Text style={styles.levelText}>Lv.{level}</Text>
            </View>
            <Text style={styles.xpText}>
              {into.toLocaleString()} / {levelTotal.toLocaleString()} XP
            </Text>
            <Text style={styles.xpToNext}>{needed} to next level</Text>
          </View>
          <View style={styles.xpBar}>
            <View style={[styles.xpFill, { width: `${pct}%` }]} />
          </View>

          {/* Workout controls — replace the idle header during a session */}
          {workout && (
            <View style={styles.workoutControls}>
              <WorkoutChip label="Skip Exercise" onPress={stepWorkout} />
              <WorkoutChip label="Make Easier" onPress={makeEasier} />
              <WorkoutChip label={workout.paused ? 'Resume' : 'Pause Workout'} onPress={togglePause} />
            </View>
          )}
        </LinearGradient>

        {loading && !dash ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
        ) : (
          <View style={styles.body}>
            {/* Today's recommendation */}
            <LinearGradient colors={['#3A7CA8', '#2D6CA8']} style={styles.recCard}>
              <View style={styles.recBadge}>
                <Text style={styles.recBadgeText}>TODAY'S RECOMMENDATION</Text>
              </View>
              <Text style={styles.recTitle}>{recommended?.title ?? dash?.todays_workout?.title ?? 'Your Workout'}</Text>
              <Text style={styles.recSub}>{titleize(recommended?.focus ?? dash?.todays_workout?.focus) || 'Full Body'}</Text>
              <View style={styles.recMetaRow}>
                <View style={styles.recMetaChip}>
                  <Text style={styles.recMetaText}>⏱ {recommended?.estimated_duration_min ?? dash?.todays_workout?.estimated_duration_min ?? 30} min</Text>
                </View>
                {!!recommended?.estimated_calorie_burn && (
                  <View style={styles.recMetaChip}>
                    <Text style={styles.recMetaText}>🔥 {recommended.estimated_calorie_burn.high} cal</Text>
                  </View>
                )}
                <View style={styles.recMetaChip}>
                  <Text style={styles.recMetaText}>🏋 {recommended?.exercises?.length ?? dash?.todays_workout?.exercise_count ?? 0} exercises</Text>
                </View>
              </View>
            </LinearGradient>

            <View style={styles.recActions}>
              <Pressable style={styles.startWrap} onPress={openRecommended}>
                <LinearGradient colors={['#FFA24D', '#F5821F']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.startBtn}>
                  <Text style={styles.startText}>▶  Start Now</Text>
                </LinearGradient>
              </Pressable>
              <Pressable style={styles.detailsBtn} onPress={openRecommended}>
                <Text style={styles.detailsText}>Details</Text>
              </Pressable>
            </View>

            {/* Achievement */}
            {latestBadge && (
              <View style={styles.achCard}>
                <View style={styles.achIcon}>
                  <Text style={{ fontSize: 22 }}>🏆</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.achOverline}>ACHIEVEMENT UNLOCKED</Text>
                  <Text style={styles.achTitle}>{latestBadge.name}</Text>
                  {!!latestBadge.description && <Text style={styles.achSub}>{latestBadge.description}</Text>}
                </View>
              </View>
            )}

            {/* Other plans — the non-recommended bundles, choosable from Home */}
            {others.length > 0 && (
              <>
                <Text style={styles.moreTitle}>More plans for today</Text>
                {others.map((bundle) => (
                  <BundleCard
                    key={bundle._id}
                    bundle={bundle}
                    onPress={() => navigation.navigate('BundleDetail', { bundle })}
                  />
                ))}
              </>
            )}

            {/* Chat thread with Kin */}
            {(messages.length > 0 || kinTyping || workout) && (
              <View style={styles.chatThread}>
                {messages.map((m) =>
                  m.role === 'user' ? (
                    <View key={m.id} style={styles.userMsgRow}>
                      <View style={styles.userBubble}>
                        <Text style={styles.userBubbleText}>{m.text}</Text>
                      </View>
                    </View>
                  ) : (
                    <View key={m.id} style={styles.kinMsgRow}>
                      <KinAvatar size={36} />
                      <View style={styles.kinBubble}>
                        <Text style={styles.kinBubbleText}>{m.text}</Text>
                      </View>
                    </View>
                  )
                )}
                {kinTyping && (
                  <View style={styles.kinMsgRow}>
                    <KinAvatar size={36} />
                    <View style={styles.kinBubble}>
                      <View style={styles.typingRow}>
                        <ActivityIndicator size="small" color={colors.primary} />
                        <Text style={styles.typingText}>Kin is thinking…</Text>
                      </View>
                    </View>
                  </View>
                )}
                {workout && !workout.paused && (
                  <WorkoutDeck
                    exercise={workout.exercises[workout.index]}
                    index={workout.index}
                    total={workout.exercises.length}
                    paused={workout.paused}
                    onDone={stepWorkout}
                    onSkip={stepWorkout}
                    onPause={togglePause}
                  />
                )}
                {workout && workout.paused && (
                  <View style={styles.pausedCard}>
                    <Text style={styles.pausedText}>Workout paused</Text>
                    <Pressable onPress={togglePause} style={styles.resumeBtn}>
                      <Text style={styles.resumeText}>Resume</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Quick actions — chat trigger chips, just above the Ask Kin bar */}
      {!workout && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.quickRow}
        >
          <QuickChip icon="workout" label="Start Workout" onPress={startWorkout} />
          <QuickChip icon="progress" label="Show Progress" onPress={() => navigation.navigate('Progress' as never)} />
          <QuickChip icon="plan" label="Weekly Plan" onPress={openBundles} />
          <QuickChip icon="history" label="Workout History" onPress={openHistory} />
          <QuickChip icon="badges" label="My Badges" onPress={() => navigation.navigate('Progress' as never)} />
          <QuickChip icon="recovery" label="Recovery" onPress={() => setAskText('How should I recover today?')} />
          <QuickChip icon="motivation" label="Motivation" onPress={() => setAskText('Give me some motivation!')} />
        </ScrollView>
      )}

      {/* Ask Kin bar */}
      <View style={styles.askBar}>
        <View style={styles.askRow}>
          <TextInput
            style={styles.askInput}
            placeholder="Ask Kin anything…"
            placeholderTextColor={colors.textLight}
            value={askText}
            onChangeText={setAskText}
            onSubmitEditing={sendMessage}
            returnKeyType="send"
          />
          <Pressable style={styles.micBtn} accessibilityRole="button" accessibilityLabel="Voice input">
            <MicIcon size={20} color={colors.primary} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send"
            disabled={!askText.trim()}
            style={[styles.askSend, !askText.trim() && styles.askSendDisabled]}
            onPress={sendMessage}
          >
            <SendIcon size={32} />
          </Pressable>
        </View>
      </View>

      <HistoryDrawer
        visible={historyOpen}
        onClose={() => setHistoryOpen(false)}
        history={history}
        loading={historyLoading}
        userName={user?.name && user.name !== 'Guest' ? user.name : 'You'}
        level={level}
        streak={streak}
        onNewSession={() => {
          setHistoryOpen(false);
          openBundles();
        }}
      />

      <SettingsSheet visible={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </View>
  );
}

function QuickChip({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: ChipIconName;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.quickChipWrap, pressed && { opacity: 0.65 }]}>
      <BlurView intensity={32} tint="light" style={styles.quickChip}>
        <ChipIcon name={icon} size={16} color={colors.primary} />
        <Text style={styles.quickChipText} numberOfLines={1}>
          {label}
        </Text>
      </BlurView>
    </Pressable>
  );
}

function WorkoutChip({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.workoutChip, pressed && { opacity: 0.7 }]}>
      <Text style={styles.workoutChipText} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollView: { flex: 1 },
  scroll: { paddingBottom: spacing.xl },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerTop: { flexDirection: 'row', alignItems: 'center' },
  menuBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
    gap: 3,
  },
  menuLine: {
    width: 16,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#FFFFFF',
  },
  greetingBlock: { flex: 1, marginLeft: spacing.md },
  greetingSmall: { ...typography.caption, color: 'rgba(255,255,255,0.8)' },
  name: { ...typography.h2, color: '#FFFFFF' },
  greetingSub: { ...typography.caption, color: 'rgba(255,255,255,0.75)' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
  },
  streakText: { ...typography.bodyBold, color: '#FFFFFF' },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBadge: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF5A4D',
  },
  xpRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.lg },
  levelPill: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginRight: spacing.sm,
  },
  levelText: { ...typography.small, color: '#FFD54A', fontFamily: 'Inter_700Bold' },
  xpText: { ...typography.caption, color: '#FFFFFF', flex: 1 },
  xpToNext: { ...typography.small, color: 'rgba(255,255,255,0.75)' },
  xpBar: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 3,
    marginTop: spacing.sm,
    overflow: 'hidden',
  },
  xpFill: { height: '100%', backgroundColor: '#FFD54A', borderRadius: 3 },
  workoutControls: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg },
  workoutChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    borderRadius: 18,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  workoutChipText: { ...typography.caption, color: '#FFFFFF', fontFamily: 'Inter_600SemiBold' },
  quickRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: spacing.lg,
    paddingTop: 22,
    paddingBottom: 14,
    alignItems: 'center',
  },
  quickChipWrap: {
    height: 40,
    borderRadius: 20,
    shadowColor: '#1E4E7E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  quickChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    height: 40,
    paddingHorizontal: spacing.md,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.65)',
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  quickChipText: { ...typography.caption, color: colors.primary, fontFamily: 'Inter_600SemiBold' },
  body: { paddingHorizontal: spacing.lg, marginTop: spacing.lg },
  recCard: { borderRadius: 18, padding: spacing.lg, overflow: 'hidden' },
  recBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#F5821F',
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    marginBottom: spacing.sm,
  },
  recBadgeText: { ...typography.small, color: '#FFFFFF', fontFamily: 'Inter_700Bold', letterSpacing: 0.5 },
  recTitle: { ...typography.h2, color: '#FFFFFF' },
  recSub: { ...typography.caption, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  recMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  recMetaChip: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  recMetaText: { ...typography.small, color: '#FFFFFF' },
  recActions: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: spacing.md,
    marginTop: -spacing.md,
    marginHorizontal: spacing.xs,
    gap: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  startWrap: { flex: 1, borderRadius: 14, overflow: 'hidden' },
  startBtn: { height: 48, alignItems: 'center', justifyContent: 'center' },
  startText: { ...typography.bodyBold, color: '#FFFFFF' },
  detailsBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  detailsText: { ...typography.bodyBold, color: colors.text },
  moreTitle: {
    ...typography.h3,
    color: colors.text,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  chatThread: { marginTop: spacing.xl, gap: spacing.md },
  userMsgRow: { alignItems: 'flex-end' },
  userBubble: {
    maxWidth: '82%',
    backgroundColor: colors.userBubble,
    borderRadius: 18,
    borderBottomRightRadius: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  userBubbleText: { ...typography.body, color: '#FFFFFF' },
  kinMsgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, maxWidth: '92%' },
  kinBubble: {
    flexShrink: 1,
    backgroundColor: colors.companionBubble,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    shadowColor: '#1E4E7E',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  kinBubbleText: { ...typography.body, color: colors.text },
  pausedCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: spacing.lg,
    marginTop: spacing.md,
    alignItems: 'center',
    gap: spacing.md,
    shadowColor: '#1E4E7E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  pausedText: { ...typography.bodyBold, color: colors.textSecondary },
  resumeBtn: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
  resumeText: { ...typography.bodyBold, color: '#FFFFFF' },
  typingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  typingText: { ...typography.body, color: colors.textSecondary, fontStyle: 'italic' },
  achCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FCF3E3',
    borderRadius: 16,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  achIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#FBE6BE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  achOverline: { ...typography.small, color: '#E8772E', fontFamily: 'Inter_700Bold', letterSpacing: 0.5 },
  achTitle: { ...typography.bodyBold, color: colors.text },
  achSub: { ...typography.small, color: colors.textSecondary, marginTop: 2 },
  askBar: {
    paddingHorizontal: spacing.lg,
    paddingTop: 12,
    paddingBottom: 14,
    backgroundColor: colors.background,
  },
  askRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 24,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  askInput: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    paddingVertical: spacing.sm,
  },
  micBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.xs,
  },
  askSend: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  askSendDisabled: {
    opacity: 0.35,
  },
});
