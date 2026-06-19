import { Router, Response } from 'express';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { User, DailyCheckin } from '../models';
import { calculateLevel, DAILY_CHECKIN_XP } from '../services/gamification';

const router = Router();

/**
 * POST /api/daily-checkin
 * Submits a daily check-in (energy + soreness).
 * Awards 10 XP (once per day). Soreness data informs future workout selection.
 */
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { energy_level, soreness } = req.body;

    if (!energy_level || !['low', 'medium', 'high'].includes(energy_level)) {
      res.status(400).json({ error: 'Bad Request', message: 'energy_level (low/medium/high) is required' });
      return;
    }

    const user = await User.findOne({ firebase_uid: req.uid });
    if (!user) {
      res.status(404).json({ error: 'Not Found', message: 'User not found' });
      return;
    }

    // Check if already checked in today
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const existingCheckin = await DailyCheckin.findOne({
      user_id: user._id,
      date: { $gte: startOfDay },
    });

    if (existingCheckin) {
      res.status(409).json({
        error: 'Conflict',
        message: 'Already checked in today',
        checkin: existingCheckin,
      });
      return;
    }

    // Create check-in
    const checkin = new DailyCheckin({
      user_id: user._id,
      date: new Date(),
      energy_level,
      soreness: Array.isArray(soreness) ? soreness : [],
      xp_awarded: DAILY_CHECKIN_XP,
    });
    await checkin.save();

    // Award XP
    user.gamification.total_xp += DAILY_CHECKIN_XP;
    user.gamification.level = calculateLevel(user.gamification.total_xp);
    await user.save();

    res.status(201).json({
      checkin,
      xp_awarded: DAILY_CHECKIN_XP,
      new_total_xp: user.gamification.total_xp,
      level: user.gamification.level,
      message: 'Thanks for checking in! Your feedback helps me plan your next workout.',
    });
  } catch (error: any) {
    console.error('Daily check-in error:', error.message);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to submit check-in' });
  }
});

/**
 * GET /api/daily-checkin/today
 * Returns today's check-in if one exists.
 */
router.get('/today', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findOne({ firebase_uid: req.uid });
    if (!user) {
      res.status(404).json({ error: 'Not Found', message: 'User not found' });
      return;
    }

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const checkin = await DailyCheckin.findOne({
      user_id: user._id,
      date: { $gte: startOfDay },
    });

    res.json({ checked_in_today: !!checkin, checkin: checkin || null });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch check-in' });
  }
});

export default router;
