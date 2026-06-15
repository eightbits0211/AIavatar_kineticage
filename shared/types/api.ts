import { SessionState, InputMode, PostWorkoutFeedback } from './session';

// ═══════════════════════════════════════════════════════
// COMPANION
// ═══════════════════════════════════════════════════════

export interface CompanionMessageRequest {
  session_id: string;
  message: string;
  input_mode: InputMode;
  current_state: SessionState;
}

export interface CompanionMessageResponse {
  reply: string;
  next_state: SessionState;
  adaptation: { next_target_reps: number } | null;
  rest_duration_seconds: number | null;
}

// ═══════════════════════════════════════════════════════
// TTS & STT
// ═══════════════════════════════════════════════════════

export interface TTSRequest {
  text: string;
  voice_id: string;
}

export interface STTResponse {
  transcript: string;
  confidence: number;
}

// ═══════════════════════════════════════════════════════
// SESSION
// ═══════════════════════════════════════════════════════

export interface StartSessionRequest {
  routine_id: string;
  day: string;
}

export interface StartSessionResponse {
  session_id: string;
  exercises: Array<{
    exercise_id: string;
    name: string;
    sets: number;
    target_reps: number;
    rest_seconds: number;
    instructions: string[];
    image_url: string;
  }>;
  greeting: string;
}

export interface EndSessionRequest {
  session_id: string;
  ended_early: boolean;
  post_workout_feedback: PostWorkoutFeedback;
}

export interface EndSessionResponse {
  summary: string;
  recovery_recommendation: string;
  xp_awarded: number;
  new_total_xp: number;
  level_up: boolean;
  streak: {
    current: number;
    is_new_best: boolean;
  };
}

// ═══════════════════════════════════════════════════════
// ROUTINE
// ═══════════════════════════════════════════════════════

export interface GenerateRoutineRequest {
  regenerate: boolean;
  feedback: string | null;
}

// ═══════════════════════════════════════════════════════
// PERSONALIZATION
// ═══════════════════════════════════════════════════════

export interface PersonalizeResponse {
  persona: string;
  confidence: number;
  calculated_metrics: {
    bmi: number;
    calorie_needs: number;
    max_heart_rate: number;
  };
  recommendations: {
    intensity: string;
    focus_areas: string[];
    avoid: string[];
  };
}

// ═══════════════════════════════════════════════════════
// DAILY CHECK-IN
// ═══════════════════════════════════════════════════════

export interface DailyCheckinRequest {
  sleep_quality: 'poor' | 'okay' | 'good' | 'great';
  energy_level: 'low' | 'medium' | 'high';
  soreness: Array<{
    body_area: string;
    severity: 'mild' | 'moderate' | 'severe';
  }>;
}

// ═══════════════════════════════════════════════════════
// GENERIC
// ═══════════════════════════════════════════════════════

export interface ApiError {
  error: string;
  message: string;
  service?: string;
}
