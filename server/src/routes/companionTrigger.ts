import { Router, Response } from 'express';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { User, Session } from '../models';
import { sendCompanionMessage } from '../services/claude';
import { buildSystemPrompt } from '../prompts/buildPrompt';

const router = Router();

/**
 * Proactive AI trigger types:
 * - session_start: Kira greets the user and previews the workout
 * - exercise_intro: Kira introduces the upcoming exercise
 * - set_complete: Kira reacts to a completed set (uses feedback if provided)
 * - rest_start: Kira gives a brief encouragement during rest
 * - exercise_complete: Kira acknowledges completing an exercise, transitions to next
 * - session_end: Kira gives a short personalized summary/celebration
 * - milestone: Kira celebrates a streak, badge, or progression milestone
 */
type TriggerType = 'session_start' | 'exercise_intro' | 'set_complete' | 'rest_start' | 'exercise_complete' | 'session_end' | 'milestone';

const TRIGGER_PROMPTS: Record<TriggerType, string> = {
  session_start: `The user is starting their workout. Give a brief, energetic greeting (1-2 sentences). Mention their workout name if provided. Keep it short and motivating.`,

  exercise_intro: `The user is about to start a new exercise. Briefly introduce it (1-2 sentences). Mention what muscles it works and one quick form tip from the instructions provided. Keep it natural and concise.`,

  set_complete: `The user just finished a set. React briefly (1 sentence). If they reported "felt_easy", encourage them. If "felt_hard", reassure them. If "felt_normal", keep it simple. Never suggest specific weights.`,

  rest_start: `The user is resting between sets. Give a quick 1-sentence encouragement or breathing cue. Keep it very short.`,

  exercise_complete: `The user finished all sets of an exercise. Acknowledge it briefly (1 sentence). If there's a next exercise, mention the transition naturally.`,

  session_end: `The user just completed their entire workout session. Celebrate briefly (2-3 sentences max). Mention exercises completed if provided. Be genuine, not over-the-top.`,

  milestone: `The user just hit a milestone. Celebrate it genuinely in 1-2 sentences. Be specific about what they achieved.`,
};

interface TriggerContext {
  exercise_name?: string;
  exercise_instructions?: string;
  muscle_groups?: string[];
  set_number?: number;
  total_sets?: number;
  target_reps?: string;
  feedback?: 'felt_easy' | 'felt_normal' | 'felt_hard' | null;
  next_exercise?: string;
  exercises_completed?: number;
  exercises_total?: number;
  rest_seconds?: number;
  milestone_type?: string;
  milestone_detail?: string;
  bundle_title?: string;
}

/**
 * POST /api/companion/trigger
 * Returns a proactive Kira message for a specific workout moment.
 *
 * Body: {
 *   trigger: TriggerType,
 *   session_id?: string,
 *   context?: TriggerContext
 * }
 *
 * Response: { message: string, trigger: string }
 */
router.post('/trigger', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { trigger, session_id, context } = req.body as {
      trigger: TriggerType;
      session_id?: string;
      context?: TriggerContext;
    };

    if (!trigger || !TRIGGER_PROMPTS[trigger]) {
      res.status(400).json({
        error: 'Bad Request',
        message: `Invalid trigger. Valid: ${Object.keys(TRIGGER_PROMPTS).join(', ')}`,
      });
      return;
    }

    const user = await User.findOne({ firebase_uid: req.uid });
    if (!user) {
      res.status(404).json({ error: 'Not Found', message: 'User not found' });
      return;
    }

    // Build system prompt with user context
    const systemPrompt = buildSystemPrompt({ user });

    // Build the trigger-specific user message
    const triggerInstruction = TRIGGER_PROMPTS[trigger];
    const contextDetails = buildContextMessage(trigger, context);

    const userMessage = `[SYSTEM TRIGGER: ${trigger}]\n${triggerInstruction}\n\n${contextDetails}`;

    const { reply, fallback } = await sendCompanionMessage(systemPrompt, [], userMessage);

    res.json({
      message: reply,
      trigger,
      ...(fallback && { fallback: true }),
    });
  } catch (error: any) {
    console.error('Companion trigger error:', error.message);
    // Return a generic fallback instead of 500
    res.json({
      message: getFallbackForTrigger(req.body?.trigger),
      trigger: req.body?.trigger || 'unknown',
      fallback: true,
    });
  }
});

/**
 * Builds a context string for the AI based on trigger type and provided context.
 */
