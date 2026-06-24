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
 */
router.post('/transcribe', authMiddleware, upload.single('audio'), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'Bad Request', message: 'Audio file is required (field: "audio")' });
      return;
    }

    const { transcript, confidence } = await transcribeAudio(req.file.buffer, req.file.mimetype);

    if (!transcript || transcript.trim().length === 0) {
      res.json({ transcript: '', confidence: 0, message: 'No speech detected' });
      return;
    }

    res.json({ transcript, confidence });
  } catch (error: any) {
    console.error('STT error:', error.message);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to transcribe audio', service: 'deepgram' });
  }
});

export default router;
