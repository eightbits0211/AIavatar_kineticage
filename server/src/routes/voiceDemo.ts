/**
 * VOICE DEMO ROUTE
 * 
 * A self-contained endpoint for testing the full voice pipeline:
 * Audio in → Deepgram STT → Gemini AI → ElevenLabs TTS → Audio out
 * 
 * NO AUTH required (demo/testing only — remove before production).
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import { transcribeAudio } from '../services/deepgram';
import { textToSpeech } from '../services/elevenlabs';
import { sendCompanionMessage } from '../services/claude';
import { basePersonality } from '../prompts/basePersonality';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// In-memory conversation history for the demo
const demoHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [];

/**
 * POST /api/voice-demo/talk
 * Full pipeline: audio → text → AI → audio
 * Accepts multipart/form-data with "audio" field (webm/wav)
 * Returns JSON with transcript, reply, and base64 audio
 */
router.post('/talk', upload.single('audio'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No audio file provided' });
      return;
    }

    // Step 1: STT
    const { transcript, confidence } = await transcribeAudio(req.file.buffer, req.file.mimetype);
    
    if (!transcript || transcript.trim().length === 0) {
      res.json({ transcript: '', reply: "Sorry, I didn't catch that. Could you try again?", audio: null });
      return;
    }

    // Step 2: AI (Gemini)
    const systemPrompt = `${basePersonality}\n\n## Demo Context\nThis is a voice demo. Keep responses short (1-3 sentences) and conversational. The user is testing the voice pipeline.\n\nIMPORTANT: Do NOT use markdown formatting (no asterisks, no bold, no bullet points, no headers). Your response will be read aloud by a text-to-speech engine. Write in plain conversational text only.`;
    
    demoHistory.push({ role: 'user', content: transcript });
    // Keep last 6 turns
    while (demoHistory.length > 6) demoHistory.shift();

    const { reply } = await sendCompanionMessage(systemPrompt, demoHistory.slice(0, -1), transcript);
    demoHistory.push({ role: 'assistant', content: reply });

    // Step 3: TTS
    let audioBase64: string | null = null;
    try {
      // Strip markdown formatting before sending to TTS
      const cleanReply = stripMarkdown(reply);
      const audioBuffer = await textToSpeech(cleanReply);
      audioBase64 = audioBuffer.toString('base64');
    } catch (ttsErr: any) {
      console.error('TTS failed (returning text only):', ttsErr.message);
    }

    res.json({
      transcript,
      confidence,
      reply,
      audio: audioBase64, // base64 MP3, or null if TTS failed
    });
  } catch (error: any) {
    console.error('Voice demo error:', error.message);
    res.status(500).json({ error: 'Pipeline failed', message: error.message });
  }
});

/**
 * POST /api/voice-demo/text
 * Text-only mode (no STT needed): text → AI → audio
 */
router.post('/text', async (req: Request, res: Response) => {
  try {
    const { message } = req.body;
    if (!message) {
      res.status(400).json({ error: 'message is required' });
      return;
    }

    const systemPrompt = `${basePersonality}\n\n## Demo Context\nThis is a demo. Keep responses short (1-3 sentences).\n\nIMPORTANT: Do NOT use markdown formatting. No asterisks, no bold, no bullet points. Write in plain conversational text only — this will be read aloud.`;
    
    demoHistory.push({ role: 'user', content: message });
    while (demoHistory.length > 6) demoHistory.shift();

    const { reply } = await sendCompanionMessage(systemPrompt, demoHistory.slice(0, -1), message);
    demoHistory.push({ role: 'assistant', content: reply });

    let audioBase64: string | null = null;
    try {
      const cleanReply = stripMarkdown(reply);
      const audioBuffer = await textToSpeech(cleanReply);
      audioBase64 = audioBuffer.toString('base64');
    } catch (ttsErr: any) {
      console.error('TTS failed:', ttsErr.message);
    }

    res.json({ reply, audio: audioBase64 });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed', message: error.message });
  }
});

/**
 * POST /api/voice-demo/reset
 * Clears conversation history
 */
router.post('/reset', (req: Request, res: Response) => {
  demoHistory.length = 0;
  res.json({ message: 'Conversation reset' });
});

/**
 * Strip markdown formatting so TTS doesn't read asterisks, hashes, etc.
 */
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')   // **bold** → bold
    .replace(/\*(.*?)\*/g, '$1')       // *italic* → italic
    .replace(/#{1,6}\s?/g, '')         // ### headers
    .replace(/`(.*?)`/g, '$1')         // `code`
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // [link](url) → link
    .replace(/[_~]/g, '')              // underscores, strikethrough
    .replace(/^\s*[-*+]\s/gm, '')      // bullet points
    .replace(/^\s*\d+\.\s/gm, '')      // numbered lists
    .trim();
}

export default router;
