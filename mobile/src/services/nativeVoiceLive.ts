/**
 * NATIVE VOICE LIVE (Gemini Live speech-to-speech, iOS/Android)
 *
 * The native counterpart to `webVoiceLive.ts`. It speaks the SAME WebSocket
 * protocol to the backend proxy (`/ws/voice-live`) with the SAME audio formats,
 * so the server needs no changes — only the audio engine differs:
 *
 *   • Web  → browser getUserMedia + Web Audio API (webVoiceLive.ts)
 *   • Native → react-native-audio-api (this file):
 *        - AudioRecorder.onAudioReady → raw 16 kHz PCM frames from the mic
 *        - AudioContext (24 kHz) + AudioBufferSourceNode → low-latency playback
 *
 *   mic (16 kHz PCM) ──► proxy ──► Gemini Live
 *   speaker (24 kHz PCM) ◄── proxy ◄── Gemini Live
 *
 * react-native-audio-api implements the Web Audio API, so the playback +
 * scheduling logic is intentionally identical to the web version.
 */

import { AudioContext, AudioManager, AudioRecorder } from 'react-native-audio-api';

import type { VoiceLiveOptions } from './voiceLive';

// Gemini Live audio formats (fixed by the API / proxy).
const INPUT_SAMPLE_RATE = 16000; // mic capture + upload
const OUTPUT_SAMPLE_RATE = 24000; // model audio playback

export class NativeVoiceLive {
  private opts: VoiceLiveOptions;
  private ws: WebSocket | null = null;
  private recorder: AudioRecorder | null = null;
  private playbackCtx: AudioContext | null = null;
  private active = false;
  private connected = false;
  private audioStreamStarted = false;
  private nextPlayTime = 0;
  private connectTimer: ReturnType<typeof setTimeout> | null = null;
  // How long to wait for Gemini's setupComplete before giving up. Setup is
  // normally 1-3s; if it never arrives (e.g. a server-side setup failure) we
  // bail instead of hanging on "connecting" forever.
  private static readonly CONNECT_TIMEOUT_MS = 15000;

  constructor(opts: VoiceLiveOptions) {
    this.opts = opts;
  }

  isActive(): boolean {
    return this.active;
  }

  sendAction(action: string, extra?: Record<string, any>): void {
    const ws = this.ws;
    if (!ws || ws.readyState !== 1 /* OPEN */) return;
    try {
      ws.send(JSON.stringify({ action, ...(extra || {}) }));
    } catch {
      /* ignore */
    }
  }

