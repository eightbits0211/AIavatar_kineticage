/**
 * AI Companion Service
 *
 * Uses Google Gemini API (gemini-2.5-flash) for the AI companion.
 * The file is still named claude.ts to avoid changing imports across the codebase.
 *
 * The rest of the codebase (prompts, routes, frontend) stays UNCHANGED —
 * only this file needed to change.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '../config/env';
import pRetry from 'p-retry';

const genAI = new GoogleGenerativeAI(env.geminiApiKey);

const model = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
  generationConfig: {
    maxOutputTokens: 300,
    temperature: 0.7,
  },
});

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface CompanionResponse {
  reply: string;
  action_intent: string | null;
  fallback?: boolean;
}

/** Fallback responses when AI service is unavailable */
const FALLBACK_RESPONSES = [
  "I'm having a moment — give me a sec and try again!",
  "My connection hiccupped. Try sending that again in a few seconds.",
  "Seems like I need a quick breather. Let's try that again shortly.",
];

function getFallbackResponse(): CompanionResponse {
  const reply = FALLBACK_RESPONSES[Math.floor(Math.random() * FALLBACK_RESPONSES.length)];
  return { reply, action_intent: null, fallback: true };
}

/**
 * Send a message to the AI companion with system prompt and conversation history.
 * Returns the companion's reply and any structured action intent.
 * On failure after retries, returns a friendly fallback message instead of throwing.
 */
export async function sendCompanionMessage(
  systemPrompt: string,
  conversationHistory: Message[],
  userMessage: string
): Promise<CompanionResponse> {
  // Build Gemini conversation history format
  const history = conversationHistory.map(msg => ({
    role: msg.role === 'assistant' ? 'model' as const : 'user' as const,
    parts: [{ text: msg.content }],
  }));

  try {
    const response = await pRetry(
      async () => {
        const chat = model.startChat({
          history,
          systemInstruction: { role: 'user', parts: [{ text: systemPrompt }] },
        });

        const result = await chat.sendMessage(userMessage);
        const text = result.response.text();

        if (!text) {
          throw new Error('Empty response from Gemini');
        }
        return text;
      },
      {
        retries: 3,
        minTimeout: 1000,
        factor: 2,
        onFailedAttempt: (error) => {
          console.warn(`AI attempt ${error.attemptNumber} failed: ${error.message}`);
        },
      }
    );

    // Parse action intent if present (format: [ACTION:intent_name] at end of response)
    const actionMatch = response.match(/\[ACTION:(\w+)\]\s*$/);
    let reply = response;
    let action_intent: string | null = null;

    if (actionMatch) {
      action_intent = actionMatch[1];
      reply = response.replace(/\[ACTION:\w+\]\s*$/, '').trim();
    }

    // Safety validation: strip any weight numbers that slipped through
    reply = stripWeightValues(reply);

    return { reply, action_intent };
  } catch (error: any) {
    console.error('AI service unavailable after retries:', error.message);
    return getFallbackResponse();
  }
}

/**
 * Safety layer: remove any specific weight prescriptions from the response.
 * Matches patterns like "use 10kg", "try 20lbs", "lift 15 kg", etc.
 */
function stripWeightValues(text: string): string {
  const weightPattern = /\b\d+(\.\d+)?\s*(kg|kgs|lbs?|pounds?|kilos?)\b/gi;
  return text.replace(weightPattern, '[a weight that feels manageable]');
}
