import { Router, Response } from 'express';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { User, Session } from '../models';
import { SessionTurn } from '../models/SessionTurn';
import { sendCompanionMessage } from '../services/claude';
import { buildSystemPrompt } from '../prompts/buildPrompt';

const router = Router();

/**
 * POST /api/companion/message
 * Send a message to the AI companion.
 * Builds full context: user profile, persona, active session state, conversation history.
 */
router.post('/message', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { session_id, message, input_mode, current_state } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      res.status(400).json({ error: 'Bad Request', message: 'Message is required' });
      return;
    }

    // Get user profile
    const user = await User.findOne({ firebase_uid: req.uid });
    if (!user) {
      res.status(404).json({ error: 'Not Found', message: 'User profile not found' });
      return;
    }

    // Get recent conversation history (last 8 turns)
    let conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    if (session_id) {
      const recentTurns = await SessionTurn.find({ session_id })
        .sort({ timestamp: -1 })
        .limit(8)
        .lean();

      conversationHistory = recentTurns
        .reverse()
        .map(turn => ({
          role: (turn.role === 'companion' ? 'assistant' : 'user') as 'user' | 'assistant',
          content: turn.content,
        }));
    }

    // Build session context if we have an active session
    let sessionContext: any = undefined;
    if (session_id) {
      const session = await Session.findById(session_id).lean();
      if (session) {
        // Find current exercise (first one that's in_progress or pending)
        const currentExercise = session.exercises.find(
          (e: any) => e.status === 'in_progress' || e.status === 'pending'
        );

        const completedCount = session.exercises.filter((e: any) => e.status === 'completed').length;
        const remainingCount = session.exercises.filter(
          (e: any) => e.status === 'pending' || e.status === 'in_progress'
        ).length;

        if (currentExercise) {
          const completedSets = (currentExercise as any).sets.filter((s: any) => s.completed).length;
          const totalSets = (currentExercise as any).sets.length;

          sessionContext = {
            bundle_title: 'Current Workout',
            current_exercise: (currentExercise as any).exercise_name,
            current_set: completedSets + 1,
            total_sets: totalSets,
            target_reps: `${(currentExercise as any).sets[0]?.target_rep_min}-${(currentExercise as any).sets[0]?.target_rep_max}`,
            rest_seconds: (currentExercise as any).rest_seconds,
            exercises_remaining: remainingCount - 1,
            exercise_instructions: '', // Would come from exercise library lookup
          };
        }
      }
    }

    // Get recent session summaries for long-term context
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

    // Build system prompt with full context
    const systemPrompt = buildSystemPrompt({
      user,
      sessionContext,
      recentSummaries,
    });

    // Send to AI
    const { reply, action_intent } = await sendCompanionMessage(
      systemPrompt,
      conversationHistory,
      message.trim()
    );

    // Store conversation turns
    if (session_id) {
      await SessionTurn.create([
        {
          session_id,
          user_id: user._id,
          role: 'user',
          content: message.trim(),
          input_mode: input_mode || 'text',
          state_at_time: current_state || 'idle',
          action_intent: null,
        },
        {
          session_id,
          user_id: user._id,
          role: 'companion',
          content: reply,
          input_mode: 'text',
          state_at_time: current_state || 'idle',
          action_intent,
        },
      ]);
    }

    res.json({
      reply,
      action_intent,
    });
  } catch (error: any) {
    console.error('Companion message error:', error.message);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to get companion response',
      service: 'ai',
    });
  }
});

export default router;
