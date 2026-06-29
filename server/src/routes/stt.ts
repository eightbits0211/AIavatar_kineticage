import { Router, Response } from 'express';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { transcribeAudio } from '../services/deepgram';
import multer from 'multer';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB max

/**
 * POST /api/stt/transcribe
 * Accepts audio file, returns transcribed text.
 * Content-Type: multipart/form-data with "audio" field.
 *
 * On service failure, returns 200 with error field (not 500).
 * This lets the mobile app gracefully fall back to text input.
 */
router.post('/transcribe', authMiddleware, upload.single('audio'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'Bad Request', message: 'Audio file is required (field: "audio")' });
      return;
    }

    const result = await transcribeAudio(req.file.buffer, req.file.mimetype);

    if (result.error) {
      // Service failed but we don't crash — return friendly error
      res.json({
        transcript: '',
        confidence: 0,
        error: result.error,
        fallback: true,
      });
      return;
    }

    if (!result.transcript || result.transcript.trim().length === 0) {
      res.json({ transcript: '', confidence: 0, message: 'No speech detected' });
      return;
    }

    res.json({ transcript: result.transcript, confidence: result.confidence });
  } catch (error: any) {
    console.error('STT route error:', error.message);
    // Graceful fallback — never crash the client
    res.json({
      transcript: '',
      confidence: 0,
      error: 'Voice recognition is temporarily unavailable. Please try typing instead.',
      fallback: true,
    });
  }
});

export default router;
