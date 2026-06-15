export type FitnessLevel = 'beginner' | 'intermediate' | 'advanced';

export type FitnessGoal =
  | 'strength'
  | 'hypertrophy'
  | 'mobility'
  | 'general_fitness'
  | 'weight_loss'
  | 'home_workout';

export type ActivityLevel = 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active';

export type Gender = 'male' | 'female' | 'other' | 'prefer_not_to_say';

export type InjuryArea = 'none' | 'knee' | 'lower_back' | 'shoulder' | 'wrist' | 'ankle' | 'other';

export type Equipment =
  | 'none'
  | 'dumbbells'
  | 'barbell'
  | 'resistance_bands'
  | 'kettlebell'
  | 'pull_up_bar'
  | 'bench'
  | 'machines'
  | 'cardio_equipment';

export type WorkoutLocation = 'gym' | 'home' | 'outdoors' | 'hybrid';

export type WorkoutDuration = 15 | 30 | 45 | 60;

export type Talkativeness = 'minimal' | 'balanced' | 'high';

export type InSessionVerbosity = 'quiet' | 'standard' | 'detailed';

export type PersonaTag =
  | 'complete_beginner'
  | 'regular_gym_goer'
  | 'weight_loss_seeker'
  | 'home_workout_user'
  | 'office_professional'
  | 'injury_recovery_user'
  | 'ai_companion_seeker'
  | 'inconsistent_enthusiast';

export interface WorkoutPreferences {
  workout_duration: WorkoutDuration;
  location: WorkoutLocation;
  talkativeness: Talkativeness;
  in_session_verbosity: InSessionVerbosity;
}

export interface CompanionPreferences {
  voice_id: string;
  talkativeness: Talkativeness;
  in_session_verbosity: InSessionVerbosity;
}

export interface CalculatedMetrics {
  bmi: number;
  bmi_category: 'underweight' | 'normal' | 'overweight' | 'obese';
  bmr: number;
  tdee: number;
  tdee_range: { low: number; high: number };
  max_heart_rate: number;
  target_zone: { low: number; high: number };
}

export interface Gamification {
  total_xp: number;
  level: number;
  current_streak: number;
  longest_streak: number;
  last_workout_date: Date | null;
  grace_days_used_this_week: number;
  badges: Array<{
    badge_id: string;
    earned_at: Date;
  }>;
}

export interface PainEvent {
  exercise_id: string;
  body_area: string;
  reported_at: Date;
  session_id: string;
}

export interface UserProfile {
  _id: string;
  firebase_uid: string;
  name: string;
  email: string;
  age: number;
  height_cm: number;
  weight_kg: number;
  gender: Gender;
  fitness_goal: FitnessGoal;
  activity_level: ActivityLevel;
  workout_location: WorkoutLocation;
  equipment: Equipment[];
  injuries: InjuryArea[];
  injury_notes: string;
  workout_duration: WorkoutDuration;
  prior_program_experience: boolean;
  persona_tags: PersonaTag[];
  companion_preferences: CompanionPreferences;
  calculated_metrics: CalculatedMetrics;
  gamification: Gamification;
  pain_history: PainEvent[];
  onboarding_completed: boolean;
  created_at: Date;
  updated_at: Date;
}
