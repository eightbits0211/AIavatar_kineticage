/**
 * WEB VOICE LIVE (Gemini Live speech-to-speech)
 *
 * Drives a hands-free, continuous voice-to-voice conversation in the browser
 * by streaming audio to the backend's Gemini Live WebSocket proxy
 * (`/ws/voice-live`) and playing the spoken reply back in real time.
 *
 *   mic (16 kHz PCM) ──► our server proxy ──► Gemini Live
 *   speaker (24 kHz PCM) ◄── our server proxy ◄── Gemini Live
 *
 * Unlike the older record → STT → chat → TTS loop, this is true real-time
 * speech-to-speech: no per-turn round trips, no ElevenLabs dependency, and the
 * model both listens and speaks continuously. The user just talks; Kin talks
 * back.
 *
 * This mirrors the reference client at `server/public/voice-live.html` exactly
 * (same audio formats and JSON message shapes), so it works against the
 * existing proxy with no server changes.
 *
 * Browser globals are accessed loosely (`globalThis as any`) so this compiles
 * in the React Native TS project without the DOM lib. It is only instantiated
 * on web (Platform.OS === 'web').
 */

const g = globalThis as any;

export type VoiceLivePhase = 'idle' | 'connecting' | 'listening' | 'speaking';

interface WebVoiceLiveOptions {
  /** WebSocket base, e.g. "ws://localhost:3000". */
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
  /**
   * Fired when the WebSocket connection fails or drops before/without a
   * successful session (so the caller can fall back to REST voice).
   */
  onError?: () => void;
  /**
   * App-level proxy events (any JSON message carrying a `type`), e.g.
   * `context_loaded`, `onboarding_progress`, `onboarding_complete`,
   * `bundles_generated`, `session_started`. Used mainly by voice onboarding.
   */
  onEvent?: (event: any) => void;
}

// Gemini Live audio formats (fixed by the API / proxy).
const INPUT_SAMPLE_RATE = 16000; // mic capture + upload
const OUTPUT_SAMPLE_RATE = 24000; // model audio playback
const PROCESSOR_BUFFER = 4096;

export class WebVoiceLive {
  private opts: WebVoiceLiveOptions;
  private ws: any = null;
  private mediaStream: any = null;
  private inputCtx: any = null;
  private playbackCtx: any = null;
  private sourceNode: any = null;
  private processorNode: any = null;
  private active = false;
  private connected = false;
  private audioStreamStarted = false;
  private nextPlayTime = 0;

  constructor(opts: WebVoiceLiveOptions) {
    this.opts = opts;
  }

  isActive(): boolean {
    return this.active;
  }

  /**
   * Send a workout control action to the proxy (the sole DB writer during voice
   * mode), e.g. sendAction('complete_set', { actual_reps: 12 }),
   * sendAction('skip_exercise'), sendAction('report_pain', { body_area: 'knee' }).
   */
  sendAction(action: string, extra?: Record<string, any>): void {
    const ws = this.ws;
    if (!ws || ws.readyState !== 1 /* OPEN */) return;
    try {
      ws.send(JSON.stringify({ action, ...(extra || {}) }));
    } catch {
      /* ignore */
    }
  }

  /**
   * Acquire the mic, open the proxy WebSocket, and begin streaming. Throws if
   * mic access is denied so the caller can prompt the user. Resolves once the
   * connection is established (audio continues in the background until stop()).
   */
  async start(): Promise<void> {
    this.active = true;
    this.opts.onPhase('connecting');

    if (!g.navigator?.mediaDevices?.getUserMedia) {
      this.active = false;
      throw new Error('Microphone not supported in this browser');
    }

    // 1. Microphone (mono, 16 kHz preferred).
    this.mediaStream = await g.navigator.mediaDevices.getUserMedia({
      audio: {
        // NOTE: do NOT force sampleRate here. Chrome's acoustic echo canceller
        // runs in the native capture pipeline (~48 kHz); pinning the mic to
        // 16 kHz can silently disable it, so Kin's own voice leaks in and the
        // model interrupts itself. The inputCtx AudioContext below already
        // resamples the stream to 16 kHz, so the capture rate doesn't matter.
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    // 2. Separate audio contexts for capture (16 kHz) and playback (24 kHz).
    const Ctx = g.AudioContext || g.webkitAudioContext;
    this.inputCtx = new Ctx({ sampleRate: INPUT_SAMPLE_RATE });
    this.playbackCtx = new Ctx({ sampleRate: OUTPUT_SAMPLE_RATE });
    try {
      await this.inputCtx.resume();
    } catch {
      /* ignore */
    }
    try {
      await this.playbackCtx.resume();
    } catch {
      /* ignore */
    }

    // 3. Open the proxy WebSocket.
    let url = `${this.opts.wsBaseUrl}/ws/voice-live?`;
    const params: string[] = [];
    if (this.opts.token) params.push(`token=${encodeURIComponent(this.opts.token)}`);
    if (this.opts.sessionId) params.push(`session_id=${encodeURIComponent(this.opts.sessionId)}`);
    if (this.opts.bundleId) params.push(`bundle_id=${encodeURIComponent(this.opts.bundleId)}`);
    if (this.opts.voiceStyle) params.push(`voice_style=${encodeURIComponent(this.opts.voiceStyle)}`);
    url += params.join('&');

    const ws = new g.WebSocket(url);
    ws.binaryType = 'arraybuffer';
    this.ws = ws;

    ws.onopen = () => {
      // Wait for Gemini setupComplete / context_loaded before streaming mic.
    };
    ws.onmessage = (event: any) => this.onMessage(event);
    ws.onerror = () => {
      if (this.active && !this.connected) this.opts.onError?.();
    };
    ws.onclose = (event: any) => {
      // Failed before we ever connected → signal the caller to fall back to REST.
      const failedToConnect = this.active && !this.connected;
      this.stop();
      if (failedToConnect) this.opts.onError?.();
    };
  }

  /** Exit voice mode and release all audio + socket resources. */
  stop(): void {
    this.active = false;
    this.connected = false;
    this.audioStreamStarted = false;
    this.nextPlayTime = 0;

    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        /* ignore */
      }
      this.ws = null;
    }
    if (this.processorNode) {
      try {
        this.processorNode.disconnect();
      } catch {
        /* ignore */
      }
      this.processorNode = null;
    }
    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch {
        /* ignore */
      }
      this.sourceNode = null;
    }
    if (this.mediaStream) {
      try {
        this.mediaStream.getTracks().forEach((t: any) => t.stop());
      } catch {
        /* ignore */
      }
      this.mediaStream = null;
    }
    if (this.inputCtx) {
      try {
        this.inputCtx.close();
      } catch {
        /* ignore */
      }
      this.inputCtx = null;
    }
    if (this.playbackCtx) {
      try {
        this.playbackCtx.close();
      } catch {
        /* ignore */
      }
      this.playbackCtx = null;
    }
    this.opts.onPhase('idle');
  }

