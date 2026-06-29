import { Router, Response } from 'express';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { User, Session, Bundle } from '../models';
import { evaluateProgression } from '../services/progression';
import {
  calculateSessionXP,
  calculateLevel,
  updateStreak,
  evaluateBadges,
} from '../services/gamification';
import mongoose from 'mongoose';

const router = Router();

/**
 * POST /api/session/start
 * Starts a new workout session from a selected bundle.
 * Creates a Session record with all exercises from the bundle.
 */
router.post('/start', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { bundle_id } = req.body;

    if (!bundle_id) {
      res.status(400).json({ error: 'Bad Request', message: 'bundle_id is required' });
      return;
    }

    const user = await User.findOne({ firebase_uid: req.uid });
    if (!user) {
      res.status(404).json({ error: 'Not Found', message: 'User not found' });
      return;
    }

    const bundle = await Bundle.findById(bundle_id);
    if (!bundle) {
      res.status(404).json({ error: 'Not Found', message: 'Bundle not found' });
      return;
    }

    // Check if there's an existing in-progress session (for resume)
    const existingSession = await Session.findOne({
      user_id: user._id,
      status: 'in_progress',
    });

    if (existingSession) {
      // Return existing session for resume
      res.json({
        session_id: existingSession._id,
        resumed: true,
        exercises: existingSession.exercises,
        message: 'Resuming your previous session.',
      });
      return;
    }

    // Create new session with exercises from bundle
    const session = new Session({
      user_id: user._id,
      bundle_id: bundle._id,
      started_at: new Date(),
      status: 'in_progress',
      exercises: bundle.exercises.map((ex: any) => ({
        exercise_id: ex.exercise_id,
        exercise_name: ex.name,
        status: 'pending',
        feedback: null,
        skip_reason: null,
        sets: Array.from({ length: ex.sets }, (_, i) => ({
          set_number: i + 1,
          target_rep_min: ex.rep_min,
          target_rep_max: ex.rep_max,
          actual_reps: null,
          completed: false,
          completed_at: null,
        })),
        rest_seconds: ex.rest_seconds,
      })),
      pain_events: [],
      xp_awarded: 0,
      progression_flags: [],
    });

    await session.save();

    res.status(201).json({
      session_id: session._id,
      resumed: false,
      exercises: session.exercises,
      message: `Let's go! ${bundle.title} — ${bundle.exercises.length} exercises.`,
    });
  } catch (error: any) {
    console.error('Session start error:', error.message);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to start session' });
  }
});

/**
 * PUT /api/session/:id/exercise
 * Updates an exercise's status within a session.
 * Used for: marking complete, skipping, reporting pain, logging set reps, giving feedback.
 */
router.put('/:id/exercise', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { exercise_id, action, data } = req.body;

    // action: 'complete_set' | 'complete_exercise' | 'skip' | 'pain' | 'feedback'
    if (!exercise_id || !action) {
      res.status(400).json({ error: 'Bad Request', message: 'exercise_id and action are required' });
      return;
    }

    const session = await Session.findById(id);
    if (!session) {
      res.status(404).json({ error: 'Not Found', message: 'Session not found' });
      return;
    }

    if (session.status !== 'in_progress') {
      res.status(400).json({ error: 'Bad Request', message: 'Session is not in progress' });
      return;
    }

    const exerciseIndex = session.exercises.findIndex(
      (e: any) => e.exercise_id === exercise_id
    );

    if (exerciseIndex === -1) {
      res.status(404).json({ error: 'Not Found', message: 'Exercise not found in session' });
      return;
    }

    const exercise = session.exercises[exerciseIndex];

    switch (action) {
      case 'complete_set': {
        // data: { set_number, actual_reps }
        const { set_number, actual_reps } = data || {};
        const setIndex = exercise.sets.findIndex((s: any) => s.set_number === set_number);
        if (setIndex !== -1) {
          exercise.sets[setIndex].actual_reps = actual_reps;
          exercise.sets[setIndex].completed = true;
          exercise.sets[setIndex].completed_at = new Date();
        }
        exercise.status = 'in_progress';
        break;
      }

      case 'complete_exercise': {
        // data: { feedback? } — "felt_easy" | "felt_normal" | "felt_hard"
        exercise.status = 'completed';
        if (data?.feedback) {
          exercise.feedback = data.feedback;
        }
        break;
      }

      case 'skip': {
        // data: { reason? }
        exercise.status = 'skipped';
        exercise.skip_reason = data?.reason || null;
        break;
      }

      case 'pain': {
        // data: { body_area }
        exercise.status = 'pain_stopped';
        session.pain_events.push({
          exercise_id: exercise.exercise_id,
          body_area: data?.body_area || 'unspecified',
          timestamp: new Date(),
        } as any);
        break;
      }

      case 'feedback': {
        // data: { feedback } — "felt_easy" | "felt_normal" | "felt_hard"
        exercise.feedback = data?.feedback || null;
        break;
      }

      default:
        res.status(400).json({ error: 'Bad Request', message: `Unknown action: ${action}` });
        return;
    }

    session.exercises[exerciseIndex] = exercise;
    await session.save();

    res.json({
      exercise_id,
      status: exercise.status,
      feedback: exercise.feedback,
      sets: exercise.sets,
    });
  } catch (error: any) {
    console.error('Exercise update error:', error.message);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to update exercise' });
  }
});

