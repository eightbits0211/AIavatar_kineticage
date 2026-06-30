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
import {
  OnboardingState,
  buildOnboardingPrompt,
  parseExtractions,
  applyExtraction,
  finalizeOnboarding,
  stripExtractionMarkers,
  ONBOARDING_FIELDS,
  extractFieldFromUserSpeech,
  extractAnyFieldFromSpeech,
} from './voiceOnboarding';

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
  // Onboarding mode
  mode: 'onboarding' | 'workout' | 'chat';
  onboardingState: OnboardingState | null;
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

  // Determine mode: onboarding vs workout vs chat
  let mode: 'onboarding' | 'workout' | 'chat';
  let onboardingState: OnboardingState | null = null;
  let systemPrompt: string;

  if (!user.onboarding_completed) {
    mode = 'onboarding';
    onboardingState = {
      currentFieldIndex: 0,
      collectedFields: {},
      isComplete: false,
      failedAttempts: 0,
    };
    // Pre-fill any fields already on the user doc
    if (user.name && user.name !== 'Guest') {
      onboardingState.collectedFields.name = user.name;
      onboardingState.currentFieldIndex = 1;
    }
    systemPrompt = buildOnboardingPrompt(user, onboardingState);
    console.log('[VoiceLive] Mode: ONBOARDING');
  } else if (activeSession || activeBundle) {
    mode = 'workout';
    systemPrompt = buildVoiceSystemPrompt(user, activeSession, activeBundle);
    console.log('[VoiceLive] Mode: WORKOUT');
  } else {
    mode = 'chat';
    systemPrompt = buildVoiceSystemPrompt(user, null, null);
    console.log('[VoiceLive] Mode: CHAT (no active bundle)');
  }

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
    mode,
    onboardingState,
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
    mode: voiceSession.mode,
    session: activeSession ? { id: activeSession._id, status: activeSession.status } : null,
    bundle: activeBundle ? {
      id: activeBundle._id,
      title: activeBundle.title,
      focus: activeBundle.focus,
      exercise_count: activeBundle.exercises.length,
    } : null,
    user: { name: user.name, persona_tags: user.persona_tags },
    onboarding: voiceSession.mode === 'onboarding' ? {
      progress: 0,
      fieldsTotal: ONBOARDING_FIELDS.length,
    } : null,
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

    // WORKOUT MODE: Check for action intents in AI response
    if (session.mode === 'workout') {
      detectAndExecuteActions(session, text);
    }
  }

  // On turn complete, save the full turn
  if (data.serverContent?.turnComplete) {
    if (session.turnBuffer.trim()) {
      if (session.mode !== 'onboarding') {
        persistTurn(session, 'companion', session.turnBuffer.trim());
      }
      session.turnBuffer = '';
    }
  }

  // Capture input transcription (what user said)
  if (data.serverContent?.inputTranscription?.text) {
    const userText = data.serverContent.inputTranscription.text;

    // ONBOARDING MODE: Extract structured data from user's speech
    if (session.mode === 'onboarding' && session.onboardingState) {
      // Try to extract ALL possible fields from what the user said
      let extractedAny = false;
      let attempts = 0;
      const tempCollected = { ...session.onboardingState.collectedFields };

      // Keep extracting until no more fields can be found in this utterance
      while (attempts < 12) {
        attempts++;
        const extraction = extractAnyFieldFromSpeech(userText, tempCollected);
        if (!extraction) break;

        tempCollected[extraction.field] = extraction.value;
        applyExtraction(session.onboardingState, extraction.field, extraction.value);
        extractedAny = true;
        console.log(`[VoiceLive/Onboarding] Extracted ${extraction.field} = ${JSON.stringify(extraction.value)}`);

        const collected = Object.keys(session.onboardingState.collectedFields).length;
        const total = ONBOARDING_FIELDS.length;
        session.clientWs.send(JSON.stringify({
          type: 'onboarding_progress',
          field: extraction.field,
          value: extraction.value,
          fieldsRemaining: total - collected,
          progress: Math.round((collected / total) * 100),
        }));
      }

      if (!extractedAny) {
        session.onboardingState.failedAttempts++;
        if (session.onboardingState.failedAttempts >= 5) {
          const missing = ONBOARDING_FIELDS.filter(f => session.onboardingState!.collectedFields[f] === undefined);
          session.clientWs.send(JSON.stringify({
            type: 'onboarding_type_fallback',
            field: missing[0] || 'unknown',
            message: `Having trouble catching some details. You can type your ${missing[0]?.replace(/_/g, ' ') || 'info'} below.`,
          }));
        }
      } else {
        session.onboardingState.failedAttempts = 0;
      }

      // Check if onboarding is complete
      if (session.onboardingState.isComplete) {
        handleOnboardingComplete(session);
      }
    } else if (session.mode !== 'onboarding') {
      persistTurn(session, 'user', userText);
    }
  }
}

