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
  allBundles: any[];
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
 * Function declarations for Gemini Live tool calling.
 * These replace fragile phrase-matching with deterministic, reliable actions —
 * Gemini calls these based on user INTENT regardless of exact phrasing.
 */
function getWorkoutTools() {
  return [{
    functionDeclarations: [
      {
        name: 'start_workout',
        description: 'Call this when the user confirms they want to start a specific workout (e.g. says "start", "let\'s go", "the first one", picks a workout by name or number). Starts the session and begins coaching.',
        parameters: {
          type: 'OBJECT',
          properties: {
            bundle_choice: {
              type: 'STRING',
              description: 'Which workout the user picked — either the bundle title, "recommended", or a number like "1", "2", "3" referring to the list order.',
            },
          },
          required: ['bundle_choice'],
        },
      },
      {
        name: 'complete_set',
        description: 'Call this whenever the user indicates they finished a set — e.g. "done", "I did it", "finished that set", "I did 6 reps", or any confirmation of completing the current set. Always call this before praising them.',
        parameters: {
          type: 'OBJECT',
          properties: {
            actual_reps: {
              type: 'NUMBER',
              description: 'Number of reps the user actually completed, if they mentioned it. Omit if not mentioned.',
            },
          },
          required: [],
        },
      },
      {
        name: 'next_exercise',
        description: 'Call this when the user wants to FINISH the current exercise (having done it) and move on to the next one. This marks the current exercise COMPLETED (not skipped) and advances. Interpret loose phrasing: "what\'s next", "move on", "bring on the next one", "I\'m done with this exercise", "that was tough, what else", "next please". Use this (NOT skip) when the user has done the exercise and just wants to progress.',
        parameters: { type: 'OBJECT', properties: {}, required: [] },
      },
      {
        name: 'skip_exercise',
        description: 'Call this ONLY when the user wants to SKIP the current exercise WITHOUT doing it — e.g. "skip this", "I can\'t do this one", "let\'s not do this". If the user has done the exercise and just wants to move on, use next_exercise instead.',
        parameters: {
          type: 'OBJECT',
          properties: {
            reason: { type: 'STRING', description: 'Why they want to skip, if mentioned.' },
          },
          required: [],
        },
      },
      {
        name: 'pause_workout',
        description: 'Call this when the user wants to pause or take a break — e.g. "pause", "hold on", "give me a minute", "let\'s take a break", "stop for a sec".',
        parameters: { type: 'OBJECT', properties: {}, required: [] },
      },
      {
        name: 'resume_workout',
        description: 'Call this when the user wants to resume after a pause — e.g. "resume", "let\'s continue", "I\'m back", "okay keep going", "ready".',
        parameters: { type: 'OBJECT', properties: {}, required: [] },
      },
      {
        name: 'end_workout',
        description: 'Call this when the user wants to end/finish the workout early or is done for the day — e.g. "end the workout", "I\'m done for today", "wrap it up", "let\'s stop here", "that\'s enough", "finish the session". This ends the session and shows their summary.',
        parameters: { type: 'OBJECT', properties: {}, required: [] },
      },
      {
        name: 'report_pain',
        description: 'Call this immediately when the user mentions pain, discomfort, or injury during an exercise — e.g. "my knee hurts", "this is hurting my back", "ow", "that doesn\'t feel right". Always call this before responding with concern.',
        parameters: {
          type: 'OBJECT',
          properties: {
            body_area: { type: 'STRING', description: 'The body part in pain, e.g. "knee", "lower back", "shoulder".' },
          },
          required: ['body_area'],
        },
      },
    ],
  }];
}

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
  const voiceStyle = url.searchParams.get('voice_style') || url.searchParams.get('voice') || null;

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
  let allActiveBundles: any[] = [];

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
    // Load ALL active bundles for voice selection
    allActiveBundles = await Bundle.find({ user_id: user._id, active: true }).lean();
    activeBundle = allActiveBundles.find((b: any) => b.is_recommended) || allActiveBundles[0] || null;
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
  } else if (activeSession) {
    // In-progress session exists — enter workout mode but prompt about resuming
    mode = 'workout';
    systemPrompt = buildVoiceSystemPrompt(user, activeSession, activeBundle);
    // Add resume prompt to system instructions
    const completedCount = activeSession.exercises.filter((e: any) => e.status === 'completed').length;
    const totalCount = activeSession.exercises.length;
    const currentExercise = activeSession.exercises.find((e: any) => e.status === 'in_progress' || e.status === 'pending');
    systemPrompt += `

## IMPORTANT — FIRST MESSAGE
You have an unfinished workout from earlier (${completedCount}/${totalCount} exercises done). When the user greets you:
- Mention they have an unfinished workout (briefly: "${completedCount} of ${totalCount} exercises done, left off at ${currentExercise?.exercise_name || 'the next exercise'}")
- Ask: "Want to pick up where you left off, or start fresh with a new workout?"
- If they say resume/continue/yes → start coaching from the current exercise
- If they say new/fresh/different → tell them to generate a new workout from the app (you cannot generate bundles)
- Do NOT start coaching until they answer`;
    console.log('[VoiceLive] Mode: WORKOUT (session in progress — will ask about resume)');
  } else if (activeBundle) {
    // Bundle exists but user hasn't started a session — ask user before jumping in
    mode = 'chat';
    systemPrompt = buildVoiceSystemPrompt(user, null, activeBundle, allActiveBundles);
    console.log('[VoiceLive] Mode: CHAT (has bundle, will ask user)');
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
    allBundles: allActiveBundles,
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
  // Resolve voice style → Gemini voice name
  const VOICE_STYLE_TO_GEMINI: Record<string, string> = {
    calm: 'Aoede',         // Soft, soothing tone
    energetic: 'Kore',     // Energetic, upbeat tone
    friendly: 'Puck',      // Warm, casual tone
    professional: 'Charon', // Clear, focused tone
  };

  const resolvedVoiceStyle = voiceStyle
    || (user.companion_preferences as any)?.voice_style
    || 'friendly';
  const geminiVoiceName = VOICE_STYLE_TO_GEMINI[resolvedVoiceStyle] || 'Puck';

  const geminiWs = new WebSocket(GEMINI_WS_URL);
  voiceSession.geminiWs = geminiWs;

  // Load recent conversation history (from text chat) so voice continues seamlessly
  let conversationContext = '';
  if (activeSession?._id) {
    try {
      const recentTurns = await SessionTurn.find({ session_id: activeSession._id })
        .sort({ timestamp: -1 })
        .limit(6)
        .lean();
      if (recentTurns.length > 0) {
        const turns = recentTurns.reverse().map((t: any) =>
          `${t.role === 'companion' ? 'Kin' : 'User'}: ${t.content}`
        ).join('\n');
        conversationContext = `\n\n## Recent Conversation (from text chat — continue naturally)\n${turns}`;
      }
    } catch { /* non-critical */ }
  }
  const fullPrompt = systemPrompt + conversationContext;

  geminiWs.on('open', () => {
    console.log('[VoiceLive] Connected to Gemini, sending setup...');

    const setup = {
      setup: {
        model: `models/${MODEL}`,
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: geminiVoiceName }
            }
          }
        },
        systemInstruction: {
          parts: [{ text: fullPrompt }]
        },
        tools: getWorkoutTools(),
        // Reduce false VAD interruptions — Kin was cutting off mid-sentence when
        // the mic picked up background noise / echo and Gemini thought the user
        // was interrupting. LOW start sensitivity requires clearer speech to barge in.
        realtimeInputConfig: {
          automaticActivityDetection: {
            startOfSpeechSensitivity: 'START_SENSITIVITY_LOW',
            endOfSpeechSensitivity: 'END_SENSITIVITY_LOW',
            prefixPaddingMs: 300,
            silenceDurationMs: 800,
          },
        },
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
  // Deterministic function/tool calls — the primary mechanism for workout actions.
  // Replaces fragile phrase-matching with explicit, reliable calls from Gemini.
  if (data.toolCall?.functionCalls) {
    handleToolCall(session, data.toolCall.functionCalls);
    return;
  }

  // Capture output transcription for persistence
  if (data.serverContent?.outputTranscription?.text) {
    const text = data.serverContent.outputTranscription.text;
    session.turnBuffer += text;

    // WORKOUT MODE: Fallback phrase detection (in case a tool call wasn't triggered)
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

        // If multiple fields were extracted at once, tell Gemini to skip ahead
        const extractedCount = Object.keys(tempCollected).length - Object.keys(session.onboardingState.collectedFields).length + attempts;
        if (attempts > 1 && session.geminiWs && session.geminiWs.readyState === WebSocket.OPEN) {
          const remaining = ONBOARDING_FIELDS.filter(f => session.onboardingState!.collectedFields[f] === undefined);
          if (remaining.length > 0) {
            const skipMsg = `[SYSTEM: The user provided multiple answers at once. I've already collected: ${Object.keys(session.onboardingState.collectedFields).join(', ')}. Skip those and ask about: ${remaining[0].replace(/_/g, ' ')} next. Do NOT re-ask anything already collected.]`;
            session.geminiWs.send(JSON.stringify({
              clientContent: {
                turns: [{ role: 'user', parts: [{ text: skipMsg }] }],
                turnComplete: true,
              }
            }));
          }
        }
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
 * Handle a deterministic function/tool call from Gemini.
 * This is the reliable mechanism for workout actions — Gemini decides when to call
 * these based on user intent, regardless of exact phrasing (e.g. "done", "I did it",
 * "finished that", "6 reps" all map to the same complete_set call).
 */
async function handleToolCall(session: VoiceSession, functionCalls: any[]) {
  const responses: any[] = [];

  for (const fc of functionCalls) {
    const { name, args, id } = fc;
    console.log(`[VoiceLive] Tool call: ${name}`, args);

    let result: any = { status: 'ok' };

    try {
      switch (name) {
        case 'start_workout': {
          const choice = (args?.bundle_choice || '').toLowerCase();
          let chosenBundleId = session.bundleId;

          if (session.allBundles?.length > 1) {
            // Match by number ("1", "2", "first", "second")
            const numberMatch = choice.match(/\d+/);
            const ordinalMap: Record<string, number> = { first: 1, second: 2, third: 3, fourth: 4 };
            const ordinalMatch = Object.keys(ordinalMap).find(k => choice.includes(k));

            if (numberMatch) {
              const idx = parseInt(numberMatch[0]) - 1;
              if (session.allBundles[idx]) chosenBundleId = session.allBundles[idx]._id.toString();
            } else if (ordinalMatch) {
              const idx = ordinalMap[ordinalMatch] - 1;
              if (session.allBundles[idx]) chosenBundleId = session.allBundles[idx]._id.toString();
            } else if (choice.includes('recommend')) {
              const rec = session.allBundles.find((b: any) => b.is_recommended);
              if (rec) chosenBundleId = rec._id.toString();
            } else {
              // Match by title substring
              const match = session.allBundles.find((b: any) =>
                choice.includes(b.title.toLowerCase()) || b.title.toLowerCase().includes(choice)
              );
              if (match) chosenBundleId = match._id.toString();
            }
          }

          if (chosenBundleId) {
            await startSessionFromVoice(session, chosenBundleId);
            result = { status: 'ok', message: 'Session started' };
          } else {
            result = { status: 'error', message: 'No bundle available to start' };
          }
          break;
        }

        case 'complete_set': {
          if (session.sessionId) {
            await markSetComplete(session, args?.actual_reps);
            result = { status: 'ok', message: 'Set marked complete' };
          } else {
            result = { status: 'error', message: 'No active session' };
          }
          break;
        }

        case 'next_exercise': {
          if (session.sessionId) {
            await markExerciseComplete(session);
            result = { status: 'ok', message: 'Exercise completed, moved to next' };
          } else {
            result = { status: 'error', message: 'No active session' };
          }
          break;
        }

        case 'skip_exercise': {
          if (session.sessionId) {
            await markExerciseSkipped(session, args?.reason);
            result = { status: 'ok', message: 'Exercise skipped' };
          } else {
            result = { status: 'error', message: 'No active session' };
          }
          break;
        }

        case 'pause_workout': {
          if (session.sessionId) {
            await Session.findByIdAndUpdate(session.sessionId, { status: 'paused' });
            if (session.clientWs.readyState === WebSocket.OPEN) {
              session.clientWs.send(JSON.stringify({ type: 'workout_state', action: 'paused' }));
            }
            result = { status: 'ok', message: 'Workout paused' };
          } else {
            result = { status: 'error', message: 'No active session' };
          }
          break;
        }

        case 'resume_workout': {
          if (session.sessionId) {
            await Session.findByIdAndUpdate(session.sessionId, { status: 'in_progress' });
            if (session.clientWs.readyState === WebSocket.OPEN) {
              session.clientWs.send(JSON.stringify({ type: 'workout_state', action: 'resumed' }));
            }
            result = { status: 'ok', message: 'Workout resumed' };
          } else {
            result = { status: 'error', message: 'No active session' };
          }
          break;
        }

        case 'end_workout': {
          if (session.sessionId) {
            // Emit event so the frontend runs its existing end flow
            // (POST /api/session/:id/end → XP, badges, summary). Single source of
            // truth for end logic — we don't duplicate it here.
            if (session.clientWs.readyState === WebSocket.OPEN) {
              session.clientWs.send(JSON.stringify({
                type: 'session_end',
                session_id: session.sessionId,
              }));
              session.clientWs.send(JSON.stringify({
                type: 'workout_state',
                action: 'ended',
                session_id: session.sessionId,
              }));
            }
            result = { status: 'ok', message: 'Ending workout and showing summary' };
          } else {
            result = { status: 'error', message: 'No active session to end' };
          }
          break;
        }

        case 'report_pain': {
          if (session.sessionId) {
            await reportPain(session, args?.body_area);
            result = { status: 'ok', message: 'Pain reported, exercise stopped' };
          } else {
            result = { status: 'ok', message: 'Noted — no active exercise to stop' };
          }
          break;
        }

        default:
          result = { status: 'error', message: `Unknown function: ${name}` };
      }
    } catch (err) {
      console.error(`[VoiceLive] Tool call error (${name}):`, (err as Error).message);
      result = { status: 'error', message: (err as Error).message };
    }

    responses.push({ id, name, response: result });
  }

  // Send tool responses back to Gemini so it can continue the conversation
  if (session.geminiWs && session.geminiWs.readyState === WebSocket.OPEN) {
    session.geminiWs.send(JSON.stringify({
      toolResponse: { functionResponses: responses },
    }));
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

          // Update session state with bundles for voice selection
          session.allBundles = storedBundles;
          session.bundleId = storedBundles.find(b => b.is_recommended)?._id?.toString() || storedBundles[0]?._id?.toString() || null;

          // Reconnect to Gemini with a fresh chat+bundles system prompt
          // (Gemini Live doesn't support changing system prompt mid-session)
          if (session.geminiWs && session.geminiWs.readyState === WebSocket.OPEN) {
            session.geminiWs.close();
          }

          // Build new prompt with bundle selection context
          const freshUser = await User.findById(session.userObjectId);
          if (freshUser) {
            const recommendedBundle = storedBundles.find((b: any) => b.is_recommended) || storedBundles[0];
            const newPrompt = buildVoiceSystemPrompt(freshUser, null, recommendedBundle, storedBundles);

            // Reconnect
            const newGeminiWs = new WebSocket(GEMINI_WS_URL);
            session.geminiWs = newGeminiWs;

            newGeminiWs.on('open', () => {
              console.log('[VoiceLive] Reconnected to Gemini post-onboarding');

              // Resolve voice style
              const voiceStyleToGemini: Record<string, string> = {
                calm: 'Aoede', energetic: 'Kore', friendly: 'Puck', professional: 'Charon',
              };
              const style = (freshUser.companion_preferences as any)?.voice_style || 'friendly';
              const voiceName = voiceStyleToGemini[style] || 'Puck';

              const setup = {
                setup: {
                  model: `models/${MODEL}`,
                  generationConfig: {
                    responseModalities: ['AUDIO'],
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } }
                  },
                  systemInstruction: { parts: [{ text: newPrompt }] },
                  tools: getWorkoutTools(),
                  realtimeInputConfig: {
                    automaticActivityDetection: {
                      startOfSpeechSensitivity: 'START_SENSITIVITY_LOW',
                      endOfSpeechSensitivity: 'END_SENSITIVITY_LOW',
                      prefixPaddingMs: 300,
                      silenceDurationMs: 800,
                    },
                  },
                }
              };
              newGeminiWs.send(JSON.stringify(setup));

              // Trigger Gemini to present bundles
              setTimeout(() => {
                if (newGeminiWs.readyState === WebSocket.OPEN) {
                  newGeminiWs.send(JSON.stringify({
                    clientContent: {
                      turns: [{ role: 'user', parts: [{ text: 'Hi! My profile is set up. What workouts do you have for me?' }] }],
                      turnComplete: true,
                    }
                  }));
                }
              }, 1000);
            });

            // Wire up event relay (same as initial connection)
            newGeminiWs.on('message', (data: WebSocket.Data, isBinary: boolean) => {
              if (session.clientWs.readyState !== WebSocket.OPEN) return;
              if (isBinary || Buffer.isBuffer(data)) {
                const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
                if (buffer.length > 0 && buffer[0] === 0x7B) {
                  try {
                    const text = buffer.toString('utf-8');
                    const json = JSON.parse(text);
                    handleGeminiJson(session, json);
                    session.clientWs.send(text);
                    return;
                  } catch (e) { /* not JSON */ }
                }
                session.clientWs.send(buffer, { binary: true });
              } else {
                const text = data.toString();
                try { handleGeminiJson(session, JSON.parse(text)); } catch (e) { /* not JSON */ }
                session.clientWs.send(text);
              }
            });

            newGeminiWs.on('close', () => {
              if (session.clientWs.readyState === WebSocket.OPEN) {
                session.clientWs.close(1000, 'Gemini session ended');
              }
            });

            newGeminiWs.on('error', (err) => {
              console.error('[VoiceLive] Gemini reconnect error:', err.message);
            });
          }

          console.log(`[VoiceLive/Onboarding] Generated ${storedBundles.length} bundles — reconnecting for voice selection`);
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
  } else if (data.action === 'start_workout') {
    // Start a session from voice mode (auto or manual)
    startSessionFromVoice(session, data.bundle_id);
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

  // Inject the typed text into Gemini's conversation so it stays in sync
  if (session.geminiWs && session.geminiWs.readyState === WebSocket.OPEN) {
    const injectMessage = {
      clientContent: {
        turns: [{ role: 'user', parts: [{ text: value }] }],
        turnComplete: true,
      }
    };
    session.geminiWs.send(JSON.stringify(injectMessage));
  }

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

  // Auto-start session if Kin starts coaching but no session exists yet
  if (!session.sessionId && (session.bundleId || session.allBundles.length > 0)) {
    const coachingIndicators = ['first up', 'let\'s start with', 'sets of', 'reps', 'we\'re starting', 'let\'s go', 'here we go', 'starting with', 'begin with', 'your first exercise'];
    const isCoaching = coachingIndicators.some(ind => lower.includes(ind));
    if (isCoaching) {
      // Try to detect which bundle Kin chose by matching title in the response
      let chosenBundleId = session.bundleId;
      if (session.allBundles.length > 1) {
        for (const bundle of session.allBundles) {
          if (lower.includes(bundle.title.toLowerCase())) {
            chosenBundleId = bundle._id.toString();
            break;
          }
        }
      }
      if (chosenBundleId) {
        startSessionFromVoice(session, chosenBundleId);
      }
    }
  }

  // Detect set completion acknowledgment (broadened patterns)
  const setCompletePhrases = [
    'great set', 'nice work', 'set complete', 'good job', 'well done',
    'that\'s one set', 'set done', 'solid effort', 'good effort',
    'nice one', 'perfect', 'excellent', 'that\'s the set',
    'awesome set', 'strong set', 'crushed it', 'nailed it',
    'beautiful', 'take a rest', 'take a breather', 'rest up',
    'next set', 'set number', 'on to set',
  ];
  const isSetComplete = setCompletePhrases.some(p => lower.includes(p));
  // Avoid false triggers on general conversation (require workout mode)
  if (isSetComplete && session.mode === 'workout' && session.sessionId) {
    markSetComplete(session);
  }

  // Detect exercise completion / transition to next
  const exerciseCompletePhrases = [
    'next exercise', 'moving on to', 'on to the next', 'that\'s all for',
    'finished with', 'done with this exercise', 'let\'s move on',
  ];
  const isExerciseComplete = exerciseCompletePhrases.some(p => lower.includes(p));
  if (isExerciseComplete && session.mode === 'workout' && session.sessionId) {
    // Don't mark set complete — mark exercise as done and advance
    const currentSet = session.currentSetIndex;
    // If there are remaining sets, mark them all
    markExerciseComplete(session);
  }

  // Detect exercise skip
  if (lower.includes('skip') && (lower.includes('exercise') || lower.includes('moving on') || lower.includes('next one'))) {
    if (session.mode === 'workout' && session.sessionId) {
      markExerciseSkipped(session, 'user_requested');
    }
  }

  // Detect pain acknowledgment
  if (lower.includes('pain') && (lower.includes('stop') || lower.includes('skip') || lower.includes('rest'))) {
    // Pain was acknowledged — the exercise update will come from explicit client action
  }
}

/**
 * Auto-start a workout session from voice mode.
 * Called when Kin starts coaching and no session exists yet.
 */
async function startSessionFromVoice(session: VoiceSession, bundleId: string) {
  if (session.sessionId) return; // Already has a session

  try {
    const bundle = await Bundle.findById(bundleId);
    if (!bundle) return;

    // Check if a session already exists (created by REST at the same time)
    const existing = await Session.findOne({
      user_id: session.userObjectId,
      status: 'in_progress',
    });
    if (existing) {
      // Attach to existing session instead of creating duplicate
      session.sessionId = existing._id.toString();
      session.mode = 'workout';
      session.currentExerciseIndex = existing.exercises.findIndex(
        (e: any) => e.status === 'pending' || e.status === 'in_progress'
      );
      if (session.currentExerciseIndex < 0) session.currentExerciseIndex = 0;
      session.currentSetIndex = 0;
      console.log(`[VoiceLive] Attached to existing session: ${session.sessionId}`);

      if (session.clientWs.readyState === WebSocket.OPEN) {
        session.clientWs.send(JSON.stringify({
          type: 'session_started',
          session_id: session.sessionId,
          bundle_id: bundleId,
          resumed: true,
          exercises: existing.exercises.map((ex: any) => ({
            exercise_id: ex.exercise_id,
            name: ex.exercise_name,
            status: ex.status,
          })),
        }));
      }
      return;
    }

    const newSession = await Session.create({
      user_id: session.userObjectId,
      bundle_id: bundle._id,
      status: 'in_progress',
      started_at: new Date(),
      exercises: bundle.exercises.map((ex: any) => ({
        exercise_id: ex.exercise_id,
        exercise_name: ex.name,
        status: 'pending',
        sets: Array.from({ length: ex.sets }, (_, i) => ({
          set_number: i + 1,
          target_rep_min: ex.rep_min,
          target_rep_max: ex.rep_max,
          completed: false,
        })),
        rest_seconds: ex.rest_seconds,
        feedback: null,
      })),
      pain_events: [],
    });

    session.sessionId = newSession._id.toString();
    session.mode = 'workout';
    session.currentExerciseIndex = 0;
    session.currentSetIndex = 0;

    console.log(`[VoiceLive] Auto-started session: ${session.sessionId}`);

    // Notify client that session was auto-created
    if (session.clientWs.readyState === WebSocket.OPEN) {
      session.clientWs.send(JSON.stringify({
        type: 'session_started',
        session_id: session.sessionId,
        bundle_id: bundleId,
        exercises: bundle.exercises.map((ex: any) => ({
          exercise_id: ex.exercise_id,
          name: ex.name,
          sets: ex.sets,
          rep_min: ex.rep_min,
          rep_max: ex.rep_max,
          rest_seconds: ex.rest_seconds,
          image_url: ex.image_url,
        })),
      }));
    }
  } catch (err) {
    console.error('[VoiceLive] Error auto-starting session:', (err as Error).message);
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
      let action: 'set_complete' | 'exercise_complete' = 'set_complete';

      if (session.currentSetIndex >= exercise.sets.length) {
        // All sets done for this exercise
        exercise.status = 'completed';
        session.currentExerciseIndex++;
        session.currentSetIndex = 0;
        action = 'exercise_complete';
      }

      await dbSession.save();
      console.log(`[VoiceLive] Set completed: exercise ${session.currentExerciseIndex}, set ${session.currentSetIndex}`);

      // Notify client of authoritative state change
      if (session.clientWs.readyState === WebSocket.OPEN) {
        session.clientWs.send(JSON.stringify({
          type: 'workout_state',
          action,
          current_exercise_index: session.currentExerciseIndex,
          current_set_index: session.currentSetIndex,
          exercise_id: exercise.exercise_id,
          actual_reps: actualReps || set.target_rep_max,
        }));
      }
    }
  } catch (err) {
    console.error('[VoiceLive] Error marking set complete:', (err as Error).message);
  }
}

