/**
 * AI Companion Service
 *
 * Currently uses Groq (free tier, Llama model) for development.
 * Switch to Anthropic Claude for production demo.
 *
 * SWITCHING TO CLAUDE (before demo):
 * 1. Get Anthropic API key from console.anthropic.com (add $5-10 credit)
 * 2. Add ANTHROPIC_API_KEY to .env
 * 3. Replace the Groq implementation below with Anthropic SDK
 *    (swap Groq for Anthropic, adjust the API call format)
 *
 * The rest of the codebase (prompts, routes, frontend) stays UNCHANGED.
 */

import Groq from 'groq-sdk';
import { env } from '../config/env';
import pRetry from 'p-retry';

const groq = new Groq({ apiKey: env.groqApiKey });

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
  const messages = [
    { role: 'system' as const, content: systemPrompt },
    ...conversationHistory.map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    })),
    { role: 'user' as const, content: userMessage },
  ];

  const response = await pRetry(
    async () => {
      const result = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages,
        max_tokens: 300,
        temperature: 0.7,
      });

      const text = result.choices[0]?.message?.content;
      if (!text) {
        throw new Error('Empty response from Groq');
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
