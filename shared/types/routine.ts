// Progression tracking per exercise
export interface ExerciseProgressionRecord {
  exercise_id: string;
  substitution_group: string;
  history: Array<{
    session_id: string;
    date: Date;
    sets_completed: number;
    reps_achieved: number[];
    feedback: 'felt_easy' | 'felt_normal' | 'felt_hard' | null;
    skipped: boolean;
  }>;
  current_prescription: {
    sets: number;
    rep_min: number;
    rep_max: number;
  };
  progression_state: 'stable' | 'ready_to_progress' | 'deload_candidate';
  consecutive_top_completions: number;
  consecutive_skips_or_hard: number;
}

export interface WeeklyPlan {
  user_id: string;
  week_start: Date;
  scheduled_days: string[];
  split_preference: string | null;
  completed_sessions: number;
  planned_sessions: number;
}
