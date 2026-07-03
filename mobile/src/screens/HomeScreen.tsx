import { useCallback, useRef, useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Platform,
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
import DailyCheckinCard from '../components/DailyCheckinCard';
import {
  useAudioRecorder,
  createAudioPlayer,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  RecordingPresets,
  type AudioPlayer,
} from 'expo-audio';
import { apiGet, apiPost, apiPut, apiUploadAudio, apiFetchSpeech, WS_BASE_URL } from '../services/api';
import { WebVoiceLive, type VoiceLivePhase } from '../services/webVoiceLive';
import { getFreshToken } from '../services/auth';
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
  // An in-progress session found on load, offered for resume (D2).
  const [resumeInfo, setResumeInfo] = useState<{ sessionId: string; bundleId: string; index: number } | null>(null);

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

  // ── Voice input ──
  // Native uses press-to-talk (expo-audio). Web uses a continuous, hands-free
  // real-time voice-to-voice conversation via the Gemini Live proxy
  // (see webVoiceLive.ts) — Kin listens and speaks aloud, no typing needed.
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const playerRef = useRef<AudioPlayer | null>(null);

  // Continuous voice mode (web): tap the mic to enter/exit; it listens, replies
  // aloud, then auto-listens again until you tap the mic to turn it off.
  const [voiceMode, setVoiceMode] = useState(false);
  const [voicePhase, setVoicePhase] = useState<VoiceLivePhase>('idle');
  const voiceLoopRef = useRef<WebVoiceLive | null>(null);
  // Tracks the active workout's session id so voice mode can ground the AI in
  // the live session (set below, once the workout state exists).
  const activeSessionIdRef = useRef<string | null>(null);
  // Refs that let the (stable) voice-command handler read fresh state and
  // call the latest workout handlers without stale closures.
  const workoutRef = useRef<any>(null);
  const voiceModeRef = useRef(false);
  const voiceActionsRef = useRef<any>(null);
  const lastVoiceCmdRef = useRef(0);

  // Play Kin's reply aloud via the backend TTS endpoint. Best-effort: if the
  // audio can't be fetched or played, we silently keep the on-screen text.
  const speak = useCallback(async (text: string) => {
    try {
      const voiceStyle = (user?.companion_preferences as any)?.voice_style || undefined;
      const dataUri = await apiFetchSpeech(text, voiceStyle);
      if (!dataUri) return;
      playerRef.current?.remove();
      const player = createAudioPlayer(dataUri);
      playerRef.current = player;
      player.play();
    } catch {
      // Ignore playback failures — the text reply is already shown.
    }
  }, [user]);

  // ── Proactive coaching (B) ──
  // Ask the backend for a spoken coaching line at a specific workout moment
  // (session_start, exercise_intro, exercise_complete, session_end, milestone…),
  // show it as a Kin bubble, and speak it aloud. Best-effort — the backend
  // always returns a message (a static fallback if the AI is unavailable), so
  // we only stay silent on a hard network failure.
  const coach = useCallback(
    async (trigger: string, sessionId: string | null, context: Record<string, unknown>) => {
      // In continuous voice mode Kin (Gemini) is already coaching aloud — skip
      // the separate REST/TTS coaching line so we don't talk over the stream.
      if (voiceModeRef.current) return;
      try {
        const res = await apiPost<{ message: string }>('/api/companion/trigger', {
          trigger,
          ...(sessionId ? { session_id: sessionId } : {}),
          context,
        });
        const msg = res.message?.trim();
        if (msg) {
          setMessages((prev) => [...prev, { id: `${Date.now()}-k`, role: 'kin', text: msg }]);
          speak(msg);
        }
      } catch {
        // Non-fatal — skip the coaching line.
      }
    },
    [speak]
  );

  // Build the context payload the "exercise_intro" trigger expects.
  const exerciseIntroContext = useCallback(
    (ex: BundleExercise) => ({
      exercise_name: ex.name,
      muscle_groups: ex.muscle_groups,
      total_sets: ex.sets,
      target_reps: `${ex.rep_min}-${ex.rep_max}`,
      exercise_instructions: ex.instructions_text,
    }),
    []
  );

  const sendMessage = useCallback(
    async (overrideText?: string, inputMode: 'text' | 'voice' = 'text') => {
      const text = (overrideText ?? askText).trim();
      if (!text) return;
      setMessages((prev) => [...prev, { id: `${Date.now()}-u`, role: 'user', text }]);
      if (overrideText === undefined) setAskText('');
      setKinTyping(true);
      try {
        // General home-screen chat: no session_id, so the backend skips history
        // persistence and just returns Kin's reply.
        const res = await apiPost<{ reply: string; action_intent: string | null }>(
          '/api/companion/message',
          { message: text, input_mode: inputMode }
        );
        const reply = res.reply?.trim() || '…';
        setMessages((prev) => [...prev, { id: `${Date.now()}-k`, role: 'kin', text: reply }]);
        // Voice-initiated turns get spoken back so it feels like a conversation.
        if (inputMode === 'voice' && reply !== '…') speak(reply);
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
    },
    [askText, speak]
  );

  // Send the recorded clip to the backend for transcription, then run it
  // through the same chat flow as typed messages.
  const transcribeAndSend = useCallback(
    async (uri: string) => {
      setTranscribing(true);
      try {
        // On web the recorder produces a blob: URL (WebM). We have to fetch it
        // into a real Blob so the browser can build a proper multipart file.
        // On native we pass the { uri, name, type } file descriptor directly.
        let res: { transcript?: string; error?: string; fallback?: boolean };
        if (Platform.OS === 'web') {
          const blob = await (await fetch(uri)).blob();
          res = await apiUploadAudio('/api/stt/transcribe', blob);
        } else {
          const isWebm = uri.toLowerCase().endsWith('.webm');
          res = await apiUploadAudio('/api/stt/transcribe', {
            uri,
            name: isWebm ? 'speech.webm' : 'speech.m4a',
            type: isWebm ? 'audio/webm' : 'audio/m4a',
          });
        }

        const transcript = res.transcript?.trim();
        if (transcript) {
          await sendMessage(transcript, 'voice');
        } else if (res.error) {
          setMessages((prev) => [
            ...prev,
            { id: `${Date.now()}-k`, role: 'kin', text: res.error! },
          ]);
        } else {
          setMessages((prev) => [
            ...prev,
            {
              id: `${Date.now()}-k`,
              role: 'kin',
              text: "I didn't quite catch that. Try again, or type your message.",
            },
          ]);
        }
      } catch (e: any) {
        setMessages((prev) => [
          ...prev,
          {
            id: `${Date.now()}-k`,
            role: 'kin',
            text: `Voice input failed: ${e?.message || 'unknown error'}. Please type instead.`,
          },
        ]);
      } finally {
        setTranscribing(false);
      }
    },
    [sendMessage]
  );

  // Mic button: tap to start recording, tap again to stop and send.
  const toggleRecording = useCallback(async () => {
    if (transcribing) return;
    if (recording) {
      try {
        await audioRecorder.stop();
        const uri = audioRecorder.uri;
        setRecording(false);
        if (uri) await transcribeAndSend(uri);
      } catch {
        setRecording(false);
      }
      return;
    }
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        setMessages((prev) => [
          ...prev,
          {
            id: `${Date.now()}-k`,
            role: 'kin',
            text: 'I need microphone access to hear you. Enable it in Settings to use voice.',
          },
        ]);
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      setRecording(true);
    } catch {
      setRecording(false);
    }
  }, [recording, transcribing, audioRecorder, transcribeAndSend]);

  // Append a spoken transcript to the chat thread. Live transcription arrives
  // in small chunks, so we merge consecutive chunks from the same speaker into
  // one bubble instead of spawning a new bubble per fragment.
  const voiceTurnRef = useRef<{ role: 'user' | 'kin'; id: string } | null>(null);
  const appendVoiceTranscript = useCallback((role: 'user' | 'kin', text: string) => {
    const chunk = text?.trim();
    if (!chunk) return;
    setMessages((prev) => {
      const turn = voiceTurnRef.current;
      if (turn && turn.role === role) {
        // Continue the current speaker's bubble.
        return prev.map((m) =>
          m.id === turn.id ? { ...m, text: `${m.text} ${chunk}`.replace(/\s+/g, ' ').trim() } : m
        );
      }
      const id = `${Date.now()}-${role === 'user' ? 'u' : 'k'}`;
      voiceTurnRef.current = { role, id };
      return [...prev, { id, role, text: chunk }];
    });
  }, []);

  // Keep the WorkoutDeck in sync with the spoken conversation. The proxy relays
  // the user's speech but no workout-state events, so we detect simple spoken
  // commands ("done", "skip", "pause/resume", "start workout") from the user's
  // transcript and drive the same handlers the on-screen buttons use — so voice
  // and the card advance together, and a voice-started workout shows the card.
  // A short cooldown prevents chunked transcripts from firing a command twice.
  const handleUserSpeech = useCallback((text: string) => {
    const t = (text || '').toLowerCase();
    if (!t.trim()) return;
    const now = Date.now();
    if (now - lastVoiceCmdRef.current < 3500) return;

    const actions = voiceActionsRef.current;
    if (!actions) return;
    const w = workoutRef.current;
    const has = (arr: string[]) => arr.some((k) => t.includes(k));
    // Avoid false positives like "I'm not done yet" / "don't skip".
    const negated = has(['not done', 'not finished', "aren't done", 'not yet', "don't", 'do not']);

    if (w && !w.paused && !negated && has(['done', 'finished', "i'm done", 'im done', 'next exercise', 'next one', 'completed it', 'mark it done'])) {
      lastVoiceCmdRef.current = now;
      const ex = w.exercises[w.index];
      actions.handleDone(ex?.rep_max ?? ex?.rep_min ?? 10);
      return;
    }
    if (w && !negated && has(['skip'])) {
      lastVoiceCmdRef.current = now;
      actions.handleSkip();
      return;
    }
    if (w && !w.paused && has(['pause'])) {
      lastVoiceCmdRef.current = now;
      actions.togglePause();
      return;
    }
    if (w && w.paused && has(['resume', 'continue', 'unpause'])) {
      lastVoiceCmdRef.current = now;
      actions.togglePause();
      return;
    }
    if (!w && has(['start workout', 'start my workout', 'begin workout', 'start the workout', 'start session', 'start my session', "let's begin"])) {
      lastVoiceCmdRef.current = now;
      actions.startWorkout();
    }
  }, []);

  // Enter/exit continuous voice-to-voice mode (web). One tap starts a
  // hands-free, real-time speech-to-speech conversation via the backend's
  // Gemini Live proxy; another tap ends it. Kin listens and speaks aloud
  // continuously — no typing, no per-turn buttons.
  const toggleVoiceMode = useCallback(async () => {
    if (voiceLoopRef.current?.isActive()) {
      voiceLoopRef.current.stop();
      voiceLoopRef.current = null;
      voiceTurnRef.current = null;
      setVoiceMode(false);
      setVoicePhase('idle');
      return;
    }

    // A fresh Firebase token authenticates the WebSocket to the proxy.
    let token: string | null = null;
    try {
      token = await getFreshToken();
    } catch {
      token = null;
    }

    const live = new WebVoiceLive({
      wsBaseUrl: WS_BASE_URL,
      token,
      // Ground the voice AI in the live workout so it coaches the actual
      // exercise/set/reps you're on (not just open chat).
      sessionId: activeSessionIdRef.current,
      bundleId: recommended?._id ?? null,
      voiceStyle: (user?.companion_preferences as any)?.voice_style || null,
      onPhase: setVoicePhase,
      onTranscript: (role, text) => {
        // New turn from a different speaker resets the merge target.
        if (voiceTurnRef.current && voiceTurnRef.current.role !== role) {
          voiceTurnRef.current = null;
        }
        appendVoiceTranscript(role, text);
        // Let spoken commands drive the workout card (done/skip/pause/start).
        if (role === 'user') handleUserSpeech(text);
      },
      onNotice: (message: string) =>
        setMessages((prev) => [...prev, { id: `${Date.now()}-k`, role: 'kin', text: message }]),
    });

    try {
      voiceLoopRef.current = live;
      voiceTurnRef.current = null;
      setVoiceMode(true);
      setVoicePhase('connecting');
      await live.start();
    } catch (e: any) {
      voiceLoopRef.current = null;
      setVoiceMode(false);
      setVoicePhase('idle');
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-k`,
          role: 'kin',
          text: 'I need microphone access to talk. Allow it in your browser, then tap the mic again.',
        },
      ]);
    }
  }, [appendVoiceTranscript, handleUserSpeech, recommended, user]);

  // Mic button entry point: continuous voice mode on web, press-to-talk on native.
  const onMicPress = useCallback(() => {
    if (Platform.OS === 'web') return toggleVoiceMode();
    return toggleRecording();
  }, [toggleVoiceMode, toggleRecording]);

  // Clean up any active player/recorder/voice loop when leaving the screen.
  useEffect(() => {
    return () => {
      playerRef.current?.remove();
      voiceLoopRef.current?.stop();
      voiceLoopRef.current = null;
      if (audioRecorder.isRecording) audioRecorder.stop().catch(() => {});
    };
  }, [audioRecorder]);

  // ── In-chat workout session ──
  type WorkoutState = { exercises: BundleExercise[]; index: number; paused: boolean; title: string; sessionId: string | null };
  const [workout, setWorkout] = useState<WorkoutState | null>(null);

  // Keep the session-id + workout refs in sync so voice mode can ground itself
  // in the active workout and the voice-command handler reads fresh state.
  useEffect(() => {
    activeSessionIdRef.current = workout?.sessionId ?? null;
    workoutRef.current = workout;
  }, [workout]);

  // Mirror voice-mode into a ref so coach() can suppress its TTS while Kin is
  // speaking over the live stream.
  useEffect(() => {
    voiceModeRef.current = voiceMode;
  }, [voiceMode]);

  const startWorkout = useCallback(async () => {
    const bundle = recommended;
    const exercises = bundle?.exercises ?? [];
    if (!bundle || !exercises.length) {
      navigation.navigate('BundleSelection');
      return;
    }
    setMessages((prev) => [...prev, { id: `${Date.now()}-u`, role: 'user', text: 'Start workout' }]);
    setWorkout({ exercises, index: 0, paused: false, title: bundle.title ?? 'Workout', sessionId: null });

    // Tell the backend a session has started so the workout gets logged, then
    // let Kin greet the user and introduce the first exercise (proactive coaching).
    try {
      const res = await apiPost<{ session_id: string }>('/api/session/start', { bundle_id: bundle._id });
      setWorkout((w) => (w ? { ...w, sessionId: res.session_id } : w));
      await coach('session_start', res.session_id, {
        bundle_title: bundle.title,
        exercises_total: exercises.length,
      });
      if (exercises[0]) await coach('exercise_intro', res.session_id, exerciseIntroContext(exercises[0]));
    } catch {
      // If this fails the workout still runs locally — it just won't be logged.
      setMessages((prev) => [...prev, { id: `${Date.now()}-k`, role: 'kin', text: "Let's go." }]);
    }
  }, [recommended, navigation, coach, exerciseIntroContext]);

  // End the session on the backend — this triggers progression, XP, streak,
  // badges, and makes the workout show up in history / the Progress tab.
  const finishSession = useCallback(
    async (sessionId: string | null, title: string) => {
      setWorkout(null);
      if (sessionId) {
        try {
          const endRes = await apiPost<{ badges_earned?: Array<{ name?: string }> }>(
            `/api/session/${sessionId}/end`,
            {}
          );
          await coach('session_end', sessionId, { bundle_title: title });
          // Celebrate any freshly earned badges as a milestone moment.
          const badges = endRes?.badges_earned ?? [];
          if (badges.length) {
            await coach('milestone', sessionId, {
              milestone_type: 'badge',
              milestone_detail: badges.map((b) => b.name).filter(Boolean).join(', '),
            });
          }
        } catch {
          setMessages((m) => [
            ...m,
            { id: `${Date.now()}-k`, role: 'kin', text: `🎉 Workout complete! Great job finishing ${title}.` },
          ]);
        }
      } else {
        setMessages((m) => [
          ...m,
          { id: `${Date.now()}-k`, role: 'kin', text: `🎉 Workout complete! Great job finishing ${title}.` },
        ]);
      }
    },
    [coach]
  );

  // Mark the current exercise complete with the reps the user logged, then advance.
  const handleDone = useCallback(
    async (reps: number) => {
      const w = workout;
      if (!w) return;
      const ex = w.exercises[w.index];
      const isLast = w.index >= w.exercises.length - 1;
      const next = w.exercises[w.index + 1];

      if (!isLast) setWorkout({ ...w, index: w.index + 1, paused: false });

      if (w.sessionId && ex?.exercise_id) {
        try {
          const setCount = Math.max(1, ex.sets ?? 1);
          for (let i = 1; i <= setCount; i++) {
            await apiPut(`/api/session/${w.sessionId}/exercise`, {
              exercise_id: ex.exercise_id,
              action: 'complete_set',
              data: { set_number: i, actual_reps: reps },
            });
          }
          await apiPut(`/api/session/${w.sessionId}/exercise`, {
            exercise_id: ex.exercise_id,
            action: 'complete_exercise',
            data: { feedback: 'felt_normal' },
          });
        } catch {
          // Ignore logging failure for this exercise.
        }
      }

      if (isLast) {
        await finishSession(w.sessionId, w.title);
      } else if (next) {
        // Kin introduces the next exercise with a form cue.
        await coach('exercise_intro', w.sessionId, exerciseIntroContext(next));
      }
    },
    [workout, finishSession, coach, exerciseIntroContext]
  );

  // Skip the current exercise, then advance.
  const handleSkip = useCallback(async () => {
    const w = workout;
    if (!w) return;
    const ex = w.exercises[w.index];
    const isLast = w.index >= w.exercises.length - 1;
    const next = w.exercises[w.index + 1];

    if (!isLast) setWorkout({ ...w, index: w.index + 1, paused: false });

    if (w.sessionId && ex?.exercise_id) {
      try {
        await apiPut(`/api/session/${w.sessionId}/exercise`, {
          exercise_id: ex.exercise_id,
          action: 'skip',
          data: { reason: 'user_skipped' },
        });
      } catch {
        // Ignore.
      }
    }

    if (isLast) {
      await finishSession(w.sessionId, w.title);
    } else if (next) {
      await coach('exercise_intro', w.sessionId, exerciseIntroContext(next));
    }
  }, [workout, finishSession, coach, exerciseIntroContext]);

  const togglePause = useCallback(() => {
    setWorkout((p) => {
      if (!p) return p;
      const paused = !p.paused;
      // Persist the pause so the session can be resumed within the backend's
      // 30-minute window (D3).
      if (paused && p.sessionId) {
        apiPost(`/api/session/${p.sessionId}/pause`, {}).catch(() => {});
      }
      return { ...p, paused };
    });
  }, []);

  // Resume an in-progress session found on load (D2). Rebuilds the in-chat
  // workout from the matching bundle, starting at the first unfinished exercise.
  const resumeWorkout = useCallback(() => {
    if (!resumeInfo) return;
    const all = [recommended, ...others].filter(Boolean) as ExerciseBundle[];
    const bundle = all.find((b) => b._id === resumeInfo.bundleId) ?? recommended;
    const exercises = bundle?.exercises ?? [];
    if (!exercises.length) {
      setResumeInfo(null);
      return;
    }
    setMessages((prev) => [...prev, { id: `${Date.now()}-k`, role: 'kin', text: "Welcome back — let's pick up where you left off." }]);
    setWorkout({
      exercises,
      index: Math.min(resumeInfo.index, exercises.length - 1),
      paused: false,
      title: bundle?.title ?? 'Workout',
      sessionId: resumeInfo.sessionId,
    });
    setResumeInfo(null);
  }, [resumeInfo, recommended, others]);

  const makeEasier = useCallback(() => {
    setMessages((m) => [
      ...m,
      { id: `${Date.now()}-k`, role: 'kin', text: 'No problem — take it lighter. Drop a few reps or slow the tempo, and keep your form clean.' },
    ]);
  }, []);

  // Expose the latest workout handlers to the stable voice-command handler.
  useEffect(() => {
    voiceActionsRef.current = { startWorkout, handleDone, handleSkip, togglePause };
  }, [startWorkout, handleDone, handleSkip, togglePause]);

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

      // Offer to resume an in-progress session (D2), unless one is already
      // running in the UI.
      try {
        const act = await apiGet<{ has_active_session: boolean; session?: any }>('/api/session/active');
        if (act.has_active_session && act.session && !workout) {
          const s = act.session;
          const idx = (s.exercises ?? []).findIndex(
            (e: any) => e.status === 'pending' || e.status === 'in_progress'
          );
          setResumeInfo({
            sessionId: String(s._id),
            bundleId: String(s.bundle_id),
            index: idx < 0 ? 0 : idx,
          });
        } else {
          setResumeInfo(null);
        }
      } catch {
        setResumeInfo(null);
      }
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
              <WorkoutChip label="Skip Exercise" onPress={handleSkip} />
              <WorkoutChip label="Make Easier" onPress={makeEasier} />
              <WorkoutChip label={workout.paused ? 'Resume' : 'Pause Workout'} onPress={togglePause} />
            </View>
          )}
        </LinearGradient>

        {loading && !dash ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
        ) : (
          <View style={styles.body}>
            {/* Resume in-progress workout (D2) */}
            {!workout && resumeInfo && (
              <Pressable style={styles.resumeCard} onPress={resumeWorkout}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.resumeTitle}>Workout in progress</Text>
                  <Text style={styles.resumeSub}>Tap to pick up where you left off.</Text>
                </View>
                <Text style={styles.resumeCta}>Resume ▶</Text>
              </Pressable>
            )}

            {/* Daily check-in (D1) — hidden once done or during a workout */}
            {!workout && <DailyCheckinCard onComplete={load} />}

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
                    key={workout.index}
                    exercise={workout.exercises[workout.index]}
                    index={workout.index}
                    total={workout.exercises.length}
                    paused={workout.paused}
                    onDone={handleDone}
                    onSkip={handleSkip}
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
          style={styles.quickRowScroll}
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
        {voiceMode ? (
          <View style={styles.voiceHintRow}>
            <Text style={styles.voiceHintText}>
              {voicePhase === 'listening'
                ? '● Listening… just speak'
                : voicePhase === 'connecting'
                ? 'Connecting…'
                : voicePhase === 'speaking'
                ? '🔊 Kin is speaking…'
                : 'Voice mode on'}
              {'  ·  tap the mic to end'}
            </Text>
          </View>
        ) : (recording || transcribing) ? (
          <View style={styles.voiceHintRow}>
            <Text style={styles.voiceHintText}>
              {recording ? '● Listening… tap the mic again to send' : 'Transcribing…'}
            </Text>
          </View>
        ) : null}
        <View style={styles.askRow}>
          <TextInput
            style={styles.askInput}
            placeholder="Ask Kin anything…"
            placeholderTextColor={colors.textLight}
            value={askText}
            onChangeText={setAskText}
            onSubmitEditing={() => sendMessage()}
            returnKeyType="send"
          />
          <Pressable
            style={[styles.micBtn, (recording || voiceMode) && styles.micBtnActive]}
            accessibilityRole="button"
            accessibilityLabel={
              voiceMode ? 'Turn off voice chat' : recording ? 'Stop recording' : 'Voice input'
            }
            onPress={onMicPress}
            disabled={transcribing}
          >
            {transcribing || voicePhase === 'connecting' ? (
              <ActivityIndicator size="small" color={voiceMode ? '#FFFFFF' : colors.primary} />
            ) : (
              <MicIcon size={20} color={recording || voiceMode ? '#FFFFFF' : colors.primary} />
            )}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send"
            disabled={!askText.trim()}
            style={[styles.askSend, !askText.trim() && styles.askSendDisabled]}
            onPress={() => sendMessage()}
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
  quickRowScroll: { flexGrow: 0, flexShrink: 0 },
  quickRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: spacing.lg,
    paddingTop: 12,
    paddingBottom: 12,
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
  resumeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF6EE',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F5C89B',
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  resumeTitle: { ...typography.bodyBold, color: '#B25C10' },
  resumeSub: { ...typography.small, color: '#B4772E', marginTop: 2 },
  resumeCta: { ...typography.bodyBold, color: '#F5821F' },
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
  micBtnActive: {
    backgroundColor: '#FF5A4D',
  },
  voiceHintRow: {
    paddingHorizontal: spacing.xs,
    paddingBottom: spacing.xs,
  },
  voiceHintText: {
    ...typography.small,
    color: '#FF5A4D',
    fontFamily: 'Inter_600SemiBold',
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
