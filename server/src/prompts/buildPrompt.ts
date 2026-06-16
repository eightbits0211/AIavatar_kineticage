import { basePersonality } from './basePersonality';
import { IUser } from '../models/User';

interface SessionContext {
  bundle_title?: string;
  current_exercise?: string;
  current_set?: number;
  total_sets?: number;
  target_reps?: string;
  rest_seconds?: number;
  exercises_remaining?: number;
  exercise_instructions?: string;
}

interface BuildPromptOptions {
  user: IUser;
  sessionContext?: SessionContext;
  recentSummaries?: string[];
}

/**
 * Assembles the full system prompt from layers.
 * Layer 1: Base personality (static)
 * Layer 2: User context (per-user)
 * Layer 3: Session context (per-turn, if in workout)
 * Layer 4: History context (recent summaries)
 */
export function buildSystemPrompt(options: BuildPromptOptions): string {
  const { user, sessionContext, recentSummaries } = options;

  // Layer 2: User Context
  const userContext = buildUserContext(user);

  // Layer 3: Session Context
  const sessionSection = sessionContext ? buildSessionContext(sessionContext) : '';

  // Layer 4: History Context
  const historySection = recentSummaries?.length
    ? `\n## Recent Session History\n${recentSummaries.map((s, i) => `- Session ${i + 1}: ${s}`).join('\n')}`
    : '';

  return `${basePersonality}

${userContext}
${sessionSection}
${historySection}`.trim();
}

function buildUserContext(user: IUser): string {
  const personaToneMap: Record<string, string> = {
    complete_beginner: 'Use extra encouragement. Explain terms proactively. Keep things simple and non-intimidating.',
    regular_gym_goer: 'Be more peer-like. Skip basic explanations unless asked. Focus on performance.',
    weight_loss_seeker: 'Focus on energy, strength, and consistency. Never mention weight, appearance, or body shape.',
    home_workout_user: 'Acknowledge space/equipment constraints. Offer quieter alternatives if relevant.',
    office_professional: 'Be mindful of time constraints. Reference posture and desk-related tightness naturally.',
    injury_recovery_user: 'Be reassuring about safety. Remind them to stay within comfortable ranges. Include medical disclaimer once per week.',
    ai_companion_seeker: 'Be more conversational and engaging. Show personality. Ask follow-up questions.',
    inconsistent_enthusiast: 'Celebrate showing up. Focus on momentum, not perfection. Never shame missed days.',
  };

  const personaInstructions = user.persona_tags
    ?.map(tag => personaToneMap[tag])
    .filter(Boolean)
    .join('\n- ') || 'Use a balanced, supportive tone.';

  return `## About This User
- Name: ${user.name || 'there'}
- Age: ${user.age || 'unknown'}
- Goal: ${user.fitness_goal || 'general fitness'}
- Persona tags: ${user.persona_tags?.join(', ') || 'none assigned yet'}
- Injuries: ${user.injuries?.filter(i => i !== 'none').join(', ') || 'none reported'}
- Talkativeness preference: ${user.companion_preferences?.talkativeness || 'balanced'}
- In-session verbosity: ${user.companion_preferences?.in_session_verbosity || 'standard'}

## Tone Adjustments for This User
- ${personaInstructions}`;
}

function buildSessionContext(ctx: SessionContext): string {
  return `
## Current Session
- Workout: ${ctx.bundle_title || 'Unknown'}
- Current exercise: ${ctx.current_exercise || 'None'}
- Set: ${ctx.current_set || 0} of ${ctx.total_sets || 0}
- Target reps: ${ctx.target_reps || 'N/A'}
- Rest between sets: ${ctx.rest_seconds || 0} seconds
- Exercises remaining after this: ${ctx.exercises_remaining || 0}
${ctx.exercise_instructions ? `\n## Exercise Instructions (use for explanations)\n${ctx.exercise_instructions}` : ''}`;
}