/**
 * Mark current exercise as fully complete (all sets done).
 * Used when Gemini says "moving on to next exercise" without individual set tracking.
 */
async function markExerciseComplete(session: VoiceSession) {
  if (!session.sessionId) return;

  try {
    const dbSession = await Session.findById(session.sessionId);
    if (!dbSession || dbSession.status !== 'in_progress') return;

    const exercise = dbSession.exercises[session.currentExerciseIndex];
    if (!exercise || exercise.status === 'completed') return;

    // Mark all sets as completed
    for (const set of exercise.sets) {
      if (!set.completed) {
        set.completed = true;
        set.completed_at = new Date();
        set.actual_reps = set.actual_reps || set.target_rep_max;
      }
    }
    exercise.status = 'completed';

    // Advance to next exercise
    session.currentExerciseIndex++;
    session.currentSetIndex = 0;

    await dbSession.save();
    console.log(`[VoiceLive] Exercise complete: moving to index ${session.currentExerciseIndex}`);

    // Notify client
    if (session.clientWs.readyState === WebSocket.OPEN) {
      session.clientWs.send(JSON.stringify({
        type: 'workout_state',
        action: 'exercise_complete',
        current_exercise_index: session.currentExerciseIndex,
        current_set_index: session.currentSetIndex,
        exercise_id: exercise.exercise_id,
      }));
    }
  } catch (err) {
    console.error('[VoiceLive] Error marking exercise complete:', (err as Error).message);
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

    // Notify client of authoritative state change
    if (session.clientWs.readyState === WebSocket.OPEN) {
      session.clientWs.send(JSON.stringify({
        type: 'workout_state',
        action: 'skipped',
        current_exercise_index: session.currentExerciseIndex,
        current_set_index: session.currentSetIndex,
        exercise_id: exercise.exercise_id,
      }));
    }
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

    // Notify client of authoritative state change
    if (session.clientWs.readyState === WebSocket.OPEN) {
      session.clientWs.send(JSON.stringify({
        type: 'workout_state',
        action: 'pain',
        current_exercise_index: session.currentExerciseIndex,
        current_set_index: session.currentSetIndex,
        exercise_id: exercise?.exercise_id || null,
        body_area: bodyArea || 'unspecified',
      }));
    }
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
function buildVoiceSystemPrompt(user: any, activeSession: any, activeBundle: any, allBundles: any[] = []): string {
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

## CRITICAL: Interpret INTENT, then Call Functions (this is your most important job)
You have these functions: start_workout, complete_set, next_exercise, skip_exercise, pause_workout, resume_workout, report_pain.

The user is a real person mid-workout. They will almost NEVER say clean commands like "done" or "skip".
They speak naturally and indirectly. Your job: for EVERY user utterance, first silently interpret what they MEAN,
then check if that meaning matches one of your functions. If it does, CALL that function (this is a real action
that logs their progress). If it genuinely matches nothing, just respond conversationally.

Interpret loose, natural, indirect phrasing — examples of real speech and the function each maps to:
- "phew, that was tough — what's next?" → next_exercise (they did it, want to advance)
- "okay bring on the next one" / "let's keep going" / "move on" → next_exercise
- "yeah I finished" / "that's my 10" / "got through it" / "all done with these" → complete_set
- "I did like 6 or 7" → complete_set (actual_reps ~6)
- "ugh my knee is acting up" / "that pinches a bit" → report_pain
- "hmm I'll pass on this one" / "can we skip this" / "not feeling this exercise" → skip_exercise
- "hold on gimme a sec" / "need a water break" → pause_workout
- "okay I'm back, let's go" / "ready again" → resume_workout
- "I'm done for today" / "wrap it up" / "let's stop here" / "that's enough for now" → end_workout
- "let's do it" / "yeah start" / "the first one sounds good" → start_workout

Rules:
- ALWAYS interpret intent first, then call the matching function BEFORE speaking. Don't wait for exact keywords.
- next_exercise = they DID the exercise and want to move on (marks it completed). skip_exercise = they did NOT do it.
- If unsure between two functions, pick the one that best matches what they actually did.
- After calling the function, respond naturally and briefly.
- If pain: call report_pain first, then stop/acknowledge, and append [ACTION:update_injuries] to your spoken text.
- Announce each exercise clearly: name, sets, rep range, one brief form cue.
- During rest, brief encouragement or form tip (1 sentence).
- NEVER invent exercises. ONLY reference exercises in the Current Workout Plan below.`;

  // Add the workout plan from the Rules Engine
  if (activeSession && activeBundle) {
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
  } else if (activeBundle) {
    // Bundle exists but user hasn't started a session — present ALL options
    const bundlesList = allBundles.length > 1 ? allBundles : [activeBundle];
    systemPrompt += `

## Available Workouts (${bundlesList.length} options)
${bundlesList.map((b: any, i: number) => `${i + 1}. "${b.title}" — ${b.focus}, ~${b.estimated_duration_min} min, ${b.exercises.length} exercises${b.is_recommended ? ' ⭐ RECOMMENDED' : ''}`).join('\n')}

IMPORTANT: The user has ${bundlesList.length} workout options but has NOT started yet. When they greet you:
- Say hi warmly
- Briefly list all ${bundlesList.length} options by number and title (keep it concise — just title and duration for each)
- Mention which one is recommended
- Ask which they'd like to do: "Which one sounds good? The ${bundlesList.find((b: any) => b.is_recommended)?.title || bundlesList[0]?.title} is my pick for you today."
- Accept answers like: "the first one", "number 2", the title name, "the recommended one", "the ${bundlesList[0]?.focus} one"
- Do NOT start coaching until they pick one
- If they say "start" without picking, use the recommended one`;
  } else {
    systemPrompt += `

## No Active Workout
The user doesn't have a workout loaded. Chat naturally about fitness, answer questions, or suggest they generate a new workout plan from the app.`;
  }

  // Gamification context + user stats for voice queries
  const badges = user.gamification?.badges || [];
  const earnedBadgeCount = badges.length;

  systemPrompt += `

## User Stats (answer if asked)
- Level: ${user.gamification?.level || 1}
- Total XP: ${user.gamification?.total_xp || 0}
- Current streak: ${user.gamification?.current_streak || 0} days
- Longest streak: ${user.gamification?.longest_streak || 0} days
- Badges earned: ${earnedBadgeCount} of 7
- Weight: ${user.weight_kg || 'not logged'} kg
- Goal: ${user.fitness_goal || 'general fitness'}

When the user asks about their stats, calories, progress, streak, or badges — answer using the data above. If they ask about calories burned in a specific session, say you can only see their overall stats and suggest they check the Progress tab for detailed history.`;

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