function buildContextMessage(trigger: TriggerType, ctx?: TriggerContext): string {
  if (!ctx) return '';

  switch (trigger) {
    case 'session_start':
      return `Workout: ${ctx.bundle_title || 'Today\'s workout'}. Total exercises: ${ctx.exercises_total || 'several'}.`;

    case 'exercise_intro':
      return [
        ctx.exercise_name ? `Exercise: ${ctx.exercise_name}` : '',
        ctx.muscle_groups?.length ? `Muscles: ${ctx.muscle_groups.join(', ')}` : '',
        ctx.total_sets ? `Sets: ${ctx.total_sets}, Reps: ${ctx.target_reps || '8-12'}` : '',
        ctx.exercise_instructions ? `Instructions: ${ctx.exercise_instructions}` : '',
      ].filter(Boolean).join('. ');

    case 'set_complete':
      return [
        ctx.exercise_name ? `Exercise: ${ctx.exercise_name}` : '',
        ctx.set_number ? `Just finished set ${ctx.set_number} of ${ctx.total_sets}` : '',
        ctx.feedback ? `User reported: ${ctx.feedback.replace('_', ' ')}` : '',
      ].filter(Boolean).join('. ');

    case 'rest_start':
      return [
        ctx.rest_seconds ? `Rest period: ${ctx.rest_seconds} seconds` : '',
        ctx.set_number ? `Next up: set ${(ctx.set_number || 0) + 1} of ${ctx.total_sets}` : '',
      ].filter(Boolean).join('. ');

    case 'exercise_complete':
      return [
        ctx.exercise_name ? `Completed: ${ctx.exercise_name}` : '',
        ctx.next_exercise ? `Next exercise: ${ctx.next_exercise}` : 'This was the last exercise.',
      ].filter(Boolean).join('. ');

    case 'session_end':
      return [
        ctx.exercises_completed ? `Completed ${ctx.exercises_completed} of ${ctx.exercises_total} exercises` : '',
        ctx.bundle_title ? `Workout: ${ctx.bundle_title}` : '',
      ].filter(Boolean).join('. ');

    case 'milestone':
      return [
        ctx.milestone_type ? `Type: ${ctx.milestone_type}` : '',
        ctx.milestone_detail ? `Detail: ${ctx.milestone_detail}` : '',
      ].filter(Boolean).join('. ');

    default:
      return '';
  }
}

/**
 * Returns a static fallback message when AI is unavailable for a trigger.
 */
function getFallbackForTrigger(trigger?: string): string {
  const fallbacks: Record<string, string> = {
    session_start: "Let's do this! Your workout is ready.",
    exercise_intro: "Next exercise coming up. Check the form guide and go at your pace.",
    set_complete: "Nice work on that set!",
    rest_start: "Take a breather. You've earned it.",
    exercise_complete: "Exercise done! On to the next one.",
    session_end: "Great session! You showed up and put in the work.",
    milestone: "You just hit a milestone! Keep building that momentum.",
  };
  return fallbacks[trigger || ''] || "Keep going, you're doing great!";
}

/**
 * POST /api/companion/trigger-test
 * DEV ONLY — same as /trigger but bypasses auth using a demo_uid.
 * Used by the trigger-test.html page for local testing.
 * Remove before production.
 */
router.post('/trigger-test', async (req: any, res: Response) => {
  try {
    const { trigger, context, demo_uid } = req.body;

    if (!trigger || !TRIGGER_PROMPTS[trigger as TriggerType]) {
      res.status(400).json({
        error: 'Bad Request',
        message: `Invalid trigger. Valid: ${Object.keys(TRIGGER_PROMPTS).join(', ')}`,
      });
      return;
    }

    const user = await User.findOne({ firebase_uid: demo_uid || 'demo_alex' });
    if (!user) {
      res.status(404).json({ error: 'Not Found', message: 'Demo user not found. Run seed-demo.ts first.' });
      return;
    }

    const systemPrompt = buildSystemPrompt({ user });
    const triggerInstruction = TRIGGER_PROMPTS[trigger as TriggerType];
    const contextDetails = buildContextMessage(trigger as TriggerType, context);
    const userMessage = `[SYSTEM TRIGGER: ${trigger}]\n${triggerInstruction}\n\n${contextDetails}`;

    const { reply, fallback } = await sendCompanionMessage(systemPrompt, [], userMessage);

    res.json({
      message: reply,
      trigger,
      ...(fallback && { fallback: true }),
    });
  } catch (error: any) {
    console.error('Trigger test error:', error.message);
    res.json({
      message: getFallbackForTrigger(req.body?.trigger),
      trigger: req.body?.trigger || 'unknown',
      fallback: true,
    });
  }
});

export default router;
