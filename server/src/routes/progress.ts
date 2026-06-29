import { Router, Response } from 'express';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { User, Session } from '../models';
import { Bundle } from '../models/Bundle';
import { ExerciseProgression } from '../models/ExerciseProgression';

const router = Router();

/**
 * GET /api/progress/history
 * Returns all completed/partial sessions with details.
 * Supports pagination via ?page=1&limit=10
 */
router.get('/history', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findOne({ firebase_uid: req.uid });
    if (!user) { res.status(404).json({ error: 'Not Found', message: 'User not found' }); return; }

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const sessions = await Session.find({
      user_id: user._id,
      status: { $in: ['full', 'partial'] },
    })
      .sort({ completed_at: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Session.countDocuments({
      user_id: user._id,
      status: { $in: ['full', 'partial'] },
    });

    const history = await Promise.all(
      sessions.map(async (s: any) => {
        const bundle = await Bundle.findById(s.bundle_id).select('title focus').lean() as any;
        const durationMin = s.completed_at && s.started_at
          ? Math.round((new Date(s.completed_at).getTime() - new Date(s.started_at).getTime()) / 60000)
          : 0;
        return {
          session_id: s._id,
          date: s.completed_at,
          bundle_title: bundle?.title || 'Workout',
          focus: bundle?.focus || 'mixed',
          duration_min: durationMin,
          status: s.status,
          exercises_completed: s.exercises_completed || s.exercises.filter((e: any) => e.status === 'completed').length,
          exercises_planned: s.exercises_planned || s.exercises.length,
          calories_burned: s.calories_burned || 0,
          xp_awarded: s.xp_awarded,
          exercises: s.exercises.map((e: any) => ({
            name: e.exercise_name,
            status: e.status,
            feedback: e.feedback,
            sets_completed: e.sets.filter((set: any) => set.completed).length,
            total_sets: e.sets.length,
          })),
        };
      })
    );

    res.json({ history, page, limit, total, total_pages: Math.ceil(total / limit) });
  } catch (error: any) {
    console.error('Progress history error:', error.message);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch history' });
  }
});

/**
 * GET /api/progress/weekly
 * Returns weekly and monthly activity aggregation.
 * ?range=week (default) or ?range=month
 */
router.get('/weekly', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findOne({ firebase_uid: req.uid });
    if (!user) { res.status(404).json({ error: 'Not Found', message: 'User not found' }); return; }

    const range = (req.query.range as string) || 'week';
    const now = new Date();
    let startDate: Date;

    if (range === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
      startDate = new Date(now);
      startDate.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
      startDate.setHours(0, 0, 0, 0);
    }

    const sessions = await Session.find({
      user_id: user._id,
      status: { $in: ['full', 'partial'] },
      completed_at: { $gte: startDate },
    }).lean();

    // Aggregate by day
    const dayMap: Record<string, number> = {};
    let totalSets = 0;
    let totalReps = 0;
    let totalXP = 0;

    for (const s of sessions) {
      const day = new Date(s.completed_at!).toISOString().split('T')[0];
      dayMap[day] = (dayMap[day] || 0) + 1;
      totalXP += s.xp_awarded || 0;

      for (const ex of s.exercises) {
        for (const set of (ex as any).sets) {
          if (set.completed) {
            totalSets++;
            totalReps += set.actual_reps || 0;
          }
        }
      }
    }

    // Previous period for comparison
    let prevStartDate: Date;
    if (range === 'month') {
      prevStartDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    } else {
      prevStartDate = new Date(startDate);
      prevStartDate.setDate(prevStartDate.getDate() - 7);
    }

    const prevSessions = await Session.countDocuments({
      user_id: user._id,
      status: { $in: ['full', 'partial'] },
      completed_at: { $gte: prevStartDate, $lt: startDate },
    });

    res.json({
      range,
      current_period: {
        sessions: sessions.length,
        total_sets: totalSets,
        total_reps: totalReps,
        total_xp: totalXP,
        days_active: Object.keys(dayMap).length,
        by_day: dayMap,
      },
      previous_period: {
        sessions: prevSessions,
      },
      change: sessions.length - prevSessions,
    });
  } catch (error: any) {
    console.error('Progress weekly error:', error.message);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch weekly data' });
  }
});

/**
 * GET /api/progress/goal
 * Tracks progress toward the user's stated fitness goal.
 * Shows: total workouts in category, streak toward goal, consistency rate.
 */
