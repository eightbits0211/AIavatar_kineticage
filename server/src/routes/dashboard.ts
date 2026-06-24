import { Router, Response } from 'express';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { User, Session, Bundle } from '../models';
import { xpForNextLevel, BADGES } from '../services/gamification';

const router = Router();

/**
 * GET /api/dashboard
 * Returns aggregated dashboard data:
 * - Today's workout (active bundle or completed status)
 * - Streak (current + longest)
 * - XP / level / progress to next level
 * - Badges (earned + locked)
 * - Weekly progress (workouts completed vs planned)
 * - Recent workout history (last 5)
 * - Calories burned this week
 */
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findOne({ firebase_uid: req.uid });
    if (!user) {
      res.status(404).json({ error: 'Not Found', message: 'User not found' });
      return;
    }

    // ─── Today's workout ───
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const todaySession = await Session.findOne({
      user_id: user._id,
      started_at: { $gte: startOfToday },
    }).sort({ started_at: -1 }).lean();

    const activeBundles = await Bundle.find({ user_id: user._id, active: true }).lean();
    const recommendedBundle = activeBundles.find((b: any) => b.is_recommended) || activeBundles[0];

    let todaysWorkout: any;
    if (todaySession && (todaySession.status === 'full' || todaySession.status === 'partial')) {
      todaysWorkout = { state: 'completed', session_id: todaySession._id, status: todaySession.status };
    } else if (todaySession && todaySession.status === 'in_progress') {
      todaysWorkout = { state: 'in_progress', session_id: todaySession._id };
    } else if (recommendedBundle) {
      todaysWorkout = {
        state: 'ready',
        bundle_id: recommendedBundle._id,
        title: recommendedBundle.title,
        focus: recommendedBundle.focus,
        exercise_count: recommendedBundle.exercises.length,
        estimated_duration_min: recommendedBundle.estimated_duration_min,
      };
    } else {
      todaysWorkout = { state: 'no_plan', message: 'Generate a workout to get started' };
    }

    // ─── XP / Level ───
    const levelInfo = xpForNextLevel(user.gamification.total_xp);

    // ─── Badges (earned + locked) ───
    const earnedIds = new Set(user.gamification.badges.map((b: any) => b.badge_id));
    const badges = Object.values(BADGES).map((badge) => ({
      ...badge,
      earned: earnedIds.has(badge.badge_id),
      earned_at: user.gamification.badges.find((b: any) => b.badge_id === badge.badge_id)?.earned_at || null,
    }));

    // ─── Weekly progress ───
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay()); // Sunday
    startOfWeek.setHours(0, 0, 0, 0);

    const weekSessions = await Session.find({
      user_id: user._id,
      status: { $in: ['full', 'partial'] },
      completed_at: { $gte: startOfWeek },
    }).lean();

    const plannedPerWeek = user.workout_duration ? 3 : 3; // default plan; could come from routine
    const weeklyCompleted = weekSessions.length;

    // ─── Recent history (last 5) ───
    const recentSessions = await Session.find({
      user_id: user._id,
      status: { $in: ['full', 'partial'] },
    })
      .sort({ completed_at: -1 })
      .limit(5)
      .lean();

    const history = await Promise.all(
      recentSessions.map(async (s: any) => {
        const bundle = await Bundle.findById(s.bundle_id).select('title').lean() as any;
        const durationMin = s.completed_at && s.started_at
          ? Math.round((new Date(s.completed_at).getTime() - new Date(s.started_at).getTime()) / 60000)
          : 0;
        return {
          session_id: s._id,
          date: s.completed_at,
          bundle_title: bundle?.title || 'Workout',
          duration_min: durationMin,
          status: s.status,
          xp_awarded: s.xp_awarded,
        };
      })
    );

    // ─── Calories burned this week ───
    // Estimate from bundle calorie ranges (use midpoint)
    let caloriesLow = 0;
    let caloriesHigh = 0;
    for (const s of weekSessions) {
      const bundle = await Bundle.findById((s as any).bundle_id).select('estimated_calorie_burn').lean() as any;
      if (bundle?.estimated_calorie_burn) {
        caloriesLow += bundle.estimated_calorie_burn.low;
        caloriesHigh += bundle.estimated_calorie_burn.high;
      }
    }

    res.json({
      greeting: buildGreeting(user),
      persona_label: getPersonaLabel(user.persona_tags),
      todays_workout: todaysWorkout,
      streak: {
        current: user.gamification.current_streak,
        longest: user.gamification.longest_streak,
      },
      xp: {
        total: user.gamification.total_xp,
        level: levelInfo.current_level,
        xp_into_level: levelInfo.xp_into_level,
        xp_needed: levelInfo.xp_needed,
      },
      badges,
      weekly_progress: {
        completed: weeklyCompleted,
        planned: plannedPerWeek,
        calories_burned: { low: caloriesLow, high: caloriesHigh },
      },
      recent_history: history,
    });
  } catch (error: any) {
    console.error('Dashboard error:', error.message);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to load dashboard' });
  }
});

function buildGreeting(user: any): string {
  const name = user.name && user.name !== 'Guest' ? user.name : 'there';
  const streak = user.gamification.current_streak;
  if (streak >= 7) return `${name}, you're on a ${streak}-day streak! Incredible consistency.`;
  if (streak >= 1) return `Welcome back, ${name}! ${streak}-day streak going strong.`;
  return `Hey ${name}, ready to move today?`;
}

function getPersonaLabel(tags: string[]): string {
  // Friendly label for the dominant persona
  const labels: Record<string, string> = {
    complete_beginner: 'Getting Started',
    regular_gym_goer: 'Gym Regular',
    weight_loss_seeker: 'On a Mission',
    strength_training_user: 'Building Strength',
    home_workout_user: 'Home Warrior',
    office_professional: 'Desk Athlete',
    injury_recovery_user: 'Bouncing Back',
    ai_companion_seeker: 'Team Player',
    inconsistent_enthusiast: 'Finding Rhythm',
  };
  if (!tags || tags.length === 0) return 'Fitness Explorer';
  return labels[tags[0]] || 'Fitness Explorer';
}

export default router;
