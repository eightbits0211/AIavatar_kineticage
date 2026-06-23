/**
 * DEEPGRAM SERVICE — Speech-to-Text
 *
 * Accepts audio buffer, returns transcribed text.
 * Uses Deepgram's REST API with Nova-2 model.
 */

import { env } from '../config/env';
import pRetry from 'p-retry';

const DEEPGRAM_API_URL = 'https://api.deepgram.com/v1/listen';

export interface TranscriptionResult {
  transcript: string;
  confidence: number;
}

/**
 * Transcribe audio buffer to text.
 * Accepts WAV, MP3, WebM, or any common audio format.
 */
export async function transcribeAudio(audioBuffer: Buffer, mimetype: string = 'audio/wav'): Promise<TranscriptionResult> {
  const result = await pRetry(
    async () => {
      const response = await fetch(
        `${DEEPGRAM_API_URL}?model=nova-2&language=en&smart_format=true&punctuate=true`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Token ${env.deepgramApiKey}`,
            'Content-Type': mimetype,
          },
          body: audioBuffer,
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Deepgram error ${response.status}: ${error}`);
      }

      const data = await response.json() as any;
      const transcript = data?.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
      const confidence = data?.results?.channels?.[0]?.alternatives?.[0]?.confidence || 0;

      return { transcript, confidence };
    },
    {
      retries: 2,
      minTimeout: 2000,
      factor: 2,
    }
  );

  return result;
}
