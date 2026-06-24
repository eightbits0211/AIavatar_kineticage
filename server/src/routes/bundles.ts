import { Router, Response } from 'express';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { User } from '../models';
import { Bundle } from '../models/Bundle';
import { generateBundles } from '../services/rulesEngine';
import { sendCompanionMessage } from '../services/claude';
import { basePersonality } from '../prompts/basePersonality';
import mongoose from 'mongoose';

const router = Router();

/**
 * POST /api/bundles/generate
 * Generates 3-4 exercise bundles via the Rules Engine.
 * Optionally generates AI rationale text for each bundle.
 * Stores bundles in MongoDB and returns them.
 */
router.post('/generate', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findOne({ firebase_uid: req.uid });

    if (!user) {
      res.status(404).json({ error: 'Not Found', message: 'User profile not found' });
      return;
    }

    if (!user.onboarding_completed) {
      res.status(400).json({ error: 'Bad Request', message: 'Complete onboarding before generating bundles' });
      return;
    }

    // Get user-provided constraints (for regeneration with adjusted preferences)
    const { energy_level, available_time } = req.body || {};

    // If user provides a different time preference for this generation, temporarily override
    const effectiveUser = { ...user.toObject() };
    if (available_time && [15, 30, 45, 60].includes(available_time)) {
      effectiveUser.workout_duration = available_time;
    }

    // Get recent muscle groups from last session (if any)
    const recentSession = await mongoose.model('Session').findOne(
      { user_id: user._id, status: { $in: ['full', 'partial'] } },
      { exercises: 1 }
    ).sort({ started_at: -1 }).lean() as any;

    const recentMuscleGroups: string[] = recentSession?.exercises
      ?.flatMap((e: any) => e.muscle_groups || []) || [];

    // Run the Rules Engine
    const result = await generateBundles({ user: effectiveUser as any, recentMuscleGroups });

    if (result.bundles.length === 0) {
      res.status(500).json({ error: 'Generation Failed', message: 'Could not generate bundles. Exercise library may be insufficient for your profile.' });
      return;
    }

    // Generate AI rationale for each bundle (non-blocking — if AI fails, use fallback)
    const bundlesWithRationale = await Promise.all(
      result.bundles.map(async (bundle) => {
        let rationale = `A ${bundle.focus}-focused workout with ${bundle.exercises.length} exercises for ~${bundle.estimated_duration_min} minutes.`;

        try {
          const rationalePrompt = `Generate a single short sentence (max 20 words) explaining why this workout is a good choice. The workout is called "${bundle.title}", focuses on ${bundle.focus} muscles, and includes: ${bundle.exercises.map(e => e.name).join(', ')}. The user's goal is ${user.fitness_goal}. Do NOT mention specific weights.`;

          const response = await sendCompanionMessage(basePersonality, [], rationalePrompt);
          if (response.reply) {
            rationale = response.reply;
          }
        } catch {
          // AI unavailable — use generic fallback. Bundle generation never blocks on AI.
        }

        return { ...bundle, rationale };
      })
    );

    // Deactivate previous bundles for this user
    await Bundle.updateMany({ user_id: user._id, active: true }, { active: false });

    // Store new bundles in MongoDB
    const setId = new mongoose.Types.ObjectId();
    const storedBundles = await Bundle.insertMany(
      bundlesWithRationale.map(bundle => ({
        user_id: user._id,
        title: bundle.title,
        is_recommended: bundle.is_recommended,
        estimated_duration_min: bundle.estimated_duration_min,
        estimated_calorie_burn: bundle.estimated_calorie_burn,
        exercises: bundle.exercises.map(e => ({
          exercise_id: e.exercise_id,
          name: e.name,
          workout_phase: e.workout_phase,
          sets: e.sets,
          rep_min: e.rep_min,
          rep_max: e.rep_max,
          rest_seconds: e.rest_seconds,
          instructions_text: e.instructions_text,
          image_url: e.image_url,
          muscle_groups: e.muscle_groups,
        })),
        rationale: bundle.rationale,
        focus: bundle.focus,
        generation_context: {
          persona_tags: user.persona_tags,
          fitness_goal: user.fitness_goal,
          excluded_exercises: [],
          recent_muscle_groups: recentMuscleGroups,
        },
        set_id: setId,
        active: true,
      }))
    );

    res.json({
      bundles: storedBundles,
      generated_at: new Date().toISOString(),
      pipeline: result.pipeline,
    });
  } catch (error: any) {
    console.error('Bundle generation error:', error.message);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to generate bundles' });
  }
});

/**
 * GET /api/bundles/active
 * Returns the user's current active bundle set.
 */
router.get('/active', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findOne({ firebase_uid: req.uid });

    if (!user) {
      res.status(404).json({ error: 'Not Found', message: 'User profile not found' });
      return;
    }

    const bundles = await Bundle.find({ user_id: user._id, active: true }).lean();

    if (bundles.length === 0) {
      res.status(404).json({ error: 'Not Found', message: 'No active bundles. Generate new ones.' });
      return;
    }

    res.json({ bundles });
  } catch (error: any) {
    console.error('Get active bundles error:', error.message);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch bundles' });
  }
});

export default router;