/**
 * Handle onboarding completion — save profile, run personalization, generate bundles, notify client.
 */
async function handleOnboardingComplete(session: VoiceSession) {
  if (!session.onboardingState) return;

  try {
    console.log('[VoiceLive/Onboarding] All fields collected! Finalizing...');
    const result = await finalizeOnboarding(session.userObjectId, session.onboardingState);

    // Notify client of onboarding complete
    session.clientWs.send(JSON.stringify({
      type: 'onboarding_complete',
      persona_tags: result.persona_tags,
      calculated_metrics: result.calculated_metrics,
      message: 'Onboarding complete! Generating your first workout...',
    }));

    console.log('[VoiceLive/Onboarding] Complete! Persona:', result.persona_tags);

    // Auto-generate bundles
    try {
      const { generateBundles } = await import('./rulesEngine');
      const user = await User.findById(session.userObjectId);
      if (user) {
        const bundleResult = await generateBundles({ user: user as any, recentMuscleGroups: [] });

        if (bundleResult.bundles.length > 0) {
          // Store bundles
          const mongoose = await import('mongoose');
          const setId = new mongoose.default.Types.ObjectId();
          const storedBundles = await Bundle.insertMany(
            bundleResult.bundles.map(bundle => ({
              user_id: user._id,
              title: bundle.title,
              is_recommended: bundle.is_recommended,
              estimated_duration_min: bundle.estimated_duration_min,
              estimated_calorie_burn: bundle.estimated_calorie_burn,
              exercises: bundle.exercises.map(e => ({
                exercise_id: e.exercise_id,
                name: e.name,
                workout_phase: e.workout_phase,
                sets: e.sets,
                rep_min: e.rep_min,
                rep_max: e.rep_max,
                rest_seconds: e.rest_seconds,
                instructions_text: e.instructions_text,
                image_url: e.image_url,
                image_url_end: e.image_url_end || '',
                muscle_groups: e.muscle_groups,
              })),
              focus: bundle.focus,
              generation_context: {
                persona_tags: user.persona_tags,
                fitness_goal: user.fitness_goal,
                excluded_exercises: [],
                recent_muscle_groups: [],
              },
              set_id: setId,
              active: true,
            }))
          );

          // Notify client of bundles ready
          session.clientWs.send(JSON.stringify({
            type: 'bundles_generated',
            bundles: storedBundles.map(b => ({
              id: b._id,
              title: b.title,
              focus: b.focus,
              is_recommended: b.is_recommended,
              exercise_count: b.exercises.length,
              estimated_duration_min: b.estimated_duration_min,
            })),
            message: 'Your personalized workout options are ready!',
          }));

          console.log(`[VoiceLive/Onboarding] Generated ${storedBundles.length} bundles`);
        }
      }
    } catch (genErr) {
      console.error('[VoiceLive/Onboarding] Bundle generation error:', (genErr as Error).message);
      session.clientWs.send(JSON.stringify({
        type: 'bundles_generation_failed',
        message: 'Workouts generated. Disconnect and click Start again to pick your workout.',
      }));
    }

    // Switch mode to chat
    session.mode = 'chat';
  } catch (err) {
    console.error('[VoiceLive/Onboarding] Finalization error:', (err as Error).message);
    session.clientWs.send(JSON.stringify({
      type: 'onboarding_error',
      message: 'Failed to save profile. Please try again.',
    }));
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
  } else if (data.action === 'onboarding_typed_input') {
    // User typed a value for an onboarding field
    handleTypedOnboardingInput(session, data.field, data.value);
  }
}

/**
 * Handle typed fallback input for onboarding.
 */
