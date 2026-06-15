export type SessionStatus = 'active' | 'completed' | 'abandoned';

export type ExerciseStatus = 'completed' | 'skipped' | 'pain_stopped';

export type Difficulty = 'easy' | 'moderate' | 'tough';

export type SessionState =
  | 'idle'
  | 'session_starting'
  | 'exercise_intro'
  | 'set_active'
  | 'set_complete'
  | 'check_in'
  | 'rest'
  | 'session_summary';

export type InputMode = 'voice' | 'text';

export interface SetData {
  set_number: number;
  target_reps: number;
  actual_reps: number | null;
  difficulty: Difficulty | null;
  adaptation_applied: string | null;
  completed_at: Date | null;
}

export interface SessionExercise {
  exercise_id: string;
  exercise_name: string;
  status: ExerciseStatus | 'in_progress' | 'pending';
  skip_reason: string | null;
  sets: SetData[];
}

export interface SessionPainEvent {
  exercise_id: string;
  body_area: string;
  timestamp: Date;
}

export interface SessionSummary {
  text: string;
  total_sets: number;
  total_reps: number;
  adaptations_count: number;
  recovery_recommendation: string;
}

export interface PostWorkoutFeedback {
  overall_difficulty: 1 | 2 | 3 | 4 | 5;
  energy_level: 'low' | 'medium' | 'high';
}

export interface Session {
  _id: string;
  user_id: string;
  routine_id: string;
  started_at: Date;
  completed_at: Date | null;
  ended_early: boolean;
  status: SessionStatus;
  exercises_planned: number;
  exercises_completed: number;
  exercises: SessionExercise[];
  pain_events: SessionPainEvent[];
  summary: SessionSummary | null;
  post_workout_feedback: PostWorkoutFeedback | null;
  xp_awarded: number;
}

export interface SessionTurn {
  _id: string;
  session_id: string;
  user_id: string;
  role: 'user' | 'companion';
  content: string;
  input_mode: InputMode;
  state_at_time: SessionState;
  timestamp: Date;
}
