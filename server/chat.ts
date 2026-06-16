/**
 * Interactive chat with the AI companion.
 * Run: cd server && npx ts-node --transpile-only chat.ts
 * 
 * Type your messages and press Enter. Type "quit" to exit.
 */
import readline from 'readline';
import { sendCompanionMessage } from './src/services/claude';
import { basePersonality } from './src/prompts/basePersonality';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const history: Array<{ role: 'user' | 'assistant'; content: string }> = [];

console.log('\n🏋️ KineticAge AI Companion — Interactive Chat');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('Type your message and press Enter. Type "quit" to exit.\n');

function ask() {
  rl.question('You: ', async (input) => {
    const message = input.trim();

    if (message.toLowerCase() === 'quit') {
      console.log('\nBye! 💪\n');
      rl.close();
      return;
    }

    if (!message) {
      ask();
      return;
    }

    try {
      const result = await sendCompanionMessage(basePersonality, history, message);

      // Store in history for context
      history.push({ role: 'user', content: message });
      history.push({ role: 'assistant', content: result.reply });

      console.log(`\nKira: ${result.reply}`);
      if (result.action_intent) {
        console.log(`  [Action: ${result.action_intent}]`);
      }
      console.log('');
    } catch (error: any) {
      console.log(`\n❌ Error: ${error.message}\n`);
    }

    ask();
  });
}

ask();