function handleTypedOnboardingInput(session: VoiceSession, field: string, value: string) {
  if (!session.onboardingState || session.mode !== 'onboarding') return;

  // Try to extract from typed text using the flexible extractor
  const extraction = extractAnyFieldFromSpeech(value, session.onboardingState.collectedFields);
  if (extraction) {
    applyExtraction(session.onboardingState, extraction.field, extraction.value);
    session.onboardingState.failedAttempts = 0;
    const collected = Object.keys(session.onboardingState.collectedFields).length;
    console.log(`[VoiceLive/Onboarding] Typed input: ${extraction.field} = ${JSON.stringify(extraction.value)}`);
    session.clientWs.send(JSON.stringify({
      type: 'onboarding_progress',
      field: extraction.field,
      value: extraction.value,
      fieldsRemaining: ONBOARDING_FIELDS.length - collected,
      progress: Math.round((collected / ONBOARDING_FIELDS.length) * 100),
    }));
  } else {
    // Try raw parsing for the specified field
    const rawValue = parseRawTypedValue(field, value);
    if (rawValue !== null) {
      applyExtraction(session.onboardingState, field, rawValue);
      session.onboardingState.failedAttempts = 0;
      const collected = Object.keys(session.onboardingState.collectedFields).length;
      session.clientWs.send(JSON.stringify({
        type: 'onboarding_progress',
        field,
        value: rawValue,
        fieldsRemaining: ONBOARDING_FIELDS.length - collected,
        progress: Math.round((collected / ONBOARDING_FIELDS.length) * 100),
      }));
    } else {
      // Give specific validation feedback
      const hint = getValidationHint(field);
      session.clientWs.send(JSON.stringify({
        type: 'onboarding_type_fallback',
        field,
        message: `That doesn't look right. ${hint}`,
      }));
    }
  }

  if (session.onboardingState.isComplete) {
    handleOnboardingComplete(session);
  }
}

/**
 * Get user-friendly validation hint for a field.
 */
function getValidationHint(field: string): string {
  const hints: Record<string, string> = {
    name: 'Just type your name.',
    age: 'Type a number between 16 and 100.',
    gender: 'Type: male, female, other, or prefer_not_to_say',
    height: 'Type your height in cm (e.g. 170) or feet (e.g. 5\'10).',
    weight: 'Type your weight in kg (e.g. 70) or lbs (e.g. 154).',
    fitness_goal: 'Type one of: strength, hypertrophy, mobility, general_fitness, weight_loss, home_workout',
    activity_level: 'Type one of: sedentary, lightly_active, moderately_active, very_active',
    workout_location: 'Type one of: gym, home, outdoors, hybrid',
    equipment: 'Type equipment separated by commas (e.g. dumbbells, barbell) or "none".',
    injuries: 'Type injury areas separated by commas (e.g. knee, shoulder) or "none".',
    workout_duration: 'Type: 15, 30, 45, or 60',
    prior_experience: 'Type: yes or no',
  };
  return hints[field] || 'Please try again.';
}

/**
 * Parse raw typed value — more lenient than speech extraction.
 */
function parseRawTypedValue(field: string, value: string): any {
  const v = value.trim();
  switch (field) {
    case 'name': return v.length > 0 ? v : null;
    case 'age': { const n = parseInt(v); return (n >= 16 && n <= 100) ? n : null; }
    case 'height': { const n = parseFloat(v); return (n >= 50 && n <= 280) ? n : null; }
    case 'weight': { const n = parseFloat(v); return (n >= 20 && n <= 400) ? n : null; }
    case 'workout_duration': { const n = parseInt(v); return [15, 30, 45, 60].includes(n) ? n : null; }
    case 'gender': return ['male', 'female', 'other', 'prefer_not_to_say'].includes(v.toLowerCase()) ? v.toLowerCase() : null;
    case 'fitness_goal': return ['strength', 'hypertrophy', 'mobility', 'general_fitness', 'weight_loss', 'home_workout'].includes(v.toLowerCase()) ? v.toLowerCase() : null;
    case 'activity_level': return ['sedentary', 'lightly_active', 'moderately_active', 'very_active'].includes(v.toLowerCase()) ? v.toLowerCase() : null;
    case 'workout_location': return ['gym', 'home', 'outdoors', 'hybrid'].includes(v.toLowerCase()) ? v.toLowerCase() : null;
    case 'equipment': return v.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    case 'injuries': return v.toLowerCase() === 'none' ? ['none'] : v.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    case 'prior_experience': return ['yes', 'true', '1'].includes(v.toLowerCase()) ? true : ['no', 'false', '0'].includes(v.toLowerCase()) ? false : null;
    default: return null;
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

/**
 * Sensible defaults for onboarding fields when extraction fails 3 times.
 */
function getFieldDefault(field: string): any {
  const defaults: Record<string, any> = {
    name: 'Friend',
    age: 28,
    gender: 'prefer_not_to_say',
    height: 170,
    weight: 70,
    fitness_goal: 'general_fitness',
    activity_level: 'moderately_active',
    workout_location: 'gym',
    equipment: ['dumbbells'],
    injuries: ['none'],
    workout_duration: 30,
    prior_experience: false,
  };
  return defaults[field] || null;
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
