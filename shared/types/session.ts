export type SessionStatus = 'in_progress' | 'full' | 'partial' | 'abandoned';

export type ExerciseCompletion = 'completed' | 'skipped' | 'pain_stopped';

export type ExerciseFeedback = 'felt_easy' | 'felt_normal' | 'felt_hard' | null;

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

export interface SessionExerciseSet {
  set_number: number;
  target_rep_min: number;
  target_rep_max: number;
  actual_reps: number | null;
  completed: boolean;
  completed_at: Date | null;
}

export interface SessionExercise {
  exercise_id: string;
  exercise_name: string;
  status: ExerciseCompletion | 'in_progress' | 'pending';
  feedback: ExerciseFeedback;
  skip_reason: string | null;
  sets: SessionExerciseSet[];
  rest_seconds: number;
}

export interface SessionPainEvent {
  exercise_id: string;
  body_area: string;
  timestamp: Date;
}

export interface Session {
  _id: string;
  user_id: string;
  bundle_id: string;
  started_at: Date;
  completed_at: Date | null;
  status: SessionStatus;
  exercises: SessionExercise[];
  pain_events: SessionPainEvent[];
  xp_awarded: number;
  progression_flags: Array<{
    exercise_id: string;
    type: 'rep_increase' | 'set_increase' | 'deload';
    details: string;
  }>;
}

export interface SessionTurn {
  _id: string;
  session_id: string;
  user_id: string;
  role: 'user' | 'companion';
  content: string;
  input_mode: InputMode;
  state_at_time: SessionState;
  action_intent: string | null;
  timestamp: Date;
}
