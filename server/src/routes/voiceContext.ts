/**
 * VOICE CONTEXT ROUTE
 *
 * Provides the full system prompt for the Gemini Live voice session.
 * Called once before the client connects to Gemini's WebSocket.
 *
 * Returns: system prompt built from user profile, persona, active session,
 * bundle data (from the Rules Engine), and recent history.
 *
 * This keeps the Rules Engine in control — the AI only explains/motivates
 * using structured data from the deterministic pipeline.
 */

import { Router, Response } from 'express';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { User, Session, Bundle } from '../models';
import { SessionTurn } from '../models/SessionTurn';
import { buildSystemPrompt } from '../prompts/buildPrompt';
import { basePersonality } from '../prompts/basePersonality';

const router = Router();

/**
 * GET /api/session/voice-context
 * Returns the full system prompt for a Gemini Live voice session.
 *
 * Query params:
 *   - session_id (optional): If provided, includes active session context
 *   - bundle_id (optional): If provided, includes bundle exercise data
 *
 * Returns:
 *   - systemPrompt: The assembled prompt for Gemini
 *   - session: Active session metadata (if any)
 *   - bundle: Active bundle data (if any)
 */
router.get('/voice-context', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findOne({ firebase_uid: req.uid });
    if (!user) {
      res.status(404).json({ error: 'Not Found', message: 'User not found' });
      return;
    }

    const { session_id, bundle_id } = req.query;

    // Get active session if exists
    let activeSession: any = null;
    if (session_id) {
      activeSession = await Session.findById(session_id).lean();
    } else {
      // Check for any in-progress session
      activeSession = await Session.findOne({
        user_id: user._id,
        status: 'in_progress',
      }).lean();
    }

    // Get active bundle
    let activeBundle: any = null;
    if (bundle_id) {
      activeBundle = await Bundle.findById(bundle_id).lean();
    } else if (activeSession) {
      activeBundle = await Bundle.findById(activeSession.bundle_id).lean();
    } else {
      // Get recommended bundle from active set
      activeBundle = await Bundle.findOne({
        user_id: user._id,
        active: true,
        is_recommended: true,
      }).lean();
      // Fallback to any active bundle
      if (!activeBundle) {
        activeBundle = await Bundle.findOne({ user_id: user._id, active: true }).lean();
      }
    }

    // Build session context for the prompt
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
          exercise_instructions: currentExercise.instructions_text || '',
        };
      }
    }

    // Get recent session summaries
    const recentSessions = await Session.find({
      user_id: user._id,
      status: { $in: ['full', 'partial'] },
    })
      .sort({ completed_at: -1 })
      .limit(3)
      .select('exercises_completed exercises_planned xp_awarded completed_at')
      .lean();

    const recentSummaries = recentSessions.map((s: any) =>
      `${s.exercises_completed}/${s.exercises_planned} exercises, ${s.xp_awarded} XP earned`
    );

    // Build the system prompt using existing prompt builder
    let systemPrompt = buildSystemPrompt({
      user,
      sessionContext,
      recentSummaries,
    });

    // Add voice-specific instructions
    systemPrompt += `

## Voice Session Rules
- Keep responses SHORT (1-3 sentences max during exercises, up to 4 between exercises)
- Never use markdown, bullet points, or formatting — you are speaking aloud
- Never say numbers with units like "kg" or "lbs" — only say rep counts and set numbers
- When the user says "done" or "finished", acknowledge and prompt for the next set or exercise
- When the user asks "what's next", tell them the next exercise from the plan
- If the user reports pain, stop immediately, acknowledge, and offer to skip or end
- Announce exercises clearly: name, then sets and rep range, then any form cues
- During rest periods, you can offer brief encouragement or form tips
- Never invent exercises — only reference what's in the current workout plan below`;

    // Add bundle exercise list to the prompt so AI knows the plan
    if (activeBundle) {
      systemPrompt += `

## Current Workout Plan: "${activeBundle.title}"
Focus: ${activeBundle.focus}
Duration: ~${activeBundle.estimated_duration_min} minutes
Exercises:`;
      for (let i = 0; i < activeBundle.exercises.length; i++) {
        const ex = activeBundle.exercises[i];
        const status = activeSession?.exercises[i]?.status || 'pending';
        systemPrompt += `
${i + 1}. ${ex.name} [${status}]
   - Phase: ${ex.workout_phase}
   - Sets: ${ex.sets}, Reps: ${ex.rep_min}-${ex.rep_max}, Rest: ${ex.rest_seconds}s
   - Muscles: ${ex.muscle_groups?.join(', ') || 'general'}
   - Instructions: ${ex.instructions_text || 'Standard form'}`;
      }
    } else {
      systemPrompt += `

## No Active Workout
The user doesn't have an active workout right now. You can:
- Chat about fitness, answer questions, explain exercises
- Suggest they generate a new workout plan
- Discuss their progress and goals`;
    }

    // Add gamification context
    systemPrompt += `

## User Progress
- Level: ${user.gamification.level} (${user.gamification.total_xp} XP total)
- Current streak: ${user.gamification.current_streak} days
- Longest streak: ${user.gamification.longest_streak} days`;

    res.json({
      systemPrompt,
      session: activeSession ? {
        id: activeSession._id,
        status: activeSession.status,
        exercises_completed: activeSession.exercises.filter((e: any) => e.status === 'completed').length,
        exercises_total: activeSession.exercises.length,
      } : null,
      bundle: activeBundle ? {
        id: activeBundle._id,
        title: activeBundle.title,
        focus: activeBundle.focus,
        exercise_count: activeBundle.exercises.length,
        estimated_duration_min: activeBundle.estimated_duration_min,
      } : null,
      user: {
        name: user.name,
        persona_tags: user.persona_tags,
        fitness_goal: user.fitness_goal,
      },
    });
  } catch (error: any) {
    console.error('Voice context error:', error.message);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to build voice context' });
  }
});

