/**
 * VOICE LIVE — platform factory.
 *
 * Picks the correct real-time voice engine at runtime:
 *   • Web    → WebVoiceLive   (browser getUserMedia + Web Audio API)
 *   • Native → NativeVoiceLive (react-native-audio-api)
 *
 * Both speak the identical `/ws/voice-live` protocol, so callers use one
 * `VoiceLive` shape and never branch on platform themselves.
 */

import { Platform } from 'react-native';

import { WebVoiceLive } from './webVoiceLive';

export type VoiceLivePhase = 'idle' | 'connecting' | 'listening' | 'speaking';

export interface VoiceLiveOptions {
  /** WebSocket base, e.g. "ws://localhost:3000" / "wss://...". */
  wsBaseUrl: string;
  /** Fresh Firebase ID token for auth (null falls back to demo mode). */
  token: string | null;
  /** Optional active session / bundle to ground the conversation. */
  sessionId?: string | null;
  bundleId?: string | null;
  /** Voice style: calm | energetic | friendly | professional. */
  voiceStyle?: string | null;
  /** Report the current phase for UI feedback. */
  onPhase: (phase: VoiceLivePhase) => void;
  /** Surface a spoken transcript (if the proxy provides one). */
  onTranscript?: (role: 'user' | 'kin', text: string) => void;
  /** Surface a status / error message in the chat thread. */
  onNotice?: (message: string) => void;
  /** Fired when the socket fails/drops before a successful session. */
  onError?: () => void;
  /**
   * Fired when a SUCCESSFULLY-connected session's socket closes on its own
   * (e.g. the proxy/Gemini ended the session), as opposed to the user stopping
   * it. Lets the caller reset the UI instead of getting stuck showing
   * "Voice mode on".
   */
  onClosed?: () => void;
  /** App-level proxy events (any JSON message carrying a `type`). */
  onEvent?: (event: any) => void;
}

/** Common surface both engines implement. */
export interface VoiceLive {
  isActive(): boolean;
  sendAction(action: string, extra?: Record<string, any>): void;
  start(): Promise<void>;
  stop(): void;
}

export function createVoiceLive(opts: VoiceLiveOptions): VoiceLive {
  if (Platform.OS === 'web') {
    return new WebVoiceLive(opts);
  }
  // Lazily require so the web bundle never pulls in the native audio module.
  const { NativeVoiceLive } = require('./nativeVoiceLive');
  return new NativeVoiceLive(opts);
}