  // ── incoming messages ────────────────────────────────────────────────────

  private onMessage(event: any): void {
    const data = event?.data;
    if (data instanceof ArrayBuffer) {
      this.handleBinary(data);
    } else if (typeof data === 'string') {
      this.handleJsonText(data);
    } else if (data && typeof data.arrayBuffer === 'function') {
      // Fallback if binaryType wasn't honored and we got a Blob.
      data.arrayBuffer().then((buf: ArrayBuffer) => this.handleBinary(buf));
    }
  }

  private handleBinary(buffer: ArrayBuffer): void {
    const bytes = new Uint8Array(buffer);
    // A binary frame may actually be JSON (starts with '{').
    if (bytes.length > 0 && bytes[0] === 0x7b) {
      try {
        const text = new g.TextDecoder().decode(buffer);
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

  private handleJsonText(text: string): void {
    try {
      this.handleJson(JSON.parse(text));
    } catch {
      /* ignore non-JSON */
    }
  }

  private handleJson(data: any): void {
    if (!data) return;

    // App-level proxy events (context_loaded, onboarding_*, bundles_*, etc.)
    // all carry a `type`. Surface them to the caller (voice onboarding relies
    // on this) and stop — none of them carry audio.
    if (typeof data.type === 'string') {
      this.opts.onEvent?.(data);
      if (data.type === 'context_loaded' && !this.connected) this.markConnected();
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
    this.opts.onPhase('listening');
    this.startAudioStream();
  }

  // ── outgoing mic audio ────────────────────────────────────────────────────

  private startAudioStream(): void {
    if (this.audioStreamStarted) return;
    if (!this.mediaStream || !this.inputCtx || !this.ws) return;
    this.audioStreamStarted = true;

    this.sourceNode = this.inputCtx.createMediaStreamSource(this.mediaStream);
    this.processorNode = this.inputCtx.createScriptProcessor(PROCESSOR_BUFFER, 1, 1);

    this.processorNode.onaudioprocess = (e: any) => {
      const ws = this.ws;
      if (!ws || ws.readyState !== 1 /* OPEN */) return;

      // Half-duplex guard: while Kin's audio is still scheduled to play, don't
      // stream the mic. On speakers the model's own voice leaks back into the
      // mic and Gemini Live treats it as the user barging in — cutting Kin off
      // after a few words. Muting the mic during playback prevents that echo
      // loop. (Playback catches up → nextPlayTime passes → mic resumes.)
      if (this.playbackCtx && this.playbackCtx.currentTime < this.nextPlayTime - 0.05) {
        return;
      }

      const input = e.inputBuffer.getChannelData(0);
      const pcm16 = new Int16Array(input.length);
      for (let i = 0; i < input.length; i++) {
        pcm16[i] = Math.max(-32768, Math.min(32767, Math.round(input[i] * 32767)));
      }
      const base64 = this.arrayBufferToBase64(pcm16.buffer);
      ws.send(
        JSON.stringify({
          realtimeInput: {
            audio: { data: base64, mimeType: `audio/pcm;rate=${INPUT_SAMPLE_RATE}` },
          },
        })
      );
    };

    this.sourceNode.connect(this.processorNode);
    this.processorNode.connect(this.inputCtx.destination);
  }

  // ── playback ──────────────────────────────────────────────────────────────

  private playChunk(float32: Float32Array): void {
    const ctx = this.playbackCtx;
    if (!ctx || float32.length === 0) return;
    if (ctx.state === 'suspended') {
      try {
        ctx.resume();
      } catch {
        /* ignore */
      }
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
    src.onended = () => {
      if (this.active && this.playbackCtx && this.playbackCtx.currentTime >= this.nextPlayTime - 0.02) {
        this.opts.onPhase('listening');
      }
    };
  }

  // ── encoding helpers ────────────────────────────────────────────────────

  private base64ToFloat32(base64: string): Float32Array {
    const binary = g.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const int16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768.0;
    return float32;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk) as unknown as number[]);
    }
    return g.btoa(binary);
  }
}
