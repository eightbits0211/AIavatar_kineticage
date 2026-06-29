import { Router, Response } from 'express';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { textToSpeech, ServiceUnavailableError } from '../services/elevenlabs';

const router = Router();

/**
 * POST /api/tts/stream
 * Converts text to speech and returns audio (MP3).
 * Request body: { text: string, voice_id?: string }
 * Response: audio/mpeg binary stream
 *
 * On service failure, returns JSON with error message and the original text.
 * This lets the mobile app display the text instead of playing audio.
 */
router.post('/stream', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { text, voice_id } = req.body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      res.status(400).json({ error: 'Bad Request', message: 'text is required' });
      return;
    }

    // Limit text length to prevent abuse (max ~500 chars per request)
    const trimmedText = text.trim().substring(0, 500);

    const audioBuffer = await textToSpeech(trimmedText, voice_id);

    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': audioBuffer.length.toString(),
      'Cache-Control': 'no-cache',
    });

    res.send(audioBuffer);
  } catch (error: any) {
    console.error('TTS error:', error.message);

    // Return the text so the app can display it instead of playing audio
    const fallbackText = req.body?.text?.trim()?.substring(0, 500) || '';

    if (error instanceof ServiceUnavailableError) {
      res.status(200).json({
        error: 'service_unavailable',
        message: 'Voice is temporarily unavailable. Here\'s what Kira wanted to say:',
        text: fallbackText,
        fallback: true,
      });
    } else {
      res.status(200).json({
        error: 'tts_failed',
        message: 'Could not generate audio. Showing text instead.',
        text: fallbackText,
        fallback: true,
      });
    }
  }
});

export default router;