  async start(): Promise<void> {
    this.active = true;
    this.opts.onPhase('connecting');

    // 1. Runtime mic permission (declared in app.json, but must be granted).
    let perm: string;
    try {
      perm = await AudioManager.requestRecordingPermissions();
    } catch {
      perm = 'Denied';
    }
    if (perm !== 'Granted') {
      this.active = false;
      throw new Error('Microphone permission denied');
    }

    // 2. Configure the audio session for simultaneous capture + playback so
    //    Kin can listen and speak at the same time.
    try {
      AudioManager.setAudioSessionOptions({
        iosCategory: 'playAndRecord',
        iosMode: 'voiceChat',
        iosOptions: ['defaultToSpeaker', 'allowBluetoothHFP'],
      });
      await AudioManager.setAudioSessionActivity(true);
    } catch {
      /* non-fatal — proceed with defaults */
    }

    // 3. Playback context at the model's 24 kHz output rate. Wrapped so a
    //    device that rejects a custom rate falls back to its default context.
    try {
      this.playbackCtx = new AudioContext({ sampleRate: OUTPUT_SAMPLE_RATE });
    } catch {
      this.playbackCtx = new AudioContext();
    }
    try {
      // Some platforms start the context suspended until explicitly resumed.
      (this.playbackCtx as any).resume?.();
    } catch {
      /* ignore */
    }

    // 4. Mic recorder in data-callback mode → raw PCM frames (~100 ms each).
    this.recorder = new AudioRecorder();
    this.recorder.onAudioReady(
      {
        sampleRate: INPUT_SAMPLE_RATE,
        bufferLength: Math.round(0.1 * INPUT_SAMPLE_RATE),
        channelCount: 1,
      },
      (event: any) => this.onMicBuffer(event)
    );

    // 5. Open the proxy WebSocket (identical URL/params to the web client).
    let url = `${this.opts.wsBaseUrl}/ws/voice-live?`;
    const params: string[] = [];
    if (this.opts.token) params.push(`token=${encodeURIComponent(this.opts.token)}`);
    if (this.opts.sessionId) params.push(`session_id=${encodeURIComponent(this.opts.sessionId)}`);
    if (this.opts.bundleId) params.push(`bundle_id=${encodeURIComponent(this.opts.bundleId)}`);
    if (this.opts.voiceStyle) params.push(`voice_style=${encodeURIComponent(this.opts.voiceStyle)}`);
    url += params.join('&');

    const ws = new WebSocket(url);
    ws.binaryType = 'arraybuffer';
    this.ws = ws;

    // Don't hang on "connecting" forever if setup never completes. If we're
    // still not connected after the grace period, tear down and surface an
    // error so the UI falls back to tap-to-talk instead of a dead spinner.
    this.connectTimer = setTimeout(() => {
      if (this.active && !this.connected) {
        this.stop();
        this.opts.onError?.();
      }
    }, NativeVoiceLive.CONNECT_TIMEOUT_MS);

    ws.onmessage = (event: any) => this.onMessage(event);
    ws.onerror = () => {
      if (this.active && !this.connected) this.opts.onError?.();
    };
    ws.onclose = () => {
      // Capture state BEFORE stop() resets it.
      const failedToConnect = this.active && !this.connected;
      const droppedMidSession = this.active && this.connected;
      this.stop();
      if (failedToConnect) this.opts.onError?.();
      // Server/proxy ended a live session (e.g. Gemini session limit). Tell the
      // caller so the UI resets instead of getting stuck on "Voice mode on".
      else if (droppedMidSession) this.opts.onClosed?.();
    };
  }

