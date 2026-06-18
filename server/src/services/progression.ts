/**
 * PROGRESSION SERVICE
 *
 * Evaluates per-exercise completion history and triggers:
 * - Rep/set increases when user hits top of range for 2 consecutive sessions
 * - Deload/substitution when user skips or reports "felt hard" 2+ times
 *
 * This is DETERMINISTIC — rules-based, never AI-generated.
 * Called after each session ends.
 */

import { ExerciseProgression } from '../models/ExerciseProgression';
import { ISession } from '../models/Session';
import mongoose from 'mongoose';

export interface ProgressionFlag {
  exercise_id: string;
  type: 'rep_increase' | 'set_increase' | 'deload';
  details: string;
}

/**
 * Evaluates progression for all exercises in a completed session.
 * Updates ExerciseProgression records and returns flags for display.
 */
export async function evaluateProgression(session: ISession): Promise<ProgressionFlag[]> {
  const flags: ProgressionFlag[] = [];

  for (const exercise of session.exercises) {
    if (exercise.status === 'completed' || exercise.status === 'skipped' || exercise.status === 'pain_stopped') {
      await updateExerciseProgression(
        session.user_id,
        exercise,
        session._id as mongoose.Types.ObjectId,
        flags
      );
    }
  }

  return flags;
}

async function updateExerciseProgression(
  userId: mongoose.Types.ObjectId,
  exercise: any,
  sessionId: mongoose.Types.ObjectId,
  flags: ProgressionFlag[]
) {
  // Find or create progression record
  let record = await ExerciseProgression.findOne({
    user_id: userId,
    exercise_id: exercise.exercise_id,
  });

  if (!record) {
    record = new ExerciseProgression({
      user_id: userId,
      exercise_id: exercise.exercise_id,
      substitution_group: '', // Will be filled from exercise library
      history: [],
      current_prescription: {
        sets: exercise.sets.length,
        rep_min: exercise.sets[0]?.target_rep_min || 8,
        rep_max: exercise.sets[0]?.target_rep_max || 12,
      },
      progression_state: 'stable',
      consecutive_top_completions: 0,
      consecutive_skips_or_hard: 0,
    });
  }

  // Add this session to history
  const repsAchieved = exercise.sets
    .filter((s: any) => s.completed)
    .map((s: any) => s.actual_reps || 0);

  record.history.push({
    session_id: sessionId,
    date: new Date(),
    sets_completed: repsAchieved.length,
    reps_achieved: repsAchieved,
    feedback: exercise.feedback || null,
    skipped: exercise.status === 'skipped',
  });

  // Keep history to last 10 sessions
  if (record.history.length > 10) {
    record.history = record.history.slice(-10);
  }

  // ─── EVALUATE PROGRESSION RULES ───

  if (exercise.status === 'completed') {
    // Check if user hit top of rep range
    const topOfRange = record.current_prescription.rep_max;
    const allSetsHitTop = repsAchieved.length > 0 &&
      repsAchieved.every((reps: number) => reps >= topOfRange);

    if (allSetsHitTop) {
      record.consecutive_top_completions += 1;
      record.consecutive_skips_or_hard = 0;
    } else {
      record.consecutive_top_completions = 0;
    }

    // PROGRESSION TRIGGER: 2 consecutive sessions at top of range
    if (record.consecutive_top_completions >= 2) {
      // Increase rep range or add a set
      if (record.current_prescription.rep_max < 15) {
        record.current_prescription.rep_min += 1;
        record.current_prescription.rep_max += 1;
        flags.push({
          exercise_id: exercise.exercise_id,
          type: 'rep_increase',
          details: `Progressed to ${record.current_prescription.rep_min}-${record.current_prescription.rep_max} reps. Consider slightly heavier next time.`,
        });
      } else {
        record.current_prescription.sets += 1;
        flags.push({
          exercise_id: exercise.exercise_id,
          type: 'set_increase',
          details: `Added a set (now ${record.current_prescription.sets} sets). Great progress!`,
        });
      }
      record.consecutive_top_completions = 0;
      record.progression_state = 'stable';
    } else if (record.consecutive_top_completions === 1) {
      record.progression_state = 'ready_to_progress';
    }

    // Check "felt_hard" feedback
    if (exercise.feedback === 'felt_hard') {
      record.consecutive_skips_or_hard += 1;
    } else if (exercise.feedback === 'felt_easy') {
      // Fast-track: "felt easy" means next time hitting top = instant progression
      record.consecutive_top_completions = Math.max(record.consecutive_top_completions, 1);
    }
  }

  // DELOAD TRIGGER: 2+ skips or "felt hard"
  if (exercise.status === 'skipped' || exercise.status === 'pain_stopped') {
    record.consecutive_skips_or_hard += 1;
    record.consecutive_top_completions = 0;
  }

  if (record.consecutive_skips_or_hard >= 2) {
    record.progression_state = 'deload_candidate';
    flags.push({
      exercise_id: exercise.exercise_id,
      type: 'deload',
      details: `This exercise will be substituted or reduced in future workouts.`,
    });
    record.consecutive_skips_or_hard = 0;
  }

  await record.save();
}
