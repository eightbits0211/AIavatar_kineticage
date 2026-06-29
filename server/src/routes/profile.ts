import { Router, Response } from 'express';
import { User } from '../models';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { calculateMetrics, assignPersonaTags } from '../services/persona';

const router = Router();

// GET /api/profile — Get current user's profile
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findOne({ firebase_uid: req.uid });

    if (!user) {
      res.status(404).json({ error: 'Not Found', message: 'User profile not found' });
      return;
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch profile' });
  }
});

// PUT /api/profile — Update user profile (recalculates metrics if relevant fields change)
router.put('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findOneAndUpdate(
      { firebase_uid: req.uid },
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!user) {
      res.status(404).json({ error: 'Not Found', message: 'User profile not found' });
      return;
    }

    // Recalculate metrics if any relevant field was updated
    const metricsFields = ['age', 'height_cm', 'weight_kg', 'gender', 'activity_level'];
    const personaFields = ['fitness_goal', 'fitness_level', 'activity_level', 'workout_location', 'equipment', 'injuries', 'workout_duration', 'prior_program_experience'];

    const updatedFields = Object.keys(req.body);
    const needsMetricsRecalc = updatedFields.some(f => metricsFields.includes(f));
    const needsPersonaRecalc = updatedFields.some(f => personaFields.includes(f));

    if (needsMetricsRecalc && user.age && user.height_cm && user.weight_kg) {
      user.calculated_metrics = calculateMetrics(user);
    }

    if (needsPersonaRecalc) {
      user.persona_tags = assignPersonaTags(user);
    }

    if (needsMetricsRecalc || needsPersonaRecalc) {
      await user.save();
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to update profile' });
  }
});

// POST /api/profile/create — Create user profile after Firebase signup
router.post('/create', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const existingUser = await User.findOne({ firebase_uid: req.uid });

    if (existingUser) {
      res.json(existingUser);
      return;
    }

    const user = new User({
      firebase_uid: req.uid,
      name: req.body.name || '',
      email: req.body.email || '',
      onboarding_completed: false,
    });

    await user.save();
    res.status(201).json(user);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to create profile' });
  }
});

export default router;
