/**
 * WEB PUSH-TO-TALK RECORDER
 *
 * A minimal one-utterance recorder for the browser, used as the REST fallback
 * when the real-time voice WebSocket (webVoiceLive) is unavailable:
 *
 *   start() → user speaks → stop() → Blob → /api/stt/transcribe → chat → TTS
 *
 * This is deliberately simple (tap to start, tap to stop) — no VAD — mirroring
 * the native press-to-talk path. Browser globals are accessed loosely so this
 * compiles in the React Native TS project; it's only used on web.
 */

const g = globalThis as any;

function pickMimeType(): string {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
  const MR = g.MediaRecorder;
  if (MR && typeof MR.isTypeSupported === 'function') {
    for (const c of candidates) {
      if (MR.isTypeSupported(c)) return c;
    }
  }
  return '';
}

export class WebPushToTalk {
  private stream: any = null;
  private recorder: any = null;
  private chunks: any[] = [];

  /** Acquire the mic and begin recording. Throws if mic access is denied. */
  async start(): Promise<void> {
    if (!g.navigator?.mediaDevices?.getUserMedia) {
      throw new Error('Microphone not supported in this browser');
    }
    this.stream = await g.navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    const mimeType = pickMimeType();
    this.recorder = mimeType
      ? new g.MediaRecorder(this.stream, { mimeType })
      : new g.MediaRecorder(this.stream);
    this.chunks = [];
    this.recorder.ondataavailable = (e: any) => {
      if (e.data && e.data.size > 0) this.chunks.push(e.data);
    };
    this.recorder.start();
  }

  /** Stop recording and resolve with the captured audio Blob (or null). */
  stop(): Promise<Blob | null> {
    return new Promise<Blob | null>((resolve) => {
      const rec = this.recorder;
      if (!rec) {
        this.cleanup();
        resolve(null);
        return;
      }
      rec.onstop = () => {
        const type = rec.mimeType || 'audio/webm';
        const blob = new g.Blob(this.chunks, { type });
        this.cleanup();
        resolve(blob && blob.size > 0 ? blob : null);
      };
      try {
        rec.stop();
      } catch {
        this.cleanup();
        resolve(null);
      }
    });
  }

  private cleanup(): void {
    try {
      this.stream?.getTracks().forEach((t: any) => t.stop());
    } catch {
      /* ignore */
    }
    this.stream = null;
    this.recorder = null;
    this.chunks = [];
  }
}