router.get('/goal', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findOne({ firebase_uid: req.uid });
    if (!user) { res.status(404).json({ error: 'Not Found', message: 'User not found' }); return; }

    const totalSessions = await Session.countDocuments({
      user_id: user._id,
      status: { $in: ['full', 'partial'] },
    });

    // Sessions in the last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentSessions = await Session.countDocuments({
      user_id: user._id,
      status: { $in: ['full', 'partial'] },
      completed_at: { $gte: thirtyDaysAgo },
    });

    // Consistency: sessions per week on average
    const firstSession = await Session.findOne({ user_id: user._id, status: { $in: ['full', 'partial'] } }).sort({ completed_at: 1 }).lean();
    let weeksActive = 1;
    if (firstSession?.completed_at) {
      weeksActive = Math.max(1, Math.ceil((Date.now() - new Date(firstSession.completed_at).getTime()) / (7 * 24 * 60 * 60 * 1000)));
    }
    const sessionsPerWeek = Math.round((totalSessions / weeksActive) * 10) / 10;

    // Progression milestones
    const progressions = await ExerciseProgression.countDocuments({
      user_id: user._id,
      progression_state: { $in: ['ready_to_progress', 'stable'] },
    });

    res.json({
      fitness_goal: user.fitness_goal,
      total_workouts: totalSessions,
      workouts_last_30_days: recentSessions,
      sessions_per_week_avg: sessionsPerWeek,
      weeks_active: weeksActive,
      current_streak: user.gamification.current_streak,
      longest_streak: user.gamification.longest_streak,
      exercises_progressed: progressions,
      level: user.gamification.level,
      total_xp: user.gamification.total_xp,
    });
  } catch (error: any) {
    console.error('Progress goal error:', error.message);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch goal progress' });
  }
});

/**
 * GET /api/progress/insights
 * Simple improvement insights based on historical data.
 * Returns trend observations the user can see.
 */
router.get('/insights', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findOne({ firebase_uid: req.uid });
    if (!user) { res.status(404).json({ error: 'Not Found', message: 'User not found' }); return; }

    const insights: Array<{ type: string; message: string }> = [];

    // Insight 1: Consistency comparison (this week vs last)
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfLastWeek = new Date(startOfWeek);
    startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);

    const thisWeek = await Session.countDocuments({ user_id: user._id, status: { $in: ['full', 'partial'] }, completed_at: { $gte: startOfWeek } });
    const lastWeek = await Session.countDocuments({ user_id: user._id, status: { $in: ['full', 'partial'] }, completed_at: { $gte: startOfLastWeek, $lt: startOfWeek } });

    if (thisWeek > lastWeek && lastWeek > 0) {
      const pct = Math.round(((thisWeek - lastWeek) / lastWeek) * 100);
      insights.push({ type: 'consistency_up', message: `You've worked out ${pct}% more this week than last. Keep it up!` });
    } else if (thisWeek === lastWeek && thisWeek > 0) {
      insights.push({ type: 'consistency_steady', message: `Consistent! Same number of workouts as last week.` });
    } else if (lastWeek > 0 && thisWeek < lastWeek) {
      insights.push({ type: 'consistency_down', message: `A bit quieter this week — that's okay. Every session counts.` });
    }

    // Insight 2: Streak
    if (user.gamification.current_streak >= 7) {
      insights.push({ type: 'streak', message: `${user.gamification.current_streak}-day streak! That's serious consistency.` });
    } else if (user.gamification.current_streak >= 3) {
      insights.push({ type: 'streak', message: `${user.gamification.current_streak}-day streak building. A few more days to hit a week!` });
    }

    // Insight 3: Progression milestones
    const progressedExercises = await ExerciseProgression.find({ user_id: user._id, consecutive_top_completions: { $gte: 1 } }).lean();
    if (progressedExercises.length > 0) {
      insights.push({ type: 'progression', message: `You're close to progressing on ${progressedExercises.length} exercise(s). Keep hitting those top reps!` });
    }

    // Insight 4: Total workouts milestone
    const total = await Session.countDocuments({ user_id: user._id, status: { $in: ['full', 'partial'] } });
    if (total === 10 || total === 25 || total === 50 || total === 100) {
      insights.push({ type: 'milestone', message: `${total} workouts completed! That's a real milestone.` });
    }

    // Placeholder if no insights yet
    if (insights.length === 0) {
      insights.push({ type: 'getting_started', message: `Keep going! After a few more workouts, you'll start seeing trends and insights here.` });
    }

    res.json({ insights });
  } catch (error: any) {
    console.error('Progress insights error:', error.message);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch insights' });
  }
});

/**
 * GET /api/progress/strength
 * Returns per-exercise strength progression data.
 * For each exercise with history, returns: name, start_reps, current_reps, change.
 * Supports ?range=week|month (filters history entries by date).
 */
