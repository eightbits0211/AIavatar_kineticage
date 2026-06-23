import { Router, Response } from 'express';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { textToSpeech } from '../services/elevenlabs';

const router = Router();

/**
 * POST /api/tts/stream
 * Converts text to speech and returns audio (MP3).
 * Request body: { text: string, voice_id?: string }
 * Response: audio/mpeg binary stream
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
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to generate speech', service: 'elevenlabs' });
  }
});

export default router;