/**
 * POST /api/session/:id/end
 * Ends a session — calculates completion status, XP, streak, progression, and badges.
 * Status: "full" (all done), "partial" (≥50%), "abandoned" (<50%)
 */
router.post('/:id/end', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const session = await Session.findById(id);
    if (!session) {
      res.status(404).json({ error: 'Not Found', message: 'Session not found' });
      return;
    }

    if (session.status !== 'in_progress') {
      res.status(400).json({ error: 'Bad Request', message: 'Session is not in progress' });
      return;
    }

    // Calculate completion
    const totalExercises = session.exercises.length;
    const completedExercises = session.exercises.filter(
      (e: any) => e.status === 'completed'
    ).length;
    const completionRatio = totalExercises === 0 ? 0 : completedExercises / totalExercises;

    let status: 'full' | 'partial' | 'abandoned';
    if (completionRatio === 1) status = 'full';
    else if (completionRatio >= 0.5) status = 'partial';
    else status = 'abandoned';

    const user = await User.findById(session.user_id);

    // Evaluate progression (returns flags for rep increases, deloads)
    let progressionFlags: any[] = [];
    if (status !== 'abandoned') {
      session.status = status; // temporarily set so progression sees correct state
      progressionFlags = await evaluateProgression(session);
      session.progression_flags = progressionFlags;
    }

    let xpResult = { xp_awarded: 0, breakdown: [] as any[] };
    let streakResult: any = null;
    let newBadges: any[] = [];

    if (user) {
      // Calculate days since last workout BEFORE updating (needed for Comeback badge)
      const daysSinceLastWorkout = user.gamification.last_workout_date
        ? Math.floor((Date.now() - new Date(user.gamification.last_workout_date).getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      // Check if this is the first workout
      const previousSessions = await Session.countDocuments({
        user_id: user._id,
        status: { $in: ['full', 'partial'] },
        _id: { $ne: session._id },
      });
      const isFirstWorkout = previousSessions === 0;

      // Calculate XP
      xpResult = calculateSessionXP({
        status,
        isFirstWorkout,
        progressionMilestones: progressionFlags.filter(
          (f) => f.type === 'rep_increase' || f.type === 'set_increase'
        ).length,
      });

      // Update streak (only for non-abandoned sessions)
      if (status !== 'abandoned') {
        streakResult = updateStreak(user);
        user.gamification.current_streak = streakResult.current_streak;
        user.gamification.longest_streak = streakResult.longest_streak;
        user.gamification.grace_days_used_this_week = streakResult.grace_days_used_this_week;
        user.gamification.last_workout_date = new Date();

        // Add streak milestone bonus XP
        if (streakResult.bonus_xp > 0) {
          xpResult.xp_awarded += streakResult.bonus_xp;
          xpResult.breakdown.push({ source: `${streakResult.streak_milestone}-day streak`, amount: streakResult.bonus_xp });
        }
      }

      // Apply XP
      user.gamification.total_xp += xpResult.xp_awarded;
      user.gamification.level = calculateLevel(user.gamification.total_xp);

      // Evaluate badges
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const sessionsLast7Days = await Session.countDocuments({
        user_id: user._id,
        status: { $in: ['full', 'partial'] },
        completed_at: { $gte: sevenDaysAgo },
      });
      const totalCompleted = previousSessions + (status !== 'abandoned' ? 1 : 0);

      newBadges = evaluateBadges({
        totalCompletedSessions: totalCompleted,
        sessionsLast7Days: sessionsLast7Days + (status !== 'abandoned' ? 1 : 0),
        currentStreak: user.gamification.current_streak,
        daysSinceLastWorkoutBeforeThis: daysSinceLastWorkout,
        progressionMilestonesEver: progressionFlags.length,
        goalCategorySessions: totalCompleted,
        alreadyEarned: user.gamification.badges.map((b: any) => b.badge_id),
      });

      // Store new badges
      for (const badge of newBadges) {
        user.gamification.badges.push({ badge_id: badge.badge_id, earned_at: new Date() } as any);
      }

      await user.save();
    }

    // Update session
    session.status = status;
    session.completed_at = new Date();
    session.xp_awarded = xpResult.xp_awarded;
    session.exercises_completed = completedExercises;
    session.exercises_planned = totalExercises;

    // Calculate calories from bundle's estimate, scaled by completion ratio
    let caloriesBurned = 0;
    try {
      const bundle = await Bundle.findById(session.bundle_id).lean() as any;
      if (bundle?.estimated_calorie_burn) {
        // Use midpoint of the bundle's calorie range, scaled by how much was completed
        const midCalories = (bundle.estimated_calorie_burn.low + bundle.estimated_calorie_burn.high) / 2;
        caloriesBurned = Math.round(midCalories * completionRatio);
      }
    } catch {
      // Bundle lookup failed — use a duration-based estimate as fallback
      const durationMin = session.completed_at && session.started_at
        ? Math.round((new Date(session.completed_at).getTime() - new Date(session.started_at).getTime()) / 60000)
        : 30;
      caloriesBurned = Math.round(durationMin * 6 * completionRatio); // ~6 cal/min average
    }
    session.calories_burned = caloriesBurned;

    await session.save();

    res.json({
      status,
      exercises_completed: completedExercises,
      exercises_planned: totalExercises,
      completion_ratio: Math.round(completionRatio * 100),
      calories_burned: caloriesBurned,
      xp_awarded: xpResult.xp_awarded,
      xp_breakdown: xpResult.breakdown,
      new_total_xp: user?.gamification.total_xp || 0,
      level: user?.gamification.level || 1,
      streak: {
        current: user?.gamification.current_streak || 0,
        longest: user?.gamification.longest_streak || 0,
        milestone: streakResult?.streak_milestone || null,
      },
      progression_flags: progressionFlags,
      badges_earned: newBadges,
    });
  } catch (error: any) {
    console.error('Session end error:', error.message);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to end session' });
  }
});

