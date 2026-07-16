import { Router, Response } from 'express';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { textToSpeech, ServiceUnavailableError, getVoiceIdForStyle } from '../services/elevenlabs';
import { User } from '../models';

const router = Router();

/**
 * POST /api/tts/stream
 * Converts text to speech and returns audio (MP3).
 * Request body: { text: string, voice_id?: string, voice_style?: string }
 * Response: audio/mpeg binary stream
 *
 * Voice priority: voice_id (explicit) > voice_style (from body) > user's saved preference > default
 *
 * On service failure, returns JSON with error message and the original text.
 * This lets the mobile app display the text instead of playing audio.
 */
router.post('/stream', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { text, voice_id, voice_style } = req.body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      res.status(400).json({ error: 'Bad Request', message: 'text is required' });
      return;
    }

    // Resolve voice ID: explicit > style from request > user preference > default
    let resolvedVoiceId = voice_id;
    if (!resolvedVoiceId) {
      if (voice_style) {
        resolvedVoiceId = getVoiceIdForStyle(voice_style);
      } else {
        // Look up user's saved voice_style preference
        const user = await User.findOne({ firebase_uid: req.uid }).select('companion_preferences').lean();
        const savedStyle = (user as any)?.companion_preferences?.voice_style;
        resolvedVoiceId = getVoiceIdForStyle(savedStyle);
      }
    }

    // Limit text length to prevent abuse (max ~500 chars per request)
    const trimmedText = text.trim().substring(0, 500);

    const audioBuffer = await textToSpeech(trimmedText, resolvedVoiceId);

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
        message: 'Voice is temporarily unavailable. Here\'s what Kin wanted to say:',
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
