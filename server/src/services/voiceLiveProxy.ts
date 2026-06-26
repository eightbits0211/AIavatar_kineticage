/**
 * VOICE LIVE PROXY SERVICE
 *
 * Server-side WebSocket proxy between the client and Gemini Live API.
 *
 * Flow:
 *   Client ←WebSocket→ This Server ←WebSocket→ Gemini Live API
 *
 * The server:
 * 1. Authenticates the client (Firebase JWT)
 * 2. Builds the full system prompt (persona, Rules Engine data, session state)
 * 3. Opens a WebSocket to Gemini Live with that context
 * 4. Relays audio frames in both directions
 * 5. Intercepts JSON messages to detect action intents (done, skip, pain)
 * 6. Updates session state in MongoDB when actions are detected
 * 7. Persists conversation turns for history
 *
 * This keeps the Rules Engine in full control while enabling real-time voice.
 */

import WebSocket from 'ws';
import { IncomingMessage } from 'http';
import admin from 'firebase-admin';
import { User, Session, Bundle } from '../models';
import { SessionTurn } from '../models/SessionTurn';
import { buildSystemPrompt } from '../prompts/buildPrompt';
import { env } from '../config/env';

const GEMINI_WS_URL = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${env.geminiApiKey}`;
const MODEL = 'gemini-3.1-flash-live-preview';

interface VoiceSession {
  userId: string;
  userObjectId: any;
  sessionId: string | null;
  bundleId: string | null;
  clientWs: WebSocket;
  geminiWs: WebSocket | null;
  currentExerciseIndex: number;
  currentSetIndex: number;
  turnBuffer: string;
}

const activeSessions = new Map<WebSocket, VoiceSession>();

/**
 * Handles a new client WebSocket connection for voice live.
 * Called from the WebSocket server setup in index.ts.
 */
export async function handleVoiceLiveConnection(clientWs: WebSocket, req: IncomingMessage) {
  console.log('[VoiceLive] New connection attempt');

  // Parse query params from URL
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const token = url.searchParams.get('token');
  const sessionId = url.searchParams.get('session_id') || null;
  const bundleId = url.searchParams.get('bundle_id') || null;
  const voice = url.searchParams.get('voice') || 'Kore';

  // Authenticate
  let uid: string;
  if (token) {
    try {
      const decoded = await admin.auth().verifyIdToken(token);
      uid = decoded.uid;
    } catch (err) {
      console.error('[VoiceLive] Auth failed:', (err as Error).message);
      clientWs.close(4001, 'Authentication failed');
      return;
    }
  } else {
    // Demo mode — no auth required (for testing)
    uid = '__demo__';
  }

  // Load user and context
  const user = uid === '__demo__'
    ? await User.findOne({ onboarding_completed: true })
    : await User.findOne({ firebase_uid: uid });

  if (!user) {
    clientWs.close(4004, 'User not found');
    return;
  }

  // Load active session and bundle
  let activeSession: any = null;
  let activeBundle: any = null;

  if (sessionId) {
    activeSession = await Session.findById(sessionId).lean();
  } else {
    activeSession = await Session.findOne({ user_id: user._id, status: 'in_progress' }).lean();
  }

  if (bundleId) {
    activeBundle = await Bundle.findById(bundleId).lean();
  } else if (activeSession) {
    activeBundle = await Bundle.findById(activeSession.bundle_id).lean();
  } else {
    activeBundle = await Bundle.findOne({ user_id: user._id, active: true, is_recommended: true }).lean();
    if (!activeBundle) {
      activeBundle = await Bundle.findOne({ user_id: user._id, active: true }).lean();
    }
  }

  // Build system prompt
  const systemPrompt = buildVoiceSystemPrompt(user, activeSession, activeBundle);

  // Create session tracker
  const voiceSession: VoiceSession = {
    userId: uid,
    userObjectId: user._id,
    sessionId: activeSession?._id?.toString() || null,
    bundleId: activeBundle?._id?.toString() || null,
    clientWs,
    geminiWs: null,
    currentExerciseIndex: activeSession
      ? activeSession.exercises.findIndex((e: any) => e.status === 'pending' || e.status === 'in_progress')
      : 0,
    currentSetIndex: 0,
    turnBuffer: '',
  };
  activeSessions.set(clientWs, voiceSession);

  // Connect to Gemini Live
  const geminiWs = new WebSocket(GEMINI_WS_URL);
  voiceSession.geminiWs = geminiWs;

  geminiWs.on('open', () => {
    console.log('[VoiceLive] Connected to Gemini, sending setup...');

    const setup = {
      setup: {
        model: `models/${MODEL}`,
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voice }
            }
          }
        },
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        }
      }
    };
    geminiWs.send(JSON.stringify(setup));
  });

  // Relay Gemini → Client
  geminiWs.on('message', (data: WebSocket.Data, isBinary: boolean) => {
    if (clientWs.readyState !== WebSocket.OPEN) return;

    if (isBinary || Buffer.isBuffer(data)) {
      // Binary frame — could be audio or binary-encoded JSON
      const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);

      // Check if it's JSON (starts with '{')
      if (buffer.length > 0 && buffer[0] === 0x7B) {
        try {
          const text = buffer.toString('utf-8');
          const json = JSON.parse(text);
          handleGeminiJson(voiceSession, json);
          // Forward to client as text
          clientWs.send(text);
          return;
        } catch (e) {
          // Not JSON — raw audio, relay as binary
        }
      }

      // Relay audio binary directly to client
      clientWs.send(buffer, { binary: true });
    } else {
      // Text frame — JSON
      const text = data.toString();
      try {
        const json = JSON.parse(text);
        handleGeminiJson(voiceSession, json);
      } catch (e) {
        // Not JSON
      }
      // Forward as-is to client
      clientWs.send(text);
    }
  });

  geminiWs.on('close', (code, reason) => {
    console.log(`[VoiceLive] Gemini closed: ${code} ${reason.toString()}`);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.close(1000, 'Gemini session ended');
    }
    cleanup(clientWs);
  });

  geminiWs.on('error', (err) => {
    console.error('[VoiceLive] Gemini error:', err.message);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.close(1011, 'Gemini connection error');
    }
    cleanup(clientWs);
  });

  // Relay Client → Gemini
  clientWs.on('message', (data: WebSocket.Data, isBinary: boolean) => {
    if (!geminiWs || geminiWs.readyState !== WebSocket.OPEN) return;

    if (isBinary || Buffer.isBuffer(data)) {
      // Binary audio from client → relay to Gemini
      geminiWs.send(data, { binary: true });
    } else {
      // Text (JSON) from client
      const text = data.toString();

      // Check for client-side action messages (do NOT relay to Gemini)
      try {
        const json = JSON.parse(text);
        if (json.action) {
          // This is a command for our server, not for Gemini
          handleClientMessage(voiceSession, json);
          return;
        }
      } catch (e) {
        // Not JSON, just relay
      }

      // Relay everything else to Gemini (audio input, etc.)
      geminiWs.send(text);
    }
  });

  clientWs.on('close', () => {
    console.log('[VoiceLive] Client disconnected');
    if (geminiWs && geminiWs.readyState === WebSocket.OPEN) {
      geminiWs.close();
    }
    cleanup(clientWs);
  });

  clientWs.on('error', (err) => {
    console.error('[VoiceLive] Client error:', err.message);
    cleanup(clientWs);
  });

  // Send initial context info to client
  clientWs.send(JSON.stringify({
    type: 'context_loaded',
    session: activeSession ? { id: activeSession._id, status: activeSession.status } : null,
    bundle: activeBundle ? {
      id: activeBundle._id,
      title: activeBundle.title,
      focus: activeBundle.focus,
      exercise_count: activeBundle.exercises.length,
    } : null,
    user: { name: user.name, persona_tags: user.persona_tags },
  }));
}

/**
 * Handle JSON messages from Gemini (intercept transcriptions and intents).
 */
function handleGeminiJson(session: VoiceSession, data: any) {
  // Capture output transcription for persistence
  if (data.serverContent?.outputTranscription?.text) {
    const text = data.serverContent.outputTranscription.text;
    session.turnBuffer += text;

    // Check for action intents in the response
    detectAndExecuteActions(session, text);
  }

  // On turn complete, save the full turn
  if (data.serverContent?.turnComplete) {
    if (session.turnBuffer.trim()) {
      persistTurn(session, 'companion', session.turnBuffer.trim());
      session.turnBuffer = '';
    }
  }

  // Capture input transcription (what user said)
  if (data.serverContent?.inputTranscription?.text) {
    persistTurn(session, 'user', data.serverContent.inputTranscription.text);
  }
}

/**
 * Handle messages from the client (not audio — structured commands).
 */
function handleClientMessage(session: VoiceSession, data: any) {
  // Client can send explicit action commands
  if (data.action === 'complete_set') {
    markSetComplete(session, data.actual_reps);
  } else if (data.action === 'skip_exercise') {
    markExerciseSkipped(session, data.reason);
  } else if (data.action === 'report_pain') {
    reportPain(session, data.body_area);
  } else if (data.action === 'end_session') {
    // Will be handled by session end route
  }
}

/**
 * Detect action intents from Gemini's spoken response.
 * Looks for patterns that indicate the user completed a set, skipped, etc.
 */
function detectAndExecuteActions(session: VoiceSession, text: string) {
  const lower = text.toLowerCase();

  // Detect set completion acknowledgment
  if (lower.includes('great set') || lower.includes('nice work') ||
      lower.includes('set complete') || lower.includes('good job on that set') ||
      lower.includes('that\'s one set down') || lower.includes('set done')) {
    // Gemini acknowledged a completed set — mark it
    markSetComplete(session);
  }

  // Detect exercise skip
  if (lower.includes('skip') && (lower.includes('next exercise') || lower.includes('moving on'))) {
    markExerciseSkipped(session, 'user_requested');
  }

  // Detect pain acknowledgment
  if (lower.includes('pain') && (lower.includes('stop') || lower.includes('skip') || lower.includes('rest'))) {
    // Pain was acknowledged — the exercise update will come from explicit client action
  }
}

/**
 * Mark current set as complete in the database.
 */
async function markSetComplete(session: VoiceSession, actualReps?: number) {
  if (!session.sessionId) return;

  try {
    const dbSession = await Session.findById(session.sessionId);
    if (!dbSession || dbSession.status !== 'in_progress') return;

    const exercise = dbSession.exercises[session.currentExerciseIndex];
    if (!exercise) return;

    const set = exercise.sets[session.currentSetIndex];
    if (set && !set.completed) {
      set.completed = true;
      set.completed_at = new Date();
      set.actual_reps = actualReps || set.target_rep_max;
      exercise.status = 'in_progress';

      // Move to next set or next exercise
      session.currentSetIndex++;
      if (session.currentSetIndex >= exercise.sets.length) {
        // All sets done for this exercise
        exercise.status = 'completed';
        session.currentExerciseIndex++;
        session.currentSetIndex = 0;
      }

      await dbSession.save();
      console.log(`[VoiceLive] Set completed: exercise ${session.currentExerciseIndex}, set ${session.currentSetIndex}`);
    }
  } catch (err) {
    console.error('[VoiceLive] Error marking set complete:', (err as Error).message);
  }
}

/**
 * Mark current exercise as skipped.
 */
async function markExerciseSkipped(session: VoiceSession, reason?: string) {
  if (!session.sessionId) return;

  try {
    const dbSession = await Session.findById(session.sessionId);
    if (!dbSession || dbSession.status !== 'in_progress') return;

    const exercise = dbSession.exercises[session.currentExerciseIndex];
    if (!exercise) return;

    exercise.status = 'skipped';
    exercise.skip_reason = reason || null;
    session.currentExerciseIndex++;
    session.currentSetIndex = 0;

    await dbSession.save();
    console.log(`[VoiceLive] Exercise skipped: moving to index ${session.currentExerciseIndex}`);
  } catch (err) {
    console.error('[VoiceLive] Error skipping exercise:', (err as Error).message);
  }
}

/**
 * Record a pain event.
 */
async function reportPain(session: VoiceSession, bodyArea?: string) {
  if (!session.sessionId) return;

  try {
    const dbSession = await Session.findById(session.sessionId);
    if (!dbSession) return;

    const exercise = dbSession.exercises[session.currentExerciseIndex];
    dbSession.pain_events.push({
      exercise_id: exercise?.exercise_id,
      body_area: bodyArea || 'unspecified',
      timestamp: new Date(),
    } as any);

    if (exercise) {
      exercise.status = 'pain_stopped';
    }

    session.currentExerciseIndex++;
    session.currentSetIndex = 0;
    await dbSession.save();
    console.log(`[VoiceLive] Pain reported: ${bodyArea || 'unspecified'}`);
  } catch (err) {
    console.error('[VoiceLive] Error reporting pain:', (err as Error).message);
  }
}

/**
 * Persist a conversation turn.
 */
async function persistTurn(session: VoiceSession, role: 'user' | 'companion', content: string) {
  if (!session.sessionId || !content.trim()) return;

  try {
    await SessionTurn.create({
      session_id: session.sessionId,
      user_id: session.userObjectId,
      role,
      content: content.trim(),
      input_mode: 'voice',
      state_at_time: 'set_active',
      action_intent: null,
    });
  } catch (err) {
    // Non-critical — don't crash the session
    console.error('[VoiceLive] Error persisting turn:', (err as Error).message);
  }
}

/**
 * Build the full system prompt for a voice live session.
 */
function buildVoiceSystemPrompt(user: any, activeSession: any, activeBundle: any): string {
  // Build base prompt using existing prompt builder
  let sessionContext: any = undefined;
  if (activeSession && activeBundle) {
    const currentExercise = activeSession.exercises.find(
      (e: any) => e.status === 'in_progress' || e.status === 'pending'
    );
    if (currentExercise) {
      const completedSets = currentExercise.sets.filter((s: any) => s.completed).length;
      sessionContext = {
        bundle_title: activeBundle.title,
        current_exercise: currentExercise.exercise_name,
        current_set: completedSets + 1,
        total_sets: currentExercise.sets.length,
        target_reps: `${currentExercise.sets[0]?.target_rep_min}-${currentExercise.sets[0]?.target_rep_max}`,
        rest_seconds: currentExercise.rest_seconds,
        exercises_remaining: activeSession.exercises.filter(
          (e: any) => e.status === 'pending' || e.status === 'in_progress'
        ).length - 1,
      };
    }
  }

  let systemPrompt = buildSystemPrompt({ user, sessionContext, recentSummaries: [] });

  // Voice-specific rules
  systemPrompt += `

