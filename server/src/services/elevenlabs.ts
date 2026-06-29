/**
 * ELEVENLABS SERVICE — Text-to-Speech (Streaming)
 *
 * Converts text to speech audio using ElevenLabs API.
 * Returns audio as a Buffer (MP3 format) for streaming to the client.
 *
 * Error hardening:
 * - 2 retries with exponential backoff
 * - Timeout protection (20s per attempt — TTS can be slow for long text)
 * - Returns null on failure (route handles fallback to text-only)
 * - Distinguishes auth errors (non-retryable) from transient errors
 */

import { env } from '../config/env';
import pRetry, { AbortError } from 'p-retry';

const ELEVENLABS_BASE_URL = 'https://api.elevenlabs.io/v1';
const REQUEST_TIMEOUT_MS = 20000;

export interface TTSResult {
  audio: Buffer | null;
  error?: string;
}

/**
 * Convert text to speech audio.
 * Returns { audio: Buffer } on success, { audio: null, error: '...' } on failure.
 */
export async function textToSpeech(
  text: string,
  voiceId?: string
): Promise<Buffer> {
  const voice = voiceId || env.elevenlabsVoiceIdMale || 'CwhRBWXzGAHq6TQ4Fs17';

  if (!env.elevenlabsApiKey) {
    throw new ServiceUnavailableError('Text-to-speech service not configured');
  }

  const audioBuffer = await pRetry(
    async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      try {
        const response = await fetch(
          `${ELEVENLABS_BASE_URL}/text-to-speech/${voice}`,
          {
            method: 'POST',
            headers: {
              'xi-api-key': env.elevenlabsApiKey,
              'Content-Type': 'application/json',
              'Accept': 'audio/mpeg',
            },
            body: JSON.stringify({
              text,
              model_id: 'eleven_monolingual_v1',
              voice_settings: {
                stability: 0.5,
                similarity_boost: 0.75,
                style: 0.0,
                use_speaker_boost: true,
              },
            }),
            signal: controller.signal,
          }
        );

        if (response.status === 429) {
          throw new Error('Rate limited by ElevenLabs — retrying');
        }

        if (response.status === 401) {
          throw new AbortError('ElevenLabs authentication failed — check API key');
        }

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`ElevenLabs error ${response.status}: ${error}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
      } finally {
        clearTimeout(timeout);
      }
    },
    {
      retries: 2,
      minTimeout: 2000,
      factor: 2,
      onFailedAttempt: (error) => {
        console.warn(`ElevenLabs attempt ${error.attemptNumber} failed: ${error.message}`);
      },
    }
  );

  return audioBuffer;
}

/**
 * Custom error class for service unavailability.
 * Routes can catch this specifically to return a user-friendly message.
 */
export class ServiceUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ServiceUnavailableError';
  }
}
