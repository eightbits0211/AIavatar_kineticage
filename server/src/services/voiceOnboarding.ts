/**
 * VOICE ONBOARDING SERVICE
 *
 * Handles conversational onboarding through the voice pipeline.
 * The server extracts structured data from the USER's input transcriptions
 * (not from Gemini's output). This avoids Gemini reading markers aloud.
 *
 * Flow:
 * 1. Gemini asks: "What's your name?"
 * 2. User says: "I'm Alex"
 * 3. Server intercepts the inputTranscription, extracts "name = Alex"
 * 4. Server updates onboarding state and profile
 * 5. Gemini naturally moves to next question (guided by system prompt showing what's collected)
 */

import { User, IUser } from '../models/User';
import { assignPersonaTags, calculateMetrics } from './persona';

// Onboarding fields in order
export const ONBOARDING_FIELDS = [
  'name', 'age', 'gender', 'height', 'weight',
  'fitness_goal', 'activity_level', 'workout_location',
  'equipment', 'injuries', 'workout_duration', 'prior_experience'
] as const;

export type OnboardingField = typeof ONBOARDING_FIELDS[number];

export interface OnboardingState {
  currentFieldIndex: number;
  collectedFields: Partial<Record<OnboardingField, any>>;
  isComplete: boolean;
  failedAttempts: number; // Track consecutive failed extractions for current field
}

/**
 * Build the system prompt for voice onboarding.
 */
export function buildOnboardingPrompt(user: any, state: OnboardingState): string {
  const collected = state.collectedFields;

  let fieldStatus = '';
  for (let i = 0; i < ONBOARDING_FIELDS.length; i++) {
    const f = ONBOARDING_FIELDS[i];
    const done = i < state.currentFieldIndex;
    const current = i === state.currentFieldIndex;
    const value = collected[f];
    if (done) {
      fieldStatus += `\n${i + 1}. ${f}: DONE (${value})`;
    } else if (current) {
      fieldStatus += `\n${i + 1}. ${f}: ASK THIS NOW`;
    } else {
      fieldStatus += `\n${i + 1}. ${f}: (not yet)`;
    }
  }

  let prompt = `You are Kin, a warm and friendly AI fitness companion from KineticAge. You're helping a new user set up their profile through a casual voice conversation.

## Your Task
Guide the user through onboarding by asking ONE question at a time in a natural, conversational way. After the user answers, confirm what you heard briefly, then ask the next question.

## Important Rules
- Ask ONLY one question at a time
- Keep responses short (1-2 sentences)
- Never use markdown formatting — you are speaking aloud
- Do NOT say any codes, brackets, tags, or technical text out loud
- Just have a natural conversation
- If the user's answer is unclear, ask a brief follow-up to clarify
- Be warm and encouraging throughout

## Fields to Collect (in order)
${fieldStatus}

## How to Ask Each Question

1. name: "What should I call you?"
2. age: "How old are you?"
3. gender: "For calculating your metrics — are you male, female, or would you prefer not to say?"
4. height: "How tall are you? Feet and inches or centimeters, either works."
5. weight: "What is your current weight? Kilos or pounds, whichever you prefer."
6. fitness_goal: "What is your main fitness goal? Like building strength, gaining muscle, improving mobility, general fitness, losing weight, or working out at home?"
7. activity_level: "How active are you on a typical day? Sedentary, lightly active, moderately active, or very active?"
8. workout_location: "Where do you usually work out? Gym, home, outdoors, or a mix of places?"
9. equipment: "What equipment do you have access to? Things like dumbbells, a barbell, a bench, resistance bands, kettlebell, pull-up bar?"
10. injuries: "Any injuries or areas I should be careful with? Like knees, lower back, shoulders — or are you all good?"
11. workout_duration: "How long do you want your workouts to be? Around 15, 30, 45, or 60 minutes?"
12. prior_experience: "Have you followed a structured workout program before? Like a specific training plan?"`;

  if (state.currentFieldIndex === 0) {
    prompt += '\n\nStart by greeting them warmly and asking their name.';
  }
  if (state.isComplete) {
    prompt += '\n\nAll fields are collected! Congratulate them warmly and tell them you are now setting up their personalized fitness plan.';
  }

  return prompt;
}

/**
 * Server-side extraction: Parse the user's spoken answer for the current onboarding field.
 * Called when we receive inputTranscription from Gemini.
 */