/**
 * POST /api/session/:id/pause
 * Pauses an active session (just marks the state — timer logic is client-side).
 */
router.post('/:id/pause', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const session = await Session.findById(req.params.id);
    if (!session || session.status !== 'in_progress') {
      res.status(404).json({ error: 'Not Found', message: 'No active session found' });
      return;
    }

    // Store pause timestamp (used for resume window check)
    (session as any).paused_at = new Date();
    await session.save();

    res.json({ message: 'Session paused', session_id: session._id });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to pause session' });
  }
});

/**
 * GET /api/session/active
 * Returns the user's current in-progress session (if any) for resume.
 */
router.get('/active', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findOne({ firebase_uid: req.uid });
    if (!user) {
      res.status(404).json({ error: 'Not Found', message: 'User not found' });
      return;
    }

    const session = await Session.findOne({
      user_id: user._id,
      status: 'in_progress',
    });

    if (!session) {
      res.json({ has_active_session: false });
      return;
    }

    // Check resume window (30 minutes)
    const pausedAt = (session as any).paused_at;
    if (pausedAt) {
      const minutesSincePause = (Date.now() - new Date(pausedAt).getTime()) / 60000;
      if (minutesSincePause > 30) {
        // Expired — mark as abandoned
        session.status = 'abandoned';
        session.completed_at = new Date();
        await session.save();
        res.json({ has_active_session: false, expired: true });
        return;
      }
    }

    res.json({
      has_active_session: true,
      session,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to check active session' });
  }
});

export default router;
