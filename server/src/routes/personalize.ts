import { Router, Response } from 'express';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { User } from '../models';
import { assignPersonaTags, calculateMetrics } from '../services/persona';

const router = Router();

/**
 * POST /api/personalize
 * Runs after onboarding is complete.
 * Calculates metrics (BMI, TDEE, MHR, Target Zone) and assigns persona tags.
 * Must complete BEFORE the user reaches the workout recommendation screen.
 */
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findOne({ firebase_uid: req.uid });

    if (!user) {
      res.status(404).json({ error: 'Not Found', message: 'User profile not found' });
      return;
    }

    // Validate required fields are present
    if (!user.age || !user.height_cm || !user.weight_kg || !user.fitness_goal || !user.activity_level) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Profile incomplete. Age, height, weight, fitness goal, and activity level are required before personalization.',
      });
      return;
    }

    // Calculate metrics
    const metrics = calculateMetrics(user);

    // Assign persona tags
    const personaTags = assignPersonaTags(user);

    // Update user document
    user.calculated_metrics = metrics;
    user.persona_tags = personaTags;
    user.onboarding_completed = true;

    // Award onboarding XP (one-time, 15 XP)
    if (user.gamification.total_xp === 0) {
      user.gamification.total_xp = 15;
      user.gamification.level = 1;
    }

    await user.save();

    res.json({
      persona_tags: personaTags,
      calculated_metrics: metrics,
    });
  } catch (error: any) {
    console.error('Personalization error:', error.message);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to run personalization' });
  }
});

export default router;