router.get('/strength', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findOne({ firebase_uid: req.uid });
    if (!user) { res.status(404).json({ error: 'Not Found', message: 'User not found' }); return; }

    const range = (req.query.range as string) || 'all';
    let dateFilter: Date | null = null;

    if (range === 'week') {
      dateFilter = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    } else if (range === 'month') {
      dateFilter = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }

    const progressions = await ExerciseProgression.find({ user_id: user._id }).lean();

    const strengthData = progressions
      .filter(p => p.history && p.history.length >= 1)
      .map(p => {
        // Apply date filter if specified
        let history = p.history.filter((h: any) => !h.skipped && h.reps_achieved && h.reps_achieved.length > 0);
        if (dateFilter) {
          history = history.filter((h: any) => new Date(h.date) >= dateFilter!);
        }

        if (history.length === 0) return null;

        // Average reps across sets for each session
        const avgReps = (entry: any) => {
          const reps = entry.reps_achieved as number[];
          return reps.length > 0 ? Math.round(reps.reduce((a: number, b: number) => a + b, 0) / reps.length) : 0;
        };

        const startReps = avgReps(history[0]);
        const currentReps = avgReps(history[history.length - 1]);
        const change = currentReps - startReps;

        return {
          exercise_id: p.exercise_id,
          name: p.exercise_id, // Will be enriched below
          start_reps: startReps,
          current_reps: currentReps,
          change,
          sessions_tracked: history.length,
          progression_state: p.progression_state,
        };
      })
      .filter(Boolean);

    // Enrich exercise names from the Exercise collection
    const { Exercise } = await import('../models/Exercise');
    const exerciseIds = strengthData.map((s: any) => s.exercise_id);
    const exercises = await Exercise.find({ exercise_id: { $in: exerciseIds } }).select('exercise_id name').lean();
    const nameMap = new Map(exercises.map((e: any) => [e.exercise_id, e.name]));

    for (const item of strengthData) {
      if (item) {
        item.name = nameMap.get(item.exercise_id) || item.exercise_id;
      }
    }

    // Calculate overall strength change percentage
    const totalStart = strengthData.reduce((sum, s) => sum + (s?.start_reps || 0), 0);
    const totalCurrent = strengthData.reduce((sum, s) => sum + (s?.current_reps || 0), 0);
    const overallChange = totalStart > 0 ? Math.round(((totalCurrent - totalStart) / totalStart) * 100) : 0;

    res.json({
      exercises: strengthData,
      summary: {
        total_exercises_tracked: strengthData.length,
        overall_strength_change_pct: overallChange,
      },
    });
  } catch (error: any) {
    console.error('Progress strength error:', error.message);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch strength progress' });
  }
});

/**
 * POST /api/progress/weight
 * Logs a weight entry for the user.
 * Body: { weight_kg: number }
 * Also updates the user's current weight_kg field.
 */
router.post('/weight', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findOne({ firebase_uid: req.uid });
    if (!user) { res.status(404).json({ error: 'Not Found', message: 'User not found' }); return; }

    const { weight_kg } = req.body;
    if (!weight_kg || typeof weight_kg !== 'number' || weight_kg < 20 || weight_kg > 300) {
      res.status(400).json({ error: 'Bad Request', message: 'weight_kg must be a number between 20 and 300' });
      return;
    }

    // Check if there's already a log entry for today (prevent duplicates)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const existingToday = user.weight_log?.find(
      (entry: any) => new Date(entry.date) >= today
    );

    if (existingToday) {
      // Update today's entry instead of adding a new one
      existingToday.weight_kg = weight_kg;
    } else {
      // Add new entry
      if (!user.weight_log) {
        user.weight_log = [];
      }
      user.weight_log.push({ date: new Date(), weight_kg });
    }

    // Also update the user's current weight
    user.weight_kg = weight_kg;

    await user.save();

    res.json({
      message: 'Weight logged successfully',
      weight_kg,
      total_entries: user.weight_log.length,
    });
  } catch (error: any) {
    console.error('Weight log error:', error.message);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to log weight' });
  }
});

/**
 * GET /api/progress/weight
 * Returns the user's weight history for charting.
 * Query params:
 *   ?range=week|month|all (default: all)
 * Returns: array of { date, weight_kg } + summary stats.
 */
router.get('/weight', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findOne({ firebase_uid: req.uid });
    if (!user) { res.status(404).json({ error: 'Not Found', message: 'User not found' }); return; }

    const range = (req.query.range as string) || 'all';
    let entries = user.weight_log || [];

    // Filter by date range
    if (range === 'week') {
      const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      entries = entries.filter((e: any) => new Date(e.date) >= cutoff);
    } else if (range === 'month') {
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      entries = entries.filter((e: any) => new Date(e.date) >= cutoff);
    }

    // Sort by date ascending
    entries = [...entries].sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Calculate summary
    const allEntries = [...(user.weight_log || [])].sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const startWeight = allEntries.length > 0 ? allEntries[0].weight_kg : user.weight_kg;
    const currentWeight = user.weight_kg;
    const weightChange = currentWeight && startWeight ? Math.round((currentWeight - startWeight) * 10) / 10 : 0;

    res.json({
      entries: entries.map((e: any) => ({
        date: e.date,
        weight_kg: e.weight_kg,
      })),
      summary: {
        current_weight_kg: currentWeight,
        start_weight_kg: startWeight,
        change_kg: weightChange,
        total_entries: (user.weight_log || []).length,
      },
    });
  } catch (error: any) {
    console.error('Weight history error:', error.message);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch weight history' });
  }
});

export default router;
