# Switching from Gemini to Claude (Before Demo)

Currently using Google Gemini (free tier) for development.
Switch to Anthropic Claude for the final demo — better guardrail adherence and personality consistency.

## Steps

1. **Get Anthropic API key** — Sign up at [console.anthropic.com](https://console.anthropic.com), add $5-10 credit, create an API key.

2. **Add to `.env`** — Set `ANTHROPIC_API_KEY=sk-ant-...` in `server/.env`

3. **Update `server/src/services/claude.ts`** — Replace the Gemini implementation:

```typescript
// Replace GoogleGenerativeAI import with:
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: env.anthropicApiKey });

// Replace the sendCompanionMessage() body with:
const result = await client.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 300,
  system: systemPrompt,
  messages: messages.map(m => ({ role: m.role, content: m.content })),
});
const textBlock = result.content.find(b => b.type === 'text');
return textBlock.text;
```

## What Stays the Same

- All prompt files (`server/src/prompts/`)
- The companion route (`server/src/routes/companion.ts`)
- The frontend (chat UI, voice pipeline)
- Conversation storage (session turns in MongoDB)
- The safety validation layer (weight stripping)

## Why Claude for Production

- Better at following complex system prompts with strict boundaries
- More reliable at maintaining persona-based tone shifts
- Stronger guardrail adherence (won't leak weight numbers or invent exercises)
- The `@anthropic-ai/sdk` package is already installed in package.json
