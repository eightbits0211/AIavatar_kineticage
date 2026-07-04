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
      // If session is older than 4 hours, mark it as abandoned and create a new one
      const sessionAge = Date.now() - new Date(existingSession.started_at).getTime();
      const FOUR_HOURS = 4 * 60 * 60 * 1000;

      if (sessionAge > FOUR_HOURS) {
        existingSession.status = 'abandoned' as any;
        existingSession.completed_at = new Date();
        await existingSession.save();
        console.log(`[Session] Abandoned stale session: ${existingSession._id}`);
      } else {
        // Return existing session for resume
        res.json({
          session_id: existingSession._id,
          resumed: true,
          exercises: existingSession.exercises,
          message: 'Resuming your previous session.',
        });
        return;
      }
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

    // Calculate calories based on actual work completed
    // Formula: For each exercise, estimate calories from actual sets × actual reps completed
    // Base rate: ~0.15 kcal per rep for strength exercises (varies by muscle group size)
    // Scale by user weight (heavier people burn more)
    let caloriesBurned = 0;
    try {
      const userWeightKg = user?.weight_kg || 70;
      const weightMultiplier = userWeightKg / 70; // normalize to 70kg baseline

      // Large muscle groups burn more per rep
      const muscleGroupCalories: Record<string, number> = {
        quadriceps: 0.20, glutes: 0.20, hamstrings: 0.18, chest: 0.15,
        upper_back: 0.15, lats: 0.15, core: 0.10, shoulders: 0.12,
        biceps: 0.08, triceps: 0.08, calves: 0.08, forearms: 0.06,
        full_body: 0.25, hip_flexors: 0.10, lower_back: 0.12,
        cardiovascular_system: 0.30,
      };

      for (const ex of session.exercises) {
        if (ex.status === 'completed' || ex.status === 'in_progress') {
          // Sum actual reps across all completed sets
          const totalRepsCompleted = ex.sets.reduce((sum: number, set: any) => {
            if (set.completed && set.actual_reps) {
              return sum + set.actual_reps;
            } else if (set.completed) {
              // Set marked done but no reps logged — use target midpoint as estimate
              return sum + Math.round((set.target_rep_min + set.target_rep_max) / 2);
            }
            return sum;
          }, 0);

          // Get calorie rate based on primary muscle group
          const primaryMuscle = (ex as any).muscle_groups?.[0] || 'core';
          const calPerRep = muscleGroupCalories[primaryMuscle] || 0.12;

          caloriesBurned += totalRepsCompleted * calPerRep * weightMultiplier;
        }
      }

      // Add base metabolic cost (being active for the session duration)
      const durationMin = session.completed_at && session.started_at
        ? Math.round((new Date(session.completed_at).getTime() - new Date(session.started_at).getTime()) / 60000)
        : 30;
      caloriesBurned += durationMin * 2 * weightMultiplier; // ~2 kcal/min base for being active

      caloriesBurned = Math.round(caloriesBurned);
    } catch {
      // Fallback: use bundle estimate scaled by completion ratio
      try {
        const bundle = await Bundle.findById(session.bundle_id).lean() as any;
        if (bundle?.estimated_calorie_burn) {
          const midCalories = (bundle.estimated_calorie_burn.low + bundle.estimated_calorie_burn.high) / 2;
          caloriesBurned = Math.round(midCalories * completionRatio);
        }
      } catch {
        const durationMin = session.completed_at && session.started_at
          ? Math.round((new Date(session.completed_at).getTime() - new Date(session.started_at).getTime()) / 60000)
          : 30;
        caloriesBurned = Math.round(durationMin * 6 * completionRatio);
      }
    }
    session.calories_burned = caloriesBurned;

    await session.save();

    // Auto-regenerate bundles for next workout (non-blocking)
    try {
      const { generateBundles } = await import('../services/rulesEngine');
      const recentMuscles: string[] = [];
      for (const ex of session.exercises) {
        if (ex.status === 'completed' && (ex as any).muscle_groups) {
          recentMuscles.push(...(ex as any).muscle_groups);
        }
      }
      await Bundle.updateMany({ user_id: user!._id, active: true }, { active: false });
      const bundleResult = await generateBundles({ user: user as any, recentMuscleGroups: [...new Set(recentMuscles)] });
      if (bundleResult.bundles.length > 0) {
        const setId = new mongoose.Types.ObjectId();
        await Bundle.insertMany(
          bundleResult.bundles.map(bundle => ({
            user_id: user!._id,
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
              image_url_end: e.image_url_end || '',
              muscle_groups: e.muscle_groups,
            })),
            focus: bundle.focus,
            generation_context: {
              persona_tags: user!.persona_tags,
              fitness_goal: user!.fitness_goal,
              excluded_exercises: [],
              recent_muscle_groups: [...new Set(recentMuscles)],
            },
            set_id: setId,
            active: true,
          }))
        );
      }
    } catch (genErr) {
      console.error('[Session End] Auto-regeneration failed, retrying once:', (genErr as Error).message);
      // One retry after 2 seconds
      setTimeout(async () => {
        try {
          const { generateBundles } = await import('../services/rulesEngine');
          const retryUser = await User.findById(user!._id);
          if (retryUser) {
            await Bundle.updateMany({ user_id: user!._id, active: true }, { active: false });
            const result = await generateBundles({ user: retryUser as any, recentMuscleGroups: [] });
            if (result.bundles.length > 0) {
              const mongoose = await import('mongoose');
              const setId = new mongoose.default.Types.ObjectId();
              await Bundle.insertMany(result.bundles.map(b => ({
                user_id: user!._id, title: b.title, is_recommended: b.is_recommended,
                estimated_duration_min: b.estimated_duration_min, estimated_calorie_burn: b.estimated_calorie_burn,
                exercises: b.exercises.map(e => ({ exercise_id: e.exercise_id, name: e.name, workout_phase: e.workout_phase, sets: e.sets, rep_min: e.rep_min, rep_max: e.rep_max, rest_seconds: e.rest_seconds, instructions_text: e.instructions_text, image_url: e.image_url, image_url_end: e.image_url_end || '', muscle_groups: e.muscle_groups })),
                focus: b.focus, generation_context: { persona_tags: retryUser.persona_tags, fitness_goal: retryUser.fitness_goal, excluded_exercises: [], recent_muscle_groups: [] },
                set_id: setId, active: true,
              })));
              console.log('[Session End] Retry succeeded');
            }
          }
        } catch (retryErr) {
          console.error('[Session End] Retry also failed:', (retryErr as Error).message);
        }
      }, 2000);
    }

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
