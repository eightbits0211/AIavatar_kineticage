/**
 * AI Companion Service
 *
 * Currently uses Google Gemini (free tier) for development.
 * Switch to Anthropic Claude for production demo.
 *
 * SWITCHING TO CLAUDE (before demo):
 * 1. Get Anthropic API key from console.anthropic.com (add $5-10 credit)
 * 2. Add ANTHROPIC_API_KEY to .env
 * 3. Replace the sendCompanionMessage() implementation below with the Claude version
 *    (swap GoogleGenerativeAI for Anthropic SDK, adjust the API call format)
 *
 * The rest of the codebase (prompts, routes, frontend) stays UNCHANGED.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '../config/env';
import pRetry from 'p-retry';

const genAI = new GoogleGenerativeAI(env.geminiApiKey);

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface CompanionResponse {
  reply: string;
  action_intent: string | null;
}

/**
 * Send a message to the AI companion with system prompt and conversation history.
 * Returns the companion's reply and any structured action intent.
 */
export async function sendCompanionMessage(
  systemPrompt: string,
  conversationHistory: Message[],
  userMessage: string
): Promise<CompanionResponse> {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    systemInstruction: systemPrompt,
  });

  // Convert conversation history to Gemini format
  const history = conversationHistory.map(msg => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }],
  }));

  const chat = model.startChat({ history });

  const response = await pRetry(
    async () => {
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
}

/**
 * Safety layer: remove any specific weight prescriptions from the response.
 * Matches patterns like "use 10kg", "try 20lbs", "lift 15 kg", etc.
 */
function stripWeightValues(text: string): string {
  const weightPattern = /\b\d+(\.\d+)?\s*(kg|kgs|lbs?|pounds?|kilos?)\b/gi;
  return text.replace(weightPattern, '[a weight that feels manageable]');
}