export function extractFieldFromUserSpeech(
  field: OnboardingField,
  userText: string
): { value: any; confidence: 'high' | 'low' } | null {
  const text = userText.toLowerCase().trim();
  if (!text || text.length < 1) return null;

  switch (field) {
    case 'name': {
      // Don't accept greetings or very short generic words as names
      const greetings = ['hi', 'hello', 'hey', 'yo', 'sup', 'okay', 'ok', 'yes', 'no', 'yeah', 'sure', 'thanks'];
      if (greetings.includes(text)) return null;
      
      const namePatterns = [
        /(?:i'm|i am|my name is|call me|it's|its|name's)\s+(.+)/i,
        /^([a-z]{2,}(?:\s[a-z]+)?)$/i,
      ];
      for (const p of namePatterns) {
        const m = userText.match(p);
        if (m) {
          const name = m[1].trim().replace(/[.!?,]$/, '');
          if (name.length >= 2 && !greetings.includes(name.toLowerCase())) {
            return { value: name, confidence: 'high' };
          }
        }
      }
      // If short answer (1-3 words) and not a greeting, likely just the name
      const words = userText.trim().split(/\s+/);
      if (words.length <= 3 && words.length >= 1) {
        const candidate = userText.trim().replace(/[.!?,]$/, '');
        if (candidate.length >= 2 && !greetings.includes(candidate.toLowerCase())) {
          return { value: candidate, confidence: 'high' };
        }
      }
      return null;
    }

    case 'age': {
      const nums = text.match(/\b(\d{2})\b/);
      if (nums) {
        const age = parseInt(nums[1]);
        if (age >= 16 && age <= 100) return { value: age, confidence: 'high' };
      }
      const wordNums: Record<string, number> = {
        sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
        'twenty one': 21, 'twenty two': 22, 'twenty three': 23, 'twenty four': 24,
        'twenty five': 25, 'twenty six': 26, 'twenty seven': 27, 'twenty eight': 28,
        'twenty nine': 29, thirty: 30, 'thirty one': 31, 'thirty two': 32,
        'thirty five': 35, forty: 40, 'forty five': 45, fifty: 50,
      };
      for (const [word, num] of Object.entries(wordNums)) {
        if (text.includes(word)) return { value: num, confidence: 'high' };
      }
      return null;
    }

    case 'gender': {
      if (text.includes('male') && !text.includes('female')) return { value: 'male', confidence: 'high' };
      if (text.includes('female') || text.includes('woman') || text.includes('girl')) return { value: 'female', confidence: 'high' };
      if (text.includes('prefer not') || text.includes('rather not')) return { value: 'prefer_not_to_say', confidence: 'high' };
      if (text.includes('other') || text.includes('non-binary') || text.includes('nonbinary')) return { value: 'other', confidence: 'high' };
      if (text.includes('man') || text.includes('guy') || text.includes('dude')) return { value: 'male', confidence: 'high' };
      return null;
    }

    case 'height': {
      const ftIn = text.match(/(\d)\s*(?:'|foot|feet|ft)\s*(\d{1,2})/);
      if (ftIn) {
        const cm = Math.round((parseInt(ftIn[1]) * 30.48) + (parseInt(ftIn[2]) * 2.54));
        return { value: cm, confidence: 'high' };
      }
      const cmMatch = text.match(/(\d{2,3})\s*(?:cm|centimeter)/);
      if (cmMatch) return { value: parseInt(cmMatch[1]), confidence: 'high' };
      const nums = text.match(/\b(\d{2,3})\b/g);
      if (nums) {
        for (const n of nums) {
          const val = parseInt(n);
          if (val >= 140 && val <= 220) return { value: val, confidence: 'high' };
          if (val >= 48 && val <= 84) return { value: Math.round(val * 2.54), confidence: 'low' };
        }
      }
      return null;
    }

    case 'weight': {
      const kgMatch = text.match(/(\d{2,3}(?:\.\d)?)\s*(?:kg|kilo)/);
      if (kgMatch) return { value: parseFloat(kgMatch[1]), confidence: 'high' };
      const lbMatch = text.match(/(\d{2,3}(?:\.\d)?)\s*(?:lb|pound|lbs)/);
      if (lbMatch) return { value: Math.round(parseFloat(lbMatch[1]) * 0.4536), confidence: 'high' };
      const nums = text.match(/\b(\d{2,3})\b/);
      if (nums) {
        const val = parseInt(nums[1]);
        if (val >= 30 && val <= 200) return { value: val, confidence: 'high' };
        if (val > 200 && val <= 400) return { value: Math.round(val * 0.4536), confidence: 'low' };
      }
      return null;
    }

    case 'fitness_goal': {
      if (text.includes('strength') || text.includes('strong') || text.includes('lift heavy')) return { value: 'strength', confidence: 'high' };
      if (text.includes('muscle') || text.includes('bulk') || text.includes('hypertrophy') || text.includes('bigger') || text.includes('mass')) return { value: 'hypertrophy', confidence: 'high' };
      if (text.includes('mobil') || text.includes('flexib') || text.includes('stretch')) return { value: 'mobility', confidence: 'high' };
      if (text.includes('weight loss') || text.includes('lose weight') || text.includes('slim') || text.includes('burn fat') || text.includes('lean')) return { value: 'weight_loss', confidence: 'high' };
      if (text.includes('home') || text.includes('body weight') || text.includes('bodyweight')) return { value: 'home_workout', confidence: 'high' };
      if (text.includes('general') || text.includes('fit') || text.includes('health') || text.includes('overall')) return { value: 'general_fitness', confidence: 'high' };
      return null;
    }

    case 'activity_level': {
      if (text.includes('very') || text.includes('super') || text.includes('extremely')) return { value: 'very_active', confidence: 'high' };
      if (text.includes('moderate') || text.includes('fairly') || text.includes('somewhat')) return { value: 'moderately_active', confidence: 'high' };
      if (text.includes('light') || text.includes('a bit') || text.includes('not very')) return { value: 'lightly_active', confidence: 'high' };
      if (text.includes('sedentary') || text.includes('desk') || text.includes('not active') || text.includes('barely')) return { value: 'sedentary', confidence: 'high' };
      return null;
    }

    case 'workout_location': {
      if (text.includes('gym')) return { value: 'gym', confidence: 'high' };
      if (text.includes('home')) return { value: 'home', confidence: 'high' };
      if (text.includes('outdoor') || text.includes('outside') || text.includes('park')) return { value: 'outdoors', confidence: 'high' };
      if (text.includes('mix') || text.includes('both') || text.includes('hybrid') || text.includes('combination')) return { value: 'hybrid', confidence: 'high' };
      return null;
    }

    case 'equipment': {
      const items: string[] = [];
      if (text.includes('dumbbell')) items.push('dumbbells');
      if (text.includes('barbell')) items.push('barbell');
      if (text.includes('bench')) items.push('bench');
      if (text.includes('band') || text.includes('resistance')) items.push('resistance_bands');
      if (text.includes('kettle')) items.push('kettlebell');
      if (text.includes('pull up') || text.includes('pull-up') || text.includes('pullup') || text.includes('bar')) items.push('pull_up_bar');
      if (text.includes('machine')) items.push('machines');
      if (text.includes('cardio') || text.includes('treadmill') || text.includes('bike')) items.push('cardio_equipment');
      if (text.includes('nothing') || text.includes('none') || text.includes('just body') || text.includes('no equipment')) return { value: ['none'], confidence: 'high' };
      if (items.length > 0) return { value: items, confidence: 'high' };
      return null;
    }

    case 'injuries': {
      if (text.includes('none') || text.includes('no') || text.includes('all good') || text.includes('fine') || text.includes('nope') || text.includes('nothing')) {
        return { value: ['none'], confidence: 'high' };
      }
      const injuries: string[] = [];
      if (text.includes('knee')) injuries.push('knee');
      if (text.includes('back') || text.includes('spine')) injuries.push('lower_back');
      if (text.includes('shoulder')) injuries.push('shoulder');
      if (text.includes('wrist') || text.includes('hand')) injuries.push('wrist');
      if (text.includes('ankle') || text.includes('foot')) injuries.push('ankle');
      if (injuries.length > 0) return { value: injuries, confidence: 'high' };
      return null;
    }

    case 'workout_duration': {
      const nums = text.match(/\b(15|30|45|60)\b/);
      if (nums) return { value: parseInt(nums[1]), confidence: 'high' };
      if (text.includes('fifteen')) return { value: 15, confidence: 'high' };
      if (text.includes('thirty') || text.includes('half hour') || text.includes('half an hour')) return { value: 30, confidence: 'high' };
      if (text.includes('forty five') || text.includes('forty-five')) return { value: 45, confidence: 'high' };
      if (text.includes('sixty') || text.includes('hour') || text.includes('one hour')) return { value: 60, confidence: 'high' };
      return null;
    }

    case 'prior_experience': {
      if (text.includes('yes') || text.includes('yeah') || text.includes('yep') || text.includes('i have') || text.includes('i did') || text.includes('sure') || text.includes('definitely')) {
        return { value: true, confidence: 'high' };
      }
      if (text.includes('no') || text.includes('nope') || text.includes('never') || text.includes('not really') || text.includes('first time') || text.includes("haven't")) {
        return { value: false, confidence: 'high' };
      }
      return null;
    }
  }

  return null;
}

/**
 * Apply an extracted field value to the onboarding state.
 */
export function applyExtraction(
  state: OnboardingState,
  field: string,
  value: any
): boolean {
  const mappedField = field as OnboardingField;
  if (!ONBOARDING_FIELDS.includes(mappedField)) return false;

  state.collectedFields[mappedField] = value;

  // Update currentFieldIndex to the next uncollected field
  while (state.currentFieldIndex < ONBOARDING_FIELDS.length &&
         state.collectedFields[ONBOARDING_FIELDS[state.currentFieldIndex]] !== undefined) {
    state.currentFieldIndex++;
  }

  // Check if ALL required fields are collected
  const collected = Object.keys(state.collectedFields).length;
  if (collected >= ONBOARDING_FIELDS.length) {
    state.isComplete = true;
  }

  return true;
}

/**
 * Save collected onboarding data to the user profile and run personalization.
 */
export async function finalizeOnboarding(userId: any, state: OnboardingState): Promise<{
  persona_tags: string[];
  calculated_metrics: any;
}> {
  const fields = state.collectedFields;

  const user = await User.findById(userId);
  if (!user) throw new Error('User not found');

  if (fields.name) user.name = fields.name;
  if (fields.age) user.age = fields.age;
  if (fields.gender) user.gender = fields.gender;
  if (fields.height) user.height_cm = fields.height;
  if (fields.weight) user.weight_kg = fields.weight;
  if (fields.fitness_goal) user.fitness_goal = fields.fitness_goal;
  if (fields.activity_level) user.activity_level = fields.activity_level;
  if (fields.workout_location) user.workout_location = fields.workout_location;
  if (fields.equipment) user.equipment = fields.equipment;
  if (fields.injuries) user.injuries = fields.injuries;
  if (fields.workout_duration) user.workout_duration = fields.workout_duration;
  if (fields.prior_experience !== undefined) user.prior_program_experience = fields.prior_experience;

  const metrics = calculateMetrics(user);
  user.calculated_metrics = metrics;

  const personaTags = assignPersonaTags(user);
  user.persona_tags = personaTags;

  user.onboarding_completed = true;
  if (user.gamification.total_xp === 0) {
    user.gamification.total_xp = 15;
    user.gamification.level = 1;
  }

  await user.save();

  return { persona_tags: personaTags, calculated_metrics: metrics };
}

/**
 * Parse extraction markers from text (legacy — kept for compatibility).
 */
export function parseExtractions(text: string): Array<{ field: string; value: string }> {
  const extractions: Array<{ field: string; value: string }> = [];
  const regex = /\[EXTRACT:(\w+)=([^\]]+)\]/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    extractions.push({ field: match[1], value: match[2] });
  }
  return extractions;
}

/**
 * Strip extraction markers from text.
 */
export function stripExtractionMarkers(text: string): string {
  return text.replace(/\[EXTRACT:\w+=[^\]]+\]/g, '').replace(/\s{2,}/g, ' ').trim();
}


/**
 * Server-side extraction: Try to extract ANY onboarding field from user speech.
 * Instead of requiring a specific field order, we scan for all possible values
 * and match whatever the user provides. This handles Gemini asking questions
 * in any order and the user answering naturally.
 */
export function extractAnyFieldFromSpeech(
  userText: string,
  alreadyCollected: Partial<Record<OnboardingField, any>>
): { field: OnboardingField; value: any } | null {
  const text = userText.toLowerCase().trim();
  if (!text || text.length < 2) return null;

  // Try each uncollected field — high confidence first
  for (const field of ONBOARDING_FIELDS) {
    if (alreadyCollected[field] !== undefined) continue;
    const result = extractFieldFromUserSpeech(field, userText);
    if (result && result.confidence === 'high') {
      return { field, value: result.value };
    }
  }

  // Second pass with low confidence
  for (const field of ONBOARDING_FIELDS) {
    if (alreadyCollected[field] !== undefined) continue;
    const result = extractFieldFromUserSpeech(field, userText);
    if (result) {
      return { field, value: result.value };
    }
  }

  return null;
}