## Voice Session Rules
- You are speaking aloud in real-time. Keep ALL responses under 3 sentences during active exercise.
- NEVER use markdown, asterisks, bullet points, or any formatting — plain speech only.
- NEVER say weights in kg or lbs. Only say sets, rep ranges, and rest times.
- Wait for the user to greet you first before starting the workout. Don't jump into instructions immediately.
- When the user says "done", "finished", or "next" — acknowledge the completed set and give the next instruction.
- When the user says "skip" — move to the next exercise without judgment.
- When the user reports pain — STOP immediately, acknowledge, suggest rest, offer to skip or end.
- Announce each exercise clearly: name, sets, rep range, and one brief form cue.
- During rest periods, give brief encouragement or a form tip (1 sentence max).
- NEVER invent exercises. ONLY reference exercises listed in the Current Workout Plan below.
- If asked about an exercise not in the plan, say you can only coach what's in today's workout.`;

  // Add the workout plan from the Rules Engine
  if (activeBundle) {
    systemPrompt += `

## Current Workout Plan: "${activeBundle.title}"
Focus: ${activeBundle.focus} | Duration: ~${activeBundle.estimated_duration_min} min
Exercises in order:`;
    for (let i = 0; i < activeBundle.exercises.length; i++) {
      const ex = activeBundle.exercises[i];
      const status = activeSession?.exercises[i]?.status || 'pending';
      const statusLabel = status === 'completed' ? '✓ DONE' : status === 'skipped' ? '⏭ SKIPPED' : '';
      systemPrompt += `
${i + 1}. ${ex.name} ${statusLabel}
   Sets: ${ex.sets} | Reps: ${ex.rep_min}-${ex.rep_max} | Rest: ${ex.rest_seconds}s
   Form: ${(ex.instructions_text || '').substring(0, 150)}`;
    }
  } else {
    systemPrompt += `

## No Active Workout
The user doesn't have a workout loaded. Chat naturally about fitness, answer questions, or suggest they generate a new workout plan from the app.`;
  }

  // Gamification context
  systemPrompt += `

## User Stats
Level ${user.gamification?.level || 1} | ${user.gamification?.total_xp || 0} XP | Streak: ${user.gamification?.current_streak || 0} days`;

  return systemPrompt;
}

function cleanup(clientWs: WebSocket) {
  const session = activeSessions.get(clientWs);
  if (session) {
    if (session.geminiWs && session.geminiWs.readyState === WebSocket.OPEN) {
      session.geminiWs.close();
    }
    activeSessions.delete(clientWs);
  }
}