  stop(): void {
    this.active = false;
    this.connected = false;
    this.audioStreamStarted = false;
    this.nextPlayTime = 0;
    if (this.connectTimer) {
      clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }

    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        /* ignore */
      }
      this.ws = null;
    }
    if (this.recorder) {
      try {
        this.recorder.stop();
      } catch {
        /* ignore */
      }
      try {
        this.recorder.clearOnAudioReady?.();
      } catch {
        /* ignore */
      }
      this.recorder = null;
    }
    if (this.playbackCtx) {
      try {
        this.playbackCtx.close();
      } catch {
        /* ignore */
      }
      this.playbackCtx = null;
    }
    try {
      AudioManager.setAudioSessionActivity(false);
    } catch {
      /* ignore */
    }
    this.opts.onPhase('idle');
  }

  // ── incoming messages ────────────────────────────────────────────────────

  private onMessage(event: any): void {
    const data = event?.data;
    if (data instanceof ArrayBuffer) {
      this.handleBinary(data);
    } else if (typeof data === 'string') {
      try {
        this.handleJson(JSON.parse(data));
      } catch {
        /* ignore non-JSON */
      }
    }
  }

  private handleBinary(buffer: ArrayBuffer): void {
    const bytes = new Uint8Array(buffer);
    // A binary frame may actually be JSON (starts with '{').
    if (bytes.length > 0 && bytes[0] === 0x7b) {
      try {
        let text = '';
        for (let i = 0; i < bytes.length; i++) text += String.fromCharCode(bytes[i]);
        this.handleJson(JSON.parse(text));
        return;
      } catch {
        /* fall through — treat as raw audio */
      }
    }
    // Raw PCM16 audio at 24 kHz.
    if (buffer.byteLength >= 2) {
      const pcm16 = new Int16Array(buffer);
      const float32 = new Float32Array(pcm16.length);
      for (let i = 0; i < pcm16.length; i++) float32[i] = pcm16[i] / 32768.0;
      if (!this.connected) this.markConnected();
      this.playChunk(float32);
    }
  }

  private handleJson(data: any): void {
    if (!data) return;

    if (typeof data.type === 'string') {
      this.opts.onEvent?.(data);
      // IMPORTANT: do NOT markConnected() on 'context_loaded'. The proxy sends
      // that event the instant the client connects — BEFORE Gemini has finished
      // its setup handshake. markConnected() starts the mic, which streams
      // realtimeInput audio; Gemini rejects audio sent before its setupComplete
      // and closes the socket (protocol violation). That's exactly why voice
      // dropped instantly during a workout: the large workout system prompt
      // makes Gemini's setup slower, so mic audio beats setupComplete and kills
      // the session (→ onClosed → "Voice chat ended"). In plain chat the tiny
      // prompt sets up fast enough to win the race, so it seemed to "work".
      // We now wait for Gemini's setupComplete (below) before starting the mic.
      return;
    }

    if (data.setupComplete) {
      this.markConnected();
      return;
    }

    if (data.serverContent) {
      const sc = data.serverContent;
      if (sc.modelTurn?.parts) {
        for (const part of sc.modelTurn.parts) {
          if (part.inlineData?.data) {
            const float32 = this.base64ToFloat32(part.inlineData.data);
            if (!this.connected) this.markConnected();
            this.playChunk(float32);
          }
          if (part.text) this.opts.onTranscript?.('kin', part.text);
        }
      }
      if (sc.inputTranscription?.text) this.opts.onTranscript?.('user', sc.inputTranscription.text);
      if (sc.outputTranscription?.text) this.opts.onTranscript?.('kin', sc.outputTranscription.text);
      if (sc.turnComplete && this.active) this.opts.onPhase('listening');
    }
  }

  private markConnected(): void {
    if (this.connected || !this.active) return;
    this.connected = true;
    if (this.connectTimer) {
      clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }
    this.opts.onPhase('listening');
    this.startAudioStream();
  }

  // ── outgoing mic audio ────────────────────────────────────────────────────

  private startAudioStream(): void {
    if (this.audioStreamStarted || !this.recorder) return;
    this.audioStreamStarted = true;
    // Begins delivering PCM frames to onMicBuffer (registered in start()).
    Promise.resolve(this.recorder.start()).catch(() => {
      /* surfaced via onError elsewhere */
    });
  }

  private onMicBuffer(event: any): void {
    const ws = this.ws;
    if (!ws || ws.readyState !== 1 /* OPEN */) return;

    const buffer = event?.buffer;
    if (!buffer || typeof buffer.getChannelData !== 'function') return;
    let input: Float32Array = buffer.getChannelData(0);
    // The mic hardware picks its own rate (often 44.1/48 kHz) regardless of the
    // rate we requested — using it verbatim while claiming 16 kHz makes Gemini
    // hear garbled/too-fast audio (no transcript, no reply). Read the ACTUAL
    // rate and resample to the 16 kHz Gemini Live expects.
    const srcRate =
      typeof buffer.sampleRate === 'number' && isFinite(buffer.sampleRate)
        ? Math.round(buffer.sampleRate)
        : INPUT_SAMPLE_RATE;

    // Half-duplex guard: while Kin's audio is still scheduled to play, don't
    // stream the mic (prevents the model's own voice echoing back and cutting
    // it off). BUT only when the playback clock is actually running — if the
    // context is suspended/stalled, currentTime freezes while nextPlayTime keeps
    // growing, which would mute the mic FOREVER (Kin never hears us again).
    // When suspended there's no audio playing, so there's nothing to echo.
    const pbState = (this.playbackCtx as any)?.state;
    if (
      this.playbackCtx &&
      pbState !== 'suspended' &&
      this.playbackCtx.currentTime < this.nextPlayTime - 0.05
    ) {
      return;
    }

    if (srcRate !== INPUT_SAMPLE_RATE) {
      input = this.resampleTo16k(input, srcRate);
    }
    const pcm16 = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      pcm16[i] = Math.max(-32768, Math.min(32767, Math.round(input[i] * 32767)));
    }
    const base64 = this.arrayBufferToBase64(pcm16.buffer);
    try {
      ws.send(
        JSON.stringify({
          realtimeInput: {
            audio: { data: base64, mimeType: `audio/pcm;rate=${INPUT_SAMPLE_RATE}` },
          },
        })
      );
    } catch {
      /* ignore transient send failures */
    }
  }

  /** Linear-interpolation downsample from an arbitrary rate to 16 kHz. */
  private resampleTo16k(input: Float32Array, srcRate: number): Float32Array {
    if (srcRate === INPUT_SAMPLE_RATE || input.length === 0) return input;
    const ratio = srcRate / INPUT_SAMPLE_RATE;
    const outLen = Math.max(1, Math.floor(input.length / ratio));
    const out = new Float32Array(outLen);
    for (let i = 0; i < outLen; i++) {
      const idx = i * ratio;
      const i0 = Math.floor(idx);
      const i1 = Math.min(i0 + 1, input.length - 1);
      out[i] = input[i0] + (input[i1] - input[i0]) * (idx - i0);
    }
    return out;
  }

  // ── playback ──────────────────────────────────────────────────────────────

  private playChunk(float32: Float32Array): void {
    const ctx = this.playbackCtx;
    if (!ctx || float32.length === 0) return;

    // Resume if the context started/became suspended — otherwise no sound plays
    // and its clock (currentTime) never advances. The web engine already does
    // this; the native one was missing it.
    try {
      if ((ctx as any).state && (ctx as any).state !== 'running') (ctx as any).resume?.();
    } catch {
      /* ignore */
    }

    const buffer = ctx.createBuffer(1, float32.length, OUTPUT_SAMPLE_RATE);
    buffer.getChannelData(0).set(float32);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);

    const now = ctx.currentTime;
    const startAt = Math.max(now + 0.005, this.nextPlayTime);
    src.start(startAt);
    this.nextPlayTime = startAt + buffer.duration;

    if (this.active) this.opts.onPhase('speaking');
    src.onEnded = () => {
      if (this.active && this.playbackCtx && this.playbackCtx.currentTime >= this.nextPlayTime - 0.02) {
        this.opts.onPhase('listening');
      }
    };
  }

  // ── base64 helpers (no browser atob/btoa on native) ───────────────────────

  private static readonly B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    const chars = NativeVoiceLive.B64;
    let out = '';
    let i = 0;
    for (; i + 2 < bytes.length; i += 3) {
      const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
      out += chars[(n >> 18) & 63] + chars[(n >> 12) & 63] + chars[(n >> 6) & 63] + chars[n & 63];
    }
    const rem = bytes.length - i;
    if (rem === 1) {
      const n = bytes[i] << 16;
      out += chars[(n >> 18) & 63] + chars[(n >> 12) & 63] + '==';
    } else if (rem === 2) {
      const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
      out += chars[(n >> 18) & 63] + chars[(n >> 12) & 63] + chars[(n >> 6) & 63] + '=';
    }
    return out;
  }

  private base64ToFloat32(base64: string): Float32Array {
    const chars = NativeVoiceLive.B64;
    const lookup = new Uint8Array(256);
    for (let i = 0; i < chars.length; i++) lookup[chars.charCodeAt(i)] = i;
    let len = base64.length;
    let pad = 0;
    if (len > 0 && base64[len - 1] === '=') pad++;
    if (len > 1 && base64[len - 2] === '=') pad++;
    const byteLen = (len * 3) / 4 - pad;
    const bytes = new Uint8Array(byteLen);
    let p = 0;
    for (let i = 0; i < len; i += 4) {
      const e1 = lookup[base64.charCodeAt(i)];
      const e2 = lookup[base64.charCodeAt(i + 1)];
      const e3 = lookup[base64.charCodeAt(i + 2)];
      const e4 = lookup[base64.charCodeAt(i + 3)];
      const n = (e1 << 18) | (e2 << 12) | (e3 << 6) | e4;
      if (p < byteLen) bytes[p++] = (n >> 16) & 255;
      if (p < byteLen) bytes[p++] = (n >> 8) & 255;
      if (p < byteLen) bytes[p++] = n & 255;
    }
    // Interpret bytes as little-endian PCM16 → normalized float32.
    const int16 = new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 2));
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768.0;
    return float32;
  }
}