/**
 * GET /api/session/voice-context/demo
 * NO AUTH version for testing the voice-live demo page.
 * Uses a mock user profile to build a full system prompt.
 */
router.get('/voice-context/demo', async (req, res: Response) => {
  try {
    // Try to find any user with onboarding complete for demo purposes
    const user = await User.findOne({ onboarding_completed: true }).lean();

    let systemPrompt = basePersonality;

    // Add voice-specific instructions
    systemPrompt += `

## Voice Session Rules
- Keep responses SHORT (1-3 sentences max during exercises, up to 4 between exercises)
- Never use markdown, bullet points, or formatting — you are speaking aloud
- Never say numbers with units like "kg" or "lbs" — only say rep counts and set numbers
- When the user says "done" or "finished", acknowledge and prompt for the next set or exercise
- When the user asks "what's next", tell them the next exercise from the plan
- If the user reports pain, stop immediately, acknowledge, and offer to skip or end
- Announce exercises clearly: name, then sets and rep range, then any form cues
- During rest periods, you can offer brief encouragement or form tips
- Never invent exercises — only reference what's in the current workout plan below`;

    if (user) {
      systemPrompt += `

## About This User
- Name: ${(user as any).name || 'there'}
- Goal: ${(user as any).fitness_goal || 'general fitness'}
- Persona: ${(user as any).persona_tags?.join(', ') || 'fitness explorer'}
- Injuries: ${(user as any).injuries?.filter((i: string) => i !== 'none').join(', ') || 'none'}`;

      // Try to get an active bundle for this user
      const bundle = await Bundle.findOne({ user_id: (user as any)._id, active: true, is_recommended: true }).lean();
      if (bundle) {
        systemPrompt += `

## Current Workout Plan: "${bundle.title}"
Focus: ${bundle.focus}
Duration: ~${bundle.estimated_duration_min} minutes
Exercises:`;
        for (let i = 0; i < bundle.exercises.length; i++) {
          const ex = bundle.exercises[i];
          systemPrompt += `
${i + 1}. ${(ex as any).name}
   - Phase: ${(ex as any).workout_phase}
   - Sets: ${(ex as any).sets}, Reps: ${(ex as any).rep_min}-${(ex as any).rep_max}, Rest: ${(ex as any).rest_seconds}s
   - Instructions: ${(ex as any).instructions_text || 'Standard form'}`;
        }
      } else {
        systemPrompt += `

## No Active Workout
Chat freely about fitness. Suggest generating a new workout plan if the user wants to train.`;
      }
    } else {
      systemPrompt += `

## Demo Mode
No user profile found. Act as a friendly fitness companion. Offer general fitness advice and suggest the user complete onboarding for personalized workouts.`;
    }

    res.json({ systemPrompt });
  } catch (error: any) {
    console.error('Voice context demo error:', error.message);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to build demo voice context' });
  }
});

export default router;
