import { SessionState, InputMode } from './session';
import { ExerciseBundle } from './bundle';

// ═══════════════════════════════════════════════════════
// COMPANION
// ═══════════════════════════════════════════════════════

export interface CompanionMessageRequest {
  session_id: string | null;
  message: string;
  input_mode: InputMode;
  current_state: SessionState;
}

export interface CompanionMessageResponse {
  reply: string;
  next_state: SessionState | null;
  action_intent: string | null;
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
// BUNDLES
// ═══════════════════════════════════════════════════════

export interface GenerateBundlesRequest {
  energy_level?: 'low' | 'medium' | 'high';
  available_time?: number;
  regenerate?: boolean;
}

export interface GenerateBundlesResponse {
  bundles: ExerciseBundle[];
  generated_at: string;
}

// ═══════════════════════════════════════════════════════
// SESSION
// ═══════════════════════════════════════════════════════

export interface StartSessionRequest {
  bundle_id: string;
}

export interface StartSessionResponse {
  session_id: string;
  exercises: Array<{
    exercise_id: string;
    name: string;
    sets: number;
    rep_min: number;
    rep_max: number;
    rest_seconds: number;
    instructions_text: string;
    image_url: string;
  }>;
  greeting: string;
}

export interface EndSessionResponse {
  summary: string;
  xp_awarded: number;
  new_total_xp: number;
  level_up: boolean;
  streak: {
    current: number;
    is_new_best: boolean;
    grace_day_used: boolean;
  };
  progression_flags: Array<{
    exercise_id: string;
    type: string;
    message: string;
  }>;
  badges_earned: string[];
}

// ═══════════════════════════════════════════════════════
// PERSONALIZATION
// ═══════════════════════════════════════════════════════

export interface PersonalizeResponse {
  persona_tags: string[];
  calculated_metrics: {
    bmi: number;
    bmi_category: string;
    tdee: number;
    tdee_range: { low: number; high: number };
    max_heart_rate: number;
    target_zone: { low: number; high: number };
  };
}

// ═══════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════

export interface DashboardResponse {
  workout_history: Array<{
    session_id: string;
    date: string;
    bundle_title: string;
    duration_min: number;
    status: 'full' | 'partial';
  }>;
  streak: {
    current: number;
    longest: number;
  };
  xp: {
    total: number;
    level: number;
    next_level_xp: number;
  };
  badges: Array<{
    badge_id: string;
    name: string;
    earned_at: string | null;
    is_new: boolean;
  }>;
  weekly_progress: {
    completed: number;
    planned: number;
    calories_burned: { low: number; high: number };
  };
}

// ═══════════════════════════════════════════════════════
// DAILY CHECK-IN
// ═══════════════════════════════════════════════════════

export interface DailyCheckinRequest {
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
