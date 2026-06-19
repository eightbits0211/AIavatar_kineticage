/**
 * GAMIFICATION SERVICE
 *
 * Centralizes all XP, level, streak, and badge logic.
 * Called when sessions complete, daily check-ins happen, and milestones are hit.
 *
 * XP Rules (from PRD Section 4.6.1):
 * - Full workout bundle = 50 XP
 * - Partial workout (50%+) = 25 XP
 * - Progression milestone = 20 XP bonus
 * - 7-day streak = 100 XP bonus
 * - 30-day streak = 500 XP bonus
 * - First workout after onboarding = 30 XP (one-time)
 * - Onboarding complete = 15 XP (one-time)
 * - Daily check-in = 10 XP
 *
 * Levels: Level N requires N × 200 XP (escalating)
 * Streaks: grace-day model (1 grace day per week)
 */

import { IUser } from '../models/User';

export interface XPResult {
  xp_awarded: number;
  breakdown: Array<{ source: string; amount: number }>;
}

// ─── XP CALCULATION ───

export function calculateSessionXP(options: {
  status: 'full' | 'partial' | 'abandoned';
  isFirstWorkout: boolean;
  progressionMilestones: number;
}): XPResult {
  const breakdown: Array<{ source: string; amount: number }> = [];
  let total = 0;

  // Base session XP
  if (options.status === 'full') {
    breakdown.push({ source: 'Full workout completed', amount: 50 });
    total += 50;
  } else if (options.status === 'partial') {
    breakdown.push({ source: 'Partial workout (50%+)', amount: 25 });
    total += 25;
  }
  // abandoned = 0 XP

  // Progression milestone bonus (20 XP each)
  if (options.progressionMilestones > 0 && options.status !== 'abandoned') {
    const milestoneXP = options.progressionMilestones * 20;
    breakdown.push({ source: `${options.progressionMilestones} progression milestone(s)`, amount: milestoneXP });
    total += milestoneXP;
  }

  // First workout bonus (one-time)
  if (options.isFirstWorkout && options.status !== 'abandoned') {
    breakdown.push({ source: 'First workout bonus', amount: 30 });
    total += 30;
  }

  return { xp_awarded: total, breakdown };
}

// ─── LEVELS ───

export function calculateLevel(totalXP: number): number {
  // Level N requires cumulative N × 200 XP
  // Level 1: 0-199, Level 2: 200-599, Level 3: 600-1199...
  // Solving cumulative: sum of (i*200) for i=1..n
  let level = 1;
  let required = 200;
  let cumulative = 0;
  while (totalXP >= cumulative + required) {
    cumulative += required;
    level += 1;
    required = level * 200;
  }
  return level;
}

export function xpForNextLevel(totalXP: number): { current_level: number; xp_into_level: number; xp_needed: number } {
  let level = 1;
  let required = 200;
  let cumulative = 0;
  while (totalXP >= cumulative + required) {
    cumulative += required;
    level += 1;
    required = level * 200;
  }
  return {
    current_level: level,
    xp_into_level: totalXP - cumulative,
    xp_needed: required,
  };
}

// ─── STREAKS (grace-day model) ───

export interface StreakResult {
  current_streak: number;
  longest_streak: number;
  grace_days_used_this_week: number;
  streak_milestone: number | null; // 7, 30, etc. if hit this session
  bonus_xp: number;
}

export function updateStreak(user: IUser, workoutDate: Date = new Date()): StreakResult {
  const lastWorkout = user.gamification.last_workout_date
    ? new Date(user.gamification.last_workout_date)
    : null;

  let currentStreak = user.gamification.current_streak;
  let graceDaysUsed = user.gamification.grace_days_used_this_week;

  if (!lastWorkout) {
    // First ever workout
    currentStreak = 1;
  } else {
    const daysSinceLastWorkout = Math.floor(
      (workoutDate.getTime() - lastWorkout.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceLastWorkout === 0) {
      // Same day — streak unchanged (already counted today)
    } else if (daysSinceLastWorkout === 1) {
      // Consecutive day — increment
      currentStreak += 1;
    } else if (daysSinceLastWorkout === 2 && graceDaysUsed < 1) {
      // Missed 1 day but grace day available — preserve streak
      currentStreak += 1;
      graceDaysUsed += 1;
    } else {
      // Streak broken — reset
      currentStreak = 1;
      graceDaysUsed = 0;
    }
  }

  const longestStreak = Math.max(currentStreak, user.gamification.longest_streak);

  // Check milestones
  let milestone: number | null = null;
  let bonusXP = 0;
  if (currentStreak === 7) {
    milestone = 7;
    bonusXP = 100;
  } else if (currentStreak === 30) {
    milestone = 30;
    bonusXP = 500;
  }

  return {
    current_streak: currentStreak,
    longest_streak: longestStreak,
    grace_days_used_this_week: graceDaysUsed,
    streak_milestone: milestone,
    bonus_xp: bonusXP,
  };
}

// ─── BADGES ───

export interface Badge {
  badge_id: string;
  name: string;
  description: string;
}

export const BADGES: Record<string, Badge> = {
  first_step: { badge_id: 'first_step', name: 'First Step', description: 'Complete your first workout' },
  consistency_starter: { badge_id: 'consistency_starter', name: 'Consistency Starter', description: 'Complete 3 workouts in 7 days' },
  week_warrior: { badge_id: 'week_warrior', name: 'Week Warrior', description: 'Reach a 7-day streak' },
  momentum: { badge_id: 'momentum', name: 'Momentum', description: 'Reach a 30-day streak' },
  comeback: { badge_id: 'comeback', name: 'Comeback', description: 'Return after a 7+ day gap' },
  leveling_up: { badge_id: 'leveling_up', name: 'Leveling Up', description: 'Trigger your first progression milestone' },
  goal_getter: { badge_id: 'goal_getter', name: 'Goal Getter', description: 'Complete 10 workouts in your goal category' },
};

export interface BadgeEvaluationContext {
  totalCompletedSessions: number;
  sessionsLast7Days: number;
  currentStreak: number;
  daysSinceLastWorkoutBeforeThis: number;
  progressionMilestonesEver: number;
  goalCategorySessions: number;
  alreadyEarned: string[];
}

/**
 * Evaluates which new badges the user has earned.
 * Returns only NEWLY earned badges (not already in alreadyEarned).
 */
export function evaluateBadges(ctx: BadgeEvaluationContext): Badge[] {
  const newBadges: Badge[] = [];
  const earned = new Set(ctx.alreadyEarned);

  const award = (id: string) => {
    if (!earned.has(id)) {
      newBadges.push(BADGES[id]);
      earned.add(id);
    }
  };

  // First Step — first workout
  if (ctx.totalCompletedSessions >= 1) award('first_step');

  // Consistency Starter — 3 workouts in 7 days
  if (ctx.sessionsLast7Days >= 3) award('consistency_starter');

  // Week Warrior — 7-day streak
  if (ctx.currentStreak >= 7) award('week_warrior');

  // Momentum — 30-day streak
  if (ctx.currentStreak >= 30) award('momentum');

  // Comeback — returned after 7+ day gap
  if (ctx.daysSinceLastWorkoutBeforeThis >= 7) award('comeback');

  // Leveling Up — first progression milestone
  if (ctx.progressionMilestonesEver >= 1) award('leveling_up');

  // Goal Getter — 10 workouts in goal category
  if (ctx.goalCategorySessions >= 10) award('goal_getter');

  return newBadges;
}

// ─── DAILY CHECK-IN XP ───

export const DAILY_CHECKIN_XP = 10;
export const ONBOARDING_XP = 15;
