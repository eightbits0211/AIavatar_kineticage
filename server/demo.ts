/**
 * Full KineticAge Demo — Interactive session with onboarding, bundles, and workout.
 * Run: cd server && npx ts-node --transpile-only demo.ts
 */
import readline from 'readline';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

import { sendCompanionMessage } from './src/services/claude';
import { basePersonality } from './src/prompts/basePersonality';
import { buildSystemPrompt } from './src/prompts/buildPrompt';
import { generateBundles, AssembledBundle } from './src/services/rulesEngine';
import { assignPersonaTags, calculateMetrics } from './src/services/persona';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q: string): Promise<string> => new Promise(r => rl.question(q, r));

const history: Array<{ role: 'user' | 'assistant'; content: string }> = [];

async function chat(systemPrompt: string, message: string): Promise<string> {
  const result = await sendCompanionMessage(systemPrompt, history, message);
  history.push({ role: 'user', content: message });
  history.push({ role: 'assistant', content: result.reply });
  return result.reply;
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);
  console.log('\n🏋️  KineticAge — Full Demo');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // ──── ONBOARDING ────
  console.log('📋 STEP 1: Onboarding\n');
  const name = await ask('  Your name: ');
  const age = parseInt(await ask('  Age: '));
  const gender = await ask('  Gender (male/female/other): ');
  const height = parseInt(await ask('  Height (cm): '));
  const weight = parseInt(await ask('  Weight (kg): '));
  const goal = await ask('  Goal (strength/hypertrophy/mobility/general_fitness/weight_loss/home_workout): ');
  const activity = await ask('  Activity level (sedentary/lightly_active/moderately_active/very_active): ');
  const location = await ask('  Workout location (gym/home/outdoors/hybrid): ');
  const equipmentStr = await ask('  Equipment (comma-separated: none,dumbbells,barbell,bench,machines,resistance_bands,kettlebell,pull_up_bar): ');
  const injuryStr = await ask('  Injuries (comma-separated: none,knee,lower_back,shoulder,wrist,ankle): ');
  const duration = parseInt(await ask('  Preferred duration (15/30/45/60 min): '));
  const priorExp = (await ask('  Have you followed a structured workout program before? (yes/no): ')).toLowerCase() === 'yes';
  const talkativeness = await ask('  AI talkativeness (minimal/balanced/high): ');

  const user: any = {
    name, age, gender,
    height_cm: height,
    weight_kg: weight,
    fitness_goal: goal,
    activity_level: activity,
    workout_location: location,
    equipment: equipmentStr.split(',').map(s => s.trim()),
    injuries: injuryStr.split(',').map(s => s.trim()),
    workout_duration: duration,
    prior_program_experience: priorExp,
    companion_preferences: { talkativeness, in_session_verbosity: 'standard' },
  };

  // ──── PERSONALIZATION ────
  console.log('\n⚙️  STEP 2: Personalization\n');
  const metrics = calculateMetrics(user);
  const personaTags = assignPersonaTags(user);
  user.persona_tags = personaTags;
  user.calculated_metrics = metrics;

  console.log('  📊 Your Metrics:');
  console.log(`     BMI: ${metrics.bmi} (${metrics.bmi_category})`);
  console.log(`     Daily Calories: ${metrics.tdee_range.low}-${metrics.tdee_range.high} cal`);
  console.log(`     Max Heart Rate: ${metrics.max_heart_rate} bpm`);
  console.log(`     Target Zone: ${metrics.target_zone.low}-${metrics.target_zone.high} bpm`);
  console.log(`\n  🏷️  Your Personas: ${personaTags.join(', ')}`);

  // ──── BUNDLE GENERATION ────
  console.log('\n\n🎯 STEP 3: Generating Your Workout Bundles...\n');
  const result = await generateBundles({ user, recentMuscleGroups: [] });

  console.log(`  Generated ${result.bundles.length} options:\n`);
  result.bundles.forEach((b, i) => {
    const rec = b.is_recommended ? ' ⭐ RECOMMENDED' : '';
    console.log(`  [${i + 1}] ${b.title} (${b.focus})${rec}`);
    console.log(`      ${b.exercises.length} exercises, ~${b.estimated_duration_min} min, ${b.estimated_calorie_burn.low}-${b.estimated_calorie_burn.high} cal`);
    b.exercises.forEach(e => console.log(`        • ${e.name} — ${e.sets}x${e.rep_min}-${e.rep_max}`));
    console.log('');
  });

  // ──── SELECT BUNDLE ────
  const choice = parseInt(await ask('  Select a bundle (1-' + result.bundles.length + '): ')) - 1;
  const selectedBundle = result.bundles[choice] || result.bundles[0];
  console.log(`\n  ✅ Selected: ${selectedBundle.title}\n`);

  // ──── WORKOUT SESSION WITH AI COMPANION ────
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🏋️  STEP 4: Workout Session (chat with Kira)\n');

  const systemPrompt = buildSystemPrompt({
    user,
    sessionContext: {
      bundle_title: selectedBundle.title,
      current_exercise: selectedBundle.exercises[0]?.name,
      current_set: 1,
      total_sets: selectedBundle.exercises[0]?.sets,
      target_reps: `${selectedBundle.exercises[0]?.rep_min}-${selectedBundle.exercises[0]?.rep_max}`,
      exercises_remaining: selectedBundle.exercises.length - 1,
      exercise_instructions: selectedBundle.exercises[0]?.instructions_text,
    },
  });

  // Kira greets the user
  const greeting = await chat(systemPrompt, `I just selected the "${selectedBundle.title}" workout. Let's go!`);
  console.log(`  Kira: ${greeting}\n`);

  // Interactive loop
  console.log('  (Type your messages. Type "quit" to end session)\n');
  while (true) {
    const input = await ask('  You: ');
    if (input.trim().toLowerCase() === 'quit') break;
    if (!input.trim()) continue;

    const reply = await chat(systemPrompt, input.trim());
    console.log(`\n  Kira: ${reply}\n`);
  }

  // ──── SESSION SUMMARY ────
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const summary = await chat(systemPrompt, 'I\'m done with my workout. Can you give me a summary?');
  console.log(`\n  📋 Session Summary:\n  Kira: ${summary}\n`);

  console.log('  🎉 +50 XP earned! Great session.\n');

  await mongoose.disconnect();
  rl.close();
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
