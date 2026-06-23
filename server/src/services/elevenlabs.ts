/**
 * ELEVENLABS SERVICE — Text-to-Speech (Streaming)
 *
 * Converts text to speech audio using ElevenLabs API.
 * Returns audio as a Buffer (MP3 format) for streaming to the client.
 */

import { env } from '../config/env';
import pRetry from 'p-retry';

const ELEVENLABS_BASE_URL = 'https://api.elevenlabs.io/v1';

/**
 * Convert text to speech audio.
 * Returns MP3 audio buffer.
 */
export async function textToSpeech(
  text: string,
  voiceId?: string
): Promise<Buffer> {
  const voice = voiceId || env.elevenlabsVoiceIdMale || 'CwhRBWXzGAHq6TQ4Fs17';

  const audioBuffer = await pRetry(
    async () => {
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
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`ElevenLabs error ${response.status}: ${error}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    },
    {
      retries: 2,
      minTimeout: 2000,
      factor: 2,
    }
  );

  return audioBuffer;
}
