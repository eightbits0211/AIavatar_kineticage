/**
 * DEEPGRAM SERVICE — Speech-to-Text
 *
 * Accepts audio buffer, returns transcribed text.
 * Uses Deepgram's REST API with Nova-2 model.
 *
 * Error hardening:
 * - 3 retries with exponential backoff
 * - Graceful fallback on total failure (returns empty transcript with error flag)
 * - Timeout protection (15s per attempt)
 */

import { env } from '../config/env';
import pRetry, { AbortError } from 'p-retry';

const DEEPGRAM_API_URL = 'https://api.deepgram.com/v1/listen';
const REQUEST_TIMEOUT_MS = 15000;

export interface TranscriptionResult {
  transcript: string;
  confidence: number;
  error?: string;
}

/**
 * Transcribe audio buffer to text.
 * Accepts WAV, MP3, WebM, or any common audio format.
 * On failure, returns { transcript: '', confidence: 0, error: '...' } instead of throwing.
 */
export async function transcribeAudio(audioBuffer: Buffer, mimetype: string = 'audio/wav'): Promise<TranscriptionResult> {
  if (!env.deepgramApiKey) {
    return { transcript: '', confidence: 0, error: 'Speech-to-text service not configured' };
  }

  if (!audioBuffer || audioBuffer.length === 0) {
    return { transcript: '', confidence: 0, error: 'No audio data received' };
  }

  try {
    const result = await pRetry(
      async () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

        try {
          const response = await fetch(
            `${DEEPGRAM_API_URL}?model=nova-2&language=en&smart_format=true&punctuate=true`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Token ${env.deepgramApiKey}`,
                'Content-Type': mimetype,
              },
              body: audioBuffer,
              signal: controller.signal,
            }
          );

          if (response.status === 429) {
            throw new Error('Rate limited by Deepgram — retrying');
          }

          if (response.status === 401 || response.status === 403) {
            throw new AbortError('Deepgram authentication failed — check API key');
          }

          if (!response.ok) {
            const error = await response.text();
            throw new Error(`Deepgram error ${response.status}: ${error}`);
          }

          const data = await response.json() as any;
          const transcript = data?.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
          const confidence = data?.results?.channels?.[0]?.alternatives?.[0]?.confidence || 0;

          return { transcript, confidence };
        } finally {
          clearTimeout(timeout);
        }
      },
      {
        retries: 2,
        minTimeout: 2000,
        factor: 2,
        onFailedAttempt: (error) => {
          console.warn(`Deepgram attempt ${error.attemptNumber} failed: ${error.message}`);
        },
      }
    );

    return result;
  } catch (error: any) {
    console.error('Deepgram service unavailable after retries:', error.message);
    return {
      transcript: '',
      confidence: 0,
      error: 'Voice recognition is temporarily unavailable. Please try typing instead.',
    };
  }
}
