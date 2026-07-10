import { useCallback, useRef, useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  InteractionManager,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import KinAvatar from '../components/KinAvatar';
import TabBarIcon from '../components/TabBarIcon';
import SendIcon from '../components/SendIcon';
import MicIcon from '../components/MicIcon';
import ChipIcon, { type ChipIconName } from '../components/ChipIcon';
import { FlameIcon, SlidersIcon } from '../components/HeaderIcons';
import HistoryDrawer, { type HistoryItem } from '../components/HistoryDrawer';
import SettingsSheet from '../components/SettingsSheet';
import WorkoutDeck from '../components/WorkoutDeck';
import DailyCheckinCard from '../components/DailyCheckinCard';
import WorkoutSummaryModal, { type WorkoutSummary } from '../components/WorkoutSummaryModal';
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
import { WebPushToTalk } from '../services/webPushToTalk';
import { getFreshToken } from '../services/auth';
import { useUserStore } from '../stores/userStore';
import { useUIStore } from '../stores/uiStore';
import { colors, spacing, typography } from '../theme';
import type { ExerciseBundle, BundleExercise } from '../../../shared/types';

interface DashboardData {
  greeting: string;
  persona_label: string;
  todays_workout: {
    state: 'in_progress' | 'ready' | 'completed' | 'no_plan' | string;
    session_id?: string;
    bundle_id?: string;
    title?: string;
    focus?: string;
    exercise_count?: number;
    estimated_duration_min?: number;
    bundles_stale?: boolean;
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

// Injury areas the user can flag when Kin detects pain (action_intent:
// update_injuries). The backend only sends the intent, not the area, so we let
// the user confirm — pre-selecting any area we can detect from Kin's reply.
const INJURY_AREAS: Array<{ label: string; value: string; keywords: string[] }> = [
  { label: 'Knee', value: 'knee', keywords: ['knee'] },
  { label: 'Lower Back', value: 'lower_back', keywords: ['back', 'lower back', 'spine'] },
  { label: 'Shoulder', value: 'shoulder', keywords: ['shoulder'] },
  { label: 'Wrist', value: 'wrist', keywords: ['wrist'] },
  { label: 'Ankle', value: 'ankle', keywords: ['ankle'] },
  { label: 'Neck', value: 'neck', keywords: ['neck'] },
];

const detectInjuryAreas = (text: string): string[] => {
  const t = (text || '').toLowerCase();
  return INJURY_AREAS.filter((a) => a.keywords.some((k) => t.includes(k))).map((a) => a.value);
};

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const user = useUserStore((s) => s.user);
  const setUser = useUserStore((s) => s.setUser);

  const [dash, setDash] = useState<DashboardData | null>(null);
  // The user's chosen profile avatar (set on the Profile tab, stored on-device).
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [recommended, setRecommended] = useState<ExerciseBundle | null>(null);
  const [others, setOthers] = useState<ExerciseBundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [askText, setAskText] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  // Post-workout summary (the /api/session/:id/end response), shown in a modal.
  const [summary, setSummary] = useState<WorkoutSummary | null>(null);
  // An in-progress session found on load, offered for resume (D2).
  const [resumeInfo, setResumeInfo] = useState<{ sessionId: string; bundleId: string; index: number } | null>(null);
  // Shown when Kin flags pain (action_intent: update_injuries) — lets the user
  // confirm which area to protect before we update the profile + regenerate (§8).
  const [injuryPrompt, setInjuryPrompt] = useState<{ selected: string[] } | null>(null);

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
  // Web REST voice fallback (§6): used when the live voice WebSocket is
  // unavailable — a simple tap-to-talk that records, transcribes, chats, speaks.
  const [voiceFallback, setVoiceFallback] = useState(false);
  const [fallbackRecording, setFallbackRecording] = useState(false);
  const pttRef = useRef<WebPushToTalk | null>(null);
  // Tracks the active workout's session id so voice mode can ground the AI in
  // the live session (set below, once the workout state exists).
  const activeSessionIdRef = useRef<string | null>(null);
  // Refs that let the (stable) voice-command handler read fresh state and
  // call the latest workout handlers without stale closures.
  const workoutRef = useRef<any>(null);
  const voiceModeRef = useRef(false);
  const voiceActionsRef = useRef<any>(null);
  const bundlesRef = useRef<ExerciseBundle[]>([]);

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
        // During a workout, pass session_id so Kin answers with live session
        // context (current exercise, sets, history). Outside a workout it's a
        // general chat (no session_id).
        const activeSessionId = workoutRef.current?.sessionId ?? undefined;
        const res = await apiPost<{ reply: string; action_intent: string | null }>(
          '/api/companion/message',
          { message: text, input_mode: inputMode, ...(activeSessionId ? { session_id: activeSessionId } : {}) }
        );
        const reply = res.reply?.trim() || '…';
        setMessages((prev) => [...prev, { id: `${Date.now()}-k`, role: 'kin', text: reply }]);
        // Voice-initiated turns get spoken back so it feels like a conversation.
        if (inputMode === 'voice' && reply !== '…') speak(reply);
        // Kin flagged pain → offer to update the injury profile (§8). The API
        // only sends the intent, so we pre-select any area detected in the reply.
        if (res.action_intent === 'update_injuries') {
          setInjuryPrompt({ selected: detectInjuryAreas(reply) });
        }
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

  // Transcribe a recorded blob (web REST fallback) then run it through the same
  // chat flow as typed/voice messages (which also handles TTS + action_intent).
  const transcribeBlobAndSend = useCallback(
    async (blob: Blob) => {
      setTranscribing(true);
      try {
        const ext = ((blob.type.split('/')[1] || 'webm').split(';')[0]) || 'webm';
        const res = await apiUploadAudio<{ transcript?: string; error?: string }>(
          '/api/stt/transcribe',
          new File([blob], `speech.${ext}`, { type: blob.type || 'audio/webm' })
        );
        const transcript = res.transcript?.trim();
        if (transcript) {
          await sendMessage(transcript, 'voice');
        } else {
          setMessages((prev) => [
            ...prev,
            { id: `${Date.now()}-k`, role: 'kin', text: res.error || "I didn't quite catch that. Try again, or type your message." },
          ]);
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          { id: `${Date.now()}-k`, role: 'kin', text: 'Voice input failed. Please type instead.' },
        ]);
      } finally {
        setTranscribing(false);
      }
    },
    [sendMessage]
  );

  // Tap-to-talk for the REST fallback: tap to record, tap again to send.
  const toggleFallbackRecording = useCallback(async () => {
    if (transcribing) return;
    if (fallbackRecording) {
      setFallbackRecording(false);
      try {
        const blob = await pttRef.current?.stop();
        pttRef.current = null;
        if (blob) await transcribeBlobAndSend(blob);
      } catch {
        pttRef.current = null;
      }
      return;
    }
    try {
      const ptt = new WebPushToTalk();
      await ptt.start();
      pttRef.current = ptt;
      setFallbackRecording(true);
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: `${Date.now()}-k`, role: 'kin', text: 'I need microphone access. Allow it in your browser, then tap the mic again.' },
      ]);
    }
  }, [fallbackRecording, transcribing, transcribeBlobAndSend]);

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

  // Proxy events during voice mode (doc §13). The proxy is the SOLE DB writer
  // while voice is active; the client just mirrors its authoritative state:
  //  • session_started — Kin auto-created/attached a session → show the deck.
  //  • workout_state    — proxy advanced → move the card to current_exercise_index.
  // Spoken commands are detected server-side (from Kin's audio) and surface as
  // workout_state, so the client never advances the card or writes REST itself.
  const handleWorkoutEvent = useCallback((event: any) => {
    if (!event || typeof event.type !== 'string') return;

    if (event.type === 'session_started') {
      if (workoutRef.current) return; // deck already showing
      // Prefer full bundle data (instructions, images) by matching bundle_id;
      // fall back to the exercise summaries the event provides.
      const bundle = bundlesRef.current.find((b) => b._id === event.bundle_id);
      let exercises: BundleExercise[] = bundle?.exercises ?? [];
      if (!exercises.length && Array.isArray(event.exercises)) {
        exercises = event.exercises.map((e: any) => ({
          exercise_id: e.exercise_id,
          name: e.name,
          sets: e.sets ?? 1,
          rep_min: e.rep_min ?? 8,
          rep_max: e.rep_max ?? 12,
          rest_seconds: e.rest_seconds ?? 60,
          instructions_text: '',
          image_url: e.image_url ?? '',
          image_url_end: '',
          muscle_groups: [],
        }));
      }
      if (exercises.length) {
        activeSessionIdRef.current = event.session_id;
        setWorkout({ exercises, index: 0, paused: false, title: bundle?.title ?? 'Workout', sessionId: event.session_id });
      }
      return;
    }

    if (event.type === 'workout_state') {
      const idx = event.current_exercise_index;
      if (typeof idx !== 'number') return;
      const w = workoutRef.current;
      if (!w) return;
      if (idx >= w.exercises.length) {
        voiceActionsRef.current?.finishSession?.(w.sessionId, w.title);
        return;
      }
      // Forward-only guard against out-of-order events.
      setWorkout((p) => (p && idx > p.index ? { ...p, index: idx, paused: false } : p));
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
      },
      onEvent: handleWorkoutEvent,
      onNotice: (message: string) =>
        setMessages((prev) => [...prev, { id: `${Date.now()}-k`, role: 'kin', text: message }]),
      // WebSocket unavailable → drop into the REST tap-to-talk fallback (§6).
      onError: () => {
        voiceLoopRef.current = null;
        setVoiceMode(false);
        setVoicePhase('idle');
        setVoiceFallback(true);
        setMessages((prev) => [
          ...prev,
          {
            id: `${Date.now()}-k`,
            role: 'kin',
            text: 'Live voice is unavailable right now — switched to tap-to-talk. Tap the mic, speak, then tap again to send.',
          },
        ]);
      },
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
  }, [appendVoiceTranscript, handleWorkoutEvent, recommended, user]);

  // Mic button entry point: continuous voice mode on web, press-to-talk on native.
  const onMicPress = useCallback(() => {
    if (Platform.OS === 'web') {
      // After a live-voice failure, the mic drives the REST tap-to-talk fallback.
      return voiceFallback ? toggleFallbackRecording() : toggleVoiceMode();
    }
    return toggleRecording();
  }, [voiceFallback, toggleFallbackRecording, toggleVoiceMode, toggleRecording]);

  // Clean up any active player/recorder/voice loop when leaving the screen.
  useEffect(() => {
    return () => {
      playerRef.current?.remove();
      voiceLoopRef.current?.stop();
      voiceLoopRef.current = null;
      pttRef.current?.stop();
      pttRef.current = null;
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

  // Let the voice event handler rebuild the deck from full bundle data on
  // session_started (see handleWorkoutEvent).
  useEffect(() => {
    bundlesRef.current = [recommended, ...others].filter(Boolean) as ExerciseBundle[];
  }, [recommended, others]);

  const startWorkout = useCallback(async (bundleArg?: ExerciseBundle) => {
    const bundle = bundleArg ?? recommended;
    const exercises = bundle?.exercises ?? [];
    if (!bundle || !exercises.length) {
      navigation.navigate('BundleSelection');
      return;
    }
    setMessages((prev) => [...prev, { id: `${Date.now()}-u`, role: 'user', text: `Start ${bundle.title ?? 'workout'}` }]);
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
      // Capture the plan size before clearing the workout so we can still show
      // a meaningful summary if the /end call fails.
      const planned = workoutRef.current?.exercises.length ?? 0;
      setWorkout(null);

      // Fetch the authoritative post-workout report. On any failure (network,
      // rate-limit, or a session that was never created) we fall back to a
      // minimal local summary so the summary modal ALWAYS appears.
      let endRes: WorkoutSummary | null = null;
      if (sessionId) {
        try {
          endRes = await apiPost<WorkoutSummary>(`/api/session/${sessionId}/end`, {});
        } catch {
          endRes = null;
        }
      }

      setSummary(
        endRes ?? {
          status: 'complete',
          exercises_completed: planned,
          exercises_planned: planned,
          completion_ratio: planned > 0 ? 100 : 0,
        }
      );

      if (sessionId) {
        await coach('session_end', sessionId, { bundle_title: title });
        // Celebrate any freshly earned badges as a milestone moment.
        const badges = endRes?.badges_earned ?? [];
        if (badges.length) {
          await coach('milestone', sessionId, {
            milestone_type: 'badge',
            milestone_detail: badges.map((b: any) => b.name).filter(Boolean).join(', '),
          });
        }
      }
    },
    [coach]
  );

  // Mark the current exercise complete with the reps the user logged, then advance.
  const handleDone = useCallback(
    async (reps: number) => {
      // Voice mode: the proxy is the sole DB writer. Send the action over the
      // socket; the card advances when the proxy emits workout_state (doc §13).
      if (voiceModeRef.current) {
        voiceLoopRef.current?.sendAction('complete_set', { actual_reps: reps });
        return;
      }
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
    // Voice mode: send the action to the proxy (sole writer); card follows workout_state.
    if (voiceModeRef.current) {
      voiceLoopRef.current?.sendAction('skip_exercise');
      return;
    }
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

  // "Start New" from the in-progress prompt: dismiss resume and open the bundle
  // picker (which generates fresh bundles and shows the cards).
  const startNew = useCallback(() => {
    setResumeInfo(null);
    navigation.navigate('BundleSelection');
  }, [navigation]);

  const makeEasier = useCallback(() => {
    setMessages((m) => [
      ...m,
      { id: `${Date.now()}-k`, role: 'kin', text: 'No problem — take it lighter. Drop a few reps or slow the tempo, and keep your form clean.' },
    ]);
  }, []);

  // End the workout early. Whatever's been logged so far is saved: the backend
  // classifies it (≥50% → partial, else abandoned) and returns the report, which
  // finishSession shows in the summary modal. Confirm first (web has no native
  // Alert dialog, so fall back to window.confirm there).
  const confirmEndWorkout = useCallback(() => {
    const w = workoutRef.current;
    if (!w) return;
    const doEnd = () => finishSession(w.sessionId, w.title);
    if (Platform.OS === 'web') {
      const ok = (globalThis as any).confirm?.('End workout now? Your progress so far will be saved.');
      if (ok) doEnd();
    } else {
      Alert.alert('End workout?', 'Your progress so far will be saved.', [
        { text: 'Keep going', style: 'cancel' },
        { text: 'End workout', style: 'destructive', onPress: doEnd },
      ]);
    }
  }, [finishSession]);

  // Expose the latest workout handlers to the stable voice-command + workout
  // event handlers.
  useEffect(() => {
    voiceActionsRef.current = { startWorkout, handleDone, handleSkip, togglePause, finishSession };
  }, [startWorkout, handleDone, handleSkip, togglePause, finishSession]);

  const openHistory = useCallback(() => {
    // Open immediately so the slide-in starts right away, then run the fetch
    // after the open animation completes — otherwise the network response
    // re-renders the list mid-animation and makes opening feel laggy.
    setHistoryOpen(true);
    setHistoryLoading(true);
    InteractionManager.runAfterInteractions(async () => {
      try {
        const res = await apiGet<{ history: HistoryItem[] }>('/api/progress/history?limit=30');
        setHistory(res.history ?? []);
      } catch {
        setHistory([]);
      } finally {
        setHistoryLoading(false);
      }
    });
  }, []);

  // Regenerate the full bundle set via the Rules Engine. The backend deactivates
  // the old active bundles and returns a fresh set, which we swap in.
  const regenerateWorkouts = useCallback(async () => {
    setRegenerating(true);
    try {
      const res = await apiPost<{ bundles: ExerciseBundle[] }>('/api/bundles/generate', {});
      const bundles = res?.bundles ?? [];
      if (bundles.length) {
        const rec = bundles.find((b) => b.is_recommended) ?? bundles[0];
        setRecommended(rec);
        setOthers(bundles.filter((b) => b._id !== rec._id));
        setMessages((prev) => [...prev, { id: `${Date.now()}-k`, role: 'kin', text: 'Fresh workouts are ready — pick one to start.' }]);
      }
    } catch {
      setMessages((prev) => [...prev, { id: `${Date.now()}-k`, role: 'kin', text: "I couldn't regenerate your workouts just now. Please try again in a moment." }]);
    } finally {
      setRegenerating(false);
    }
  }, []);

  // Confirm the pain/injury update (§8): merge the chosen areas into the user's
  // injuries, persist, then regenerate a safer plan (the Filter stage excludes
  // exercises contraindicated for those injuries).
  const confirmInjuryUpdate = useCallback(
    async (areas: string[]) => {
      setInjuryPrompt(null);
      if (!areas.length) return;
      try {
        const existing = (user?.injuries ?? []).filter((i) => i && i !== 'none');
        const merged = Array.from(new Set([...existing, ...areas]));
        const updated = await apiPut<any>('/api/profile', { injuries: merged });
        if (updated) setUser(updated);
        setMessages((prev) => [
          ...prev,
          { id: `${Date.now()}-k`, role: 'kin', text: "Done — I've updated your profile to protect that area and I'm building you a safer plan." },
        ]);
        await regenerateWorkouts();
      } catch {
        setMessages((prev) => [
          ...prev,
          { id: `${Date.now()}-k`, role: 'kin', text: "I couldn't update your profile just now — you can adjust injuries in Settings." },
        ]);
      }
    },
    [user, regenerateWorkouts, setUser]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, active] = await Promise.all([
        apiGet<DashboardData>('/api/dashboard').catch(() => null),
        apiGet<{ bundles: ExerciseBundle[] }>('/api/bundles/active').catch(() => null),
      ]);
      if (d) setDash(d);

      let bundles = active?.bundles ?? [];
      // Regenerate when there's no plan yet (e.g. right after onboarding) or the
      // dashboard flags the current bundles as stale (>24h old).
      const bundlesStale = d?.todays_workout?.bundles_stale === true;
      if (bundles.length === 0 || bundlesStale) {
        const gen = await apiPost<{ bundles: ExerciseBundle[] }>('/api/bundles/generate', {}).catch(() => null);
        if (gen?.bundles?.length) bundles = gen.bundles;
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

  // Reload the chosen avatar whenever Home regains focus (e.g. after changing
  // it on the Profile tab). Stored on-device, keyed by user.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      AsyncStorage.getItem(`@kin/avatar/${user?._id ?? 'me'}`)
        .then((v) => {
          if (active) setAvatarUrl(v);
        })
        .catch(() => {});
      return () => {
        active = false;
      };
    }, [user?._id])
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

  // Focus mode: an active (non-paused) workout takes over the whole screen —
  // header + tab bar hide, a large exercise GIF sits up top, the deck drops to
  // just above the Ask Kin bar. Pausing or ending exits back to the normal UI.
  const focusMode = !!workout && !workout.paused;
  const setHideTabBar = useUIStore((s) => s.setHideTabBar);
  useEffect(() => {
    setHideTabBar(focusMode);
    return () => setHideTabBar(false);
  }, [focusMode, setHideTabBar]);

  // Chat bubbles (user + Kin + typing) — reused in the normal thread and the
  // focus-mode chat area.
  const chatBubbles = (
    <>
      {messages.map((m) =>
        m.role === 'user' ? (
          <View key={m.id} style={styles.userMsgRow}>
            <View style={styles.userBubble}>
              <Text style={styles.userBubbleText}>{m.text}</Text>
            </View>
          </View>
        ) : (
          <View key={m.id} style={styles.kinMsgRow}>
            <KinLogo size={36} />
            <View style={styles.kinBubble}>
              <Text style={styles.kinBubbleText}>{m.text}</Text>
            </View>
          </View>
        )
      )}
      {kinTyping && (
        <View style={styles.kinMsgRow}>
          <KinLogo size={36} />
          <View style={styles.kinBubble}>
            <View style={styles.typingRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.typingText}>Kin is thinking…</Text>
            </View>
          </View>
        </View>
      )}
    </>
  );

  // Ask Kin bar — reused in both the normal dock and the focus-mode layout.
  const askBar = (
    <View
      style={[
        styles.askBar,
        { paddingBottom: focusMode ? Math.max(insets.bottom, 10) + 10 : Math.max(insets.bottom, 10) + 90 },
      ]}
    >
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
          style={[styles.askInput, { outlineWidth: 0, outlineColor: 'transparent' } as any]}
          placeholder="Ask Kin anything…"
          placeholderTextColor={colors.textLight}
          value={askText}
          onChangeText={setAskText}
          onSubmitEditing={() => sendMessage()}
          returnKeyType="send"
          underlineColorAndroid="transparent"
          selectionColor={colors.primary}
        />
        <Pressable
          style={styles.micBtn}
          accessibilityRole="button"
          accessibilityLabel={
            voiceMode ? 'Turn off voice chat' : recording ? 'Stop recording' : 'Voice input'
          }
          onPress={onMicPress}
          disabled={transcribing}
        >
          {transcribing || voicePhase === 'connecting' ? (
            <ActivityIndicator size="small" color={recording || voiceMode ? '#E5484D' : colors.primary} />
          ) : recording || voiceMode ? (
            <View style={styles.micActiveCircle}>
              <View style={styles.micStopSquare} />
            </View>
          ) : (
            <MicIcon size={24} color="#8A94A6" />
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
  );

  // Modals — rendered in both layouts.
  const overlays = (
    <>
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

      <WorkoutSummaryModal
        visible={!!summary}
        summary={summary}
        onClose={() => {
          setSummary(null);
          load();
        }}
      />
    </>
  );

  // ── Focus-mode layout ──
  // Smaller GIF on top; the translucent deck floats just below it; the whole
  // area beneath the GIF is a chat surface — messages start above the search
  // bar and scroll up behind the deck, right to the card under the GIF.
  if (focusMode && workout) {
    const currentEx = workout.exercises[workout.index];
    return (
      <View style={styles.focusContainer}>
        <View style={[styles.focusGifWrap, { marginTop: Math.max(insets.top, 24) + spacing.md }]}>
          {currentEx?.image_url ? (
            <Image source={{ uri: currentEx.image_url }} style={styles.focusGif} resizeMode="cover" />
          ) : (
            <View style={styles.focusGif} />
          )}
        </View>

        {/* Chat surface fills the rest; the deck floats over the top of it.
            Chat scrolls up behind the deck, stopping at its topmost edge. */}
        <View style={styles.focusChatArea}>
          <ScrollView
            ref={scrollRef}
            style={styles.focusChatScroll}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.focusChatContent}
          >
            {chatBubbles}
          </ScrollView>

          <View style={styles.focusDeckFloat} pointerEvents="box-none">
            <WorkoutDeck
              key={workout.index}
              exercise={currentEx}
              index={workout.index}
              total={workout.exercises.length}
              paused={workout.paused}
              onDone={handleDone}
              onSkip={handleSkip}
              onPause={togglePause}
              onEnd={confirmEndWorkout}
              hideImage
              transparent
            />
          </View>
        </View>

        {askBar}

        {overlays}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* ── Fixed header (stays put while the content scrolls) ── */}
      <LinearGradient
        colors={['#000000', '#000000']}
        style={[styles.header, { paddingTop: Math.max(insets.top, 24) + spacing.md }]}
      >
          <View style={styles.headerTop}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Workout history"
              onPress={openHistory}
              style={styles.menuBtn}
            >
              <ChipIcon name="history" size={20} color="#FFFFFF" />
            </Pressable>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.headerAvatar} resizeMode="cover" />
            ) : (
              <KinAvatar size={52} />
            )}
            <View style={styles.greetingBlock}>
              <Text style={styles.greetingSmall}>{timeGreeting()}</Text>
              <Text style={styles.name}>{name}</Text>
              <Text style={styles.greetingSub} numberOfLines={1}>
                {dash?.persona_label ?? 'Ready when you are.'}
              </Text>
            </View>
            <View style={styles.headerActions}>
              <View style={styles.streakPill}>
                <FlameIcon size={16} />
                <Text style={styles.streakText}>{streak}</Text>
              </View>
              <Pressable style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Settings" onPress={() => setSettingsOpen(true)}>
                <SlidersIcon size={20} />
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

      <ScrollView ref={scrollRef} style={styles.scrollView} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {loading && !dash ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
        ) : (
          <View style={styles.body}>
            {/* In-progress workout: resume it or start a fresh one (D2) */}
            {!workout && resumeInfo && (
              <View style={styles.resumeCard}>
                <Text style={styles.resumeTitle}>Workout in progress</Text>
                <Text style={styles.resumeSub}>Pick up where you left off, or start fresh.</Text>
                <View style={styles.resumeActions}>
                  <Pressable style={styles.resumeBtnPrimary} onPress={resumeWorkout}>
                    <Text style={styles.resumeBtnPrimaryText}>Resume ▶</Text>
                  </Pressable>
                  <Pressable style={styles.resumeBtnSecondary} onPress={startNew}>
                    <Text style={styles.resumeBtnSecondaryText}>Start New</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {/* Daily check-in (D1) — hidden once done or during a workout */}
            {!workout && <DailyCheckinCard onComplete={load} />}

            {/* Today's recommendation */}
            <LinearGradient colors={['#101800', '#101800']} style={styles.recCard}>
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

              <View style={styles.recActions}>
                <Pressable style={styles.startWrap} onPress={() => startWorkout(recommended ?? undefined)}>
                  <View style={styles.startBtn}>
                    <Text style={styles.startText}>▶  Start Now</Text>
                  </View>
                </Pressable>
                <Pressable style={styles.detailsBtn} onPress={openRecommended}>
                  <Text style={styles.detailsText}>Details</Text>
                </Pressable>
              </View>
            </LinearGradient>

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
                <View style={styles.wTileGrid}>
                  {others.map((bundle) => (
                    <WorkoutTile
                      key={bundle._id}
                      bundle={bundle}
                      onPress={() => navigation.navigate('BundleDetail', { bundle })}
                      onStart={() => startWorkout(bundle)}
                    />
                  ))}
                </View>
              </>
            )}

            {/* Regenerate the whole plan (small link below the last card) */}
            {!workout && recommended && (
              <Pressable
                onPress={regenerateWorkouts}
                disabled={regenerating}
                style={styles.regenBtn}
                accessibilityRole="button"
                accessibilityLabel="Regenerate workouts"
              >
                {regenerating ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text style={styles.regenText}>↻  Regenerate workouts</Text>
                )}
              </Pressable>
            )}

            {/* Chat thread with Kin */}
            {(messages.length > 0 || kinTyping || workout) && (
              <View style={styles.chatThread}>
                {chatBubbles}
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
                    onEnd={confirmEndWorkout}
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

                {/* Pain/injury update prompt (§8) */}
                {injuryPrompt && (
                  <View style={styles.injuryCard}>
                    <Text style={styles.injuryTitle}>Protect an area?</Text>
                    <Text style={styles.injurySub}>
                      Select where you felt discomfort — I'll avoid exercises that stress it.
                    </Text>
                    <View style={styles.injuryChips}>
                      {INJURY_AREAS.map((a) => {
                        const sel = injuryPrompt.selected.includes(a.value);
                        return (
                          <Pressable
                            key={a.value}
                            onPress={() =>
                              setInjuryPrompt((p) =>
                                p
                                  ? { selected: sel ? p.selected.filter((x) => x !== a.value) : [...p.selected, a.value] }
                                  : p
                              )
                            }
                            style={[styles.injuryChip, sel && styles.injuryChipSel]}
                          >
                            <Text style={[styles.injuryChipText, sel && styles.injuryChipTextSel]}>{a.label}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                    <View style={styles.injuryActions}>
                      <Pressable onPress={() => setInjuryPrompt(null)} style={styles.injuryBtnGhost}>
                        <Text style={styles.injuryBtnGhostText}>Not now</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => confirmInjuryUpdate(injuryPrompt.selected)}
                        disabled={!injuryPrompt.selected.length}
                        style={[styles.injuryBtnPrimary, !injuryPrompt.selected.length && styles.injuryBtnDisabled]}
                      >
                        <Text style={styles.injuryBtnPrimaryText}>Update &amp; regenerate</Text>
                      </Pressable>
                    </View>
                  </View>
                )}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Floating bottom dock — transparent; the chat flows behind it */}
      <View style={styles.bottomDock} pointerEvents="box-none">
      {/* Quick actions — chat trigger chips, just above the Ask Kin bar */}
      {!workout && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.quickRowScroll}
          contentContainerStyle={styles.quickRow}
        >
          <QuickChip icon="workout" label="Start Workout" onPress={() => startWorkout()} />
          <QuickChip icon="progress" label="Show Progress" onPress={() => navigation.navigate('Progress' as never)} />
          <QuickChip icon="plan" label="Weekly Plan" onPress={openBundles} />
          <QuickChip icon="history" label="Workout History" onPress={openHistory} />
          <QuickChip icon="badges" label="My Badges" onPress={() => navigation.navigate('Progress' as never)} />
          <QuickChip icon="recovery" label="Recovery" onPress={() => setAskText('How should I recover today?')} />
          <QuickChip icon="motivation" label="Motivation" onPress={() => setAskText('Give me some motivation!')} />
        </ScrollView>
      )}

      {/* Ask Kin bar */}
      {askBar}
      </View>

      {overlays}
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
      <View style={styles.quickChip}>
        <ChipIcon name={icon} size={16} color="#FFFFFF" />
        <Text style={styles.quickChipText} numberOfLines={1}>
          {label}
        </Text>
      </View>
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

/** Kin logo avatar — the AI Coach tab-bar icon, used in the chat thread. */
function KinLogo({ size = 36 }: { size?: number }) {
  return (
    <View style={[styles.kinLogo, { width: size, height: size, borderRadius: size / 2 }]}>
      <TabBarIcon name="coach" color="rgb(166, 250, 4)" size={size * 0.6} />
    </View>
  );
}

/** Square workout tile for the "More plans" grid — tap opens detail, lime button starts. */
function WorkoutTile({ bundle, onPress, onStart }: { bundle: any; onPress: () => void; onStart: () => void }) {
  const cal = bundle.estimated_calorie_burn;
  const focus = String(bundle.focus || 'general').replace(/_/g, ' ').toUpperCase();
  return (
    <Pressable style={styles.wTile} onPress={onPress} accessibilityRole="button" accessibilityLabel={bundle.title}>
      <Text style={styles.wTileTitle} numberOfLines={2}>{bundle.title}</Text>
      <View style={styles.wTag}>
        <Text style={styles.wTagText}>{focus}</Text>
      </View>
      <View style={styles.wTileMetaWrap}>
        <Text style={styles.wTileMeta} numberOfLines={1}>{bundle.estimated_duration_min} min</Text>
        <Text style={styles.wTileMeta} numberOfLines={1}>{bundle.exercises.length} exercises</Text>
        {!!cal && <Text style={styles.wTileMeta} numberOfLines={1}>{cal.low}-{cal.high} cal</Text>}
      </View>
      <Pressable style={styles.wStartBtn} onPress={onStart} accessibilityRole="button" accessibilityLabel={`Start ${bundle.title}`}>
        <Text style={styles.wStartIcon}>▶</Text>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  // Focus mode: full black takeover during an active workout.
  focusContainer: { flex: 1, backgroundColor: '#000000' },
  // Exercise GIF up top — same width as the card, a little less wide.
  focusGifWrap: { paddingHorizontal: spacing.lg + spacing.md },
  focusGif: {
    width: '100%',
    height: 200,
    borderRadius: 24,
    backgroundColor: '#1C1C1E',
  },
  // Chat surface below the GIF; the translucent deck floats over its top edge.
  focusChatArea: { flex: 1, position: 'relative' },
  // Reduce the chat container's height so its top edge aligns with the deck's
  // top edge — the deck's card starts spacing.md below the float's top.
  focusChatScroll: { flex: 1, marginTop: spacing.md },
  // Newest messages sit at the bottom (just above the Ask Kin bar) and grow up.
  focusChatContent: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.md,
  },
  // Deck pinned to the top of the chat area, right under the GIF.
  focusDeckFloat: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: spacing.lg },
  scrollView: { flex: 1 },
  scroll: { paddingBottom: 236 },
  bottomDock: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: 'transparent' },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  headerTop: { flexDirection: 'row', alignItems: 'center' },
  menuBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
    gap: 3,
  },
  menuLine: {
    width: 16,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#FFFFFF',
  },
  headerAvatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.2)' },
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
  levelText: { ...typography.small, color: 'rgb(166, 250, 4)', fontFamily: 'Inter_700Bold' },
  xpText: { ...typography.caption, color: '#FFFFFF', flex: 1 },
  xpToNext: { ...typography.small, color: 'rgba(255,255,255,0.75)' },
  xpBar: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 3,
    marginTop: spacing.sm,
    overflow: 'hidden',
  },
  xpFill: { height: '100%', backgroundColor: 'rgb(166, 250, 4)', borderRadius: 3 },
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
    paddingTop: 18,
    paddingBottom: 6,
    alignItems: 'center',
  },
  quickChipWrap: {
    height: 40,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 12,
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
    backgroundColor: 'rgba(24,24,26,0.92)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  quickChipText: { ...typography.caption, color: '#FFFFFF', fontFamily: 'Inter_600SemiBold' },
  body: { paddingHorizontal: spacing.lg, marginTop: spacing.xs },
  resumeCard: {
    backgroundColor: '#FFF6EE',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F5C89B',
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  resumeTitle: { ...typography.bodyBold, color: '#B25C10' },
  resumeSub: { ...typography.small, color: '#B4772E', marginTop: 2 },
  resumeActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  resumeBtnPrimary: {
    flex: 1,
    backgroundColor: '#F5821F',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  resumeBtnPrimaryText: { ...typography.bodyBold, color: '#FFFFFF' },
  resumeBtnSecondary: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F5C89B',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  resumeBtnSecondaryText: { ...typography.bodyBold, color: '#B25C10' },
  injuryCard: {
    backgroundColor: '#FDECEC',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F3B4B4',
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  injuryTitle: { ...typography.bodyBold, color: '#B02A2A' },
  injurySub: { ...typography.small, color: '#B4534E', marginTop: 2 },
  injuryChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: spacing.sm },
  injuryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F3B4B4',
  },
  injuryChipSel: { backgroundColor: '#B02A2A', borderColor: '#B02A2A' },
  injuryChipText: { ...typography.small, color: '#B02A2A', fontFamily: 'Inter_600SemiBold' },
  injuryChipTextSel: { color: '#FFFFFF' },
  injuryActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  injuryBtnGhost: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#F3B4B4' },
  injuryBtnGhostText: { ...typography.bodyBold, color: '#B4534E' },
  injuryBtnPrimary: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12, backgroundColor: '#B02A2A' },
  injuryBtnPrimaryText: { ...typography.bodyBold, color: '#FFFFFF' },
  injuryBtnDisabled: { opacity: 0.4 },
  recCard: { borderRadius: 18, padding: spacing.lg, overflow: 'hidden' },
  regenBtn: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    minHeight: 32,
  },
  regenText: { ...typography.body, color: colors.textSecondary, fontFamily: 'Inter_600SemiBold' },
  recBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#2E2E30',
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    marginBottom: spacing.sm,
  },
  recBadgeText: { ...typography.small, color: 'rgb(166, 250, 4)', fontFamily: 'Inter_700Bold', letterSpacing: 0.5 },
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
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  startWrap: { flex: 1, borderRadius: 14, overflow: 'hidden' },
  startBtn: { height: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgb(166, 250, 4)' },
  startText: { ...typography.bodyBold, color: '#000000' },
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
  wTileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  wTile: {
    width: '47.5%',
    minHeight: 160,
    backgroundColor: '#101800',
    borderRadius: 18,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  wTileTitle: { ...typography.bodyBold, color: '#FFFFFF', fontSize: 15 },
  wTag: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(74,144,194,0.18)',
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    marginTop: spacing.sm,
  },
  wTagText: { ...typography.small, fontSize: 10, color: colors.primary, fontFamily: 'Inter_700Bold', letterSpacing: 0.5 },
  wTileMetaWrap: { marginTop: spacing.sm, paddingRight: 44 },
  wTileMeta: { ...typography.small, color: colors.textSecondary, marginTop: 2 },
  wStartBtn: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.md,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgb(166, 250, 4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wStartIcon: { color: '#000000', fontSize: 15, marginLeft: 2 },
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
  kinLogo: {
    backgroundColor: '#1C1C1E',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
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
    backgroundColor: '#1C1C1E',
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
    backgroundColor: '#1C1C1E',
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
    paddingTop: 0,
    paddingBottom: 14,
    backgroundColor: 'transparent',
  },
  askRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(24,24,26,0.92)',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 12,
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
  micActiveCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(229,72,77,0.18)', // dark-mode red tint (matches End Workout button)
  },
  micStopSquare: {
    width: 14,
    height: 14,
    borderRadius: 3,
    backgroundColor: '#E5484D', // brighter red stop square
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
