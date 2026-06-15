export type FitnessLevel = 'beginner' | 'intermediate' | 'advanced';

export type FitnessGoal =
  | 'strength'
  | 'weight_loss'
  | 'muscle_gain'
  | 'mobility'
  | 'injury_recovery'
  | 'general_fitness';

export type HealthCondition =
  | 'neck_pain'
  | 'shoulder_issues'
  | 'upper_back_pain'
  | 'lower_back_pain'
  | 'hip_issues'
  | 'knee_issues'
  | 'ankle_issues'
  | 'wrist_issues'
  | 'heart_condition'
  | 'high_blood_pressure';

export type Equipment =
  | 'none'
  | 'dumbbells'
  | 'resistance_bands'
  | 'barbell'
  | 'kettlebell'
  | 'pull_up_bar'
  | 'bench'
  | 'exercise_mat';

export type WorkoutLocation = 'home' | 'gym' | 'office';

export type InteractionLevel = 'high' | 'medium' | 'low';

export type MotivationStyle = 'gentle' | 'energetic' | 'coach';

export type UserPersonaType =
  | 'beginner'
  | 'regular_gym_goer'
  | 'weight_loss_seeker'
  | 'muscle_gain_user'
  | 'home_workout_user'
  | 'office_worker'
  | 'ai_companion_seeker'
  | 'injury_recovery_user'
  | 'inconsistent_user';

export interface WorkoutPreferences {
  days_per_week: number;
  session_duration: 15 | 30 | 45 | 60;
  location: WorkoutLocation;
}

export interface CompanionPreferences {
  voice_id: string;
  interaction_level: InteractionLevel;
  motivation_style: MotivationStyle;
}

export interface UserPersona {
  type: UserPersonaType;
  confidence: number;
  assigned_at: Date;
  last_evaluated: Date;
}

export interface CalculatedMetrics {
  bmi: number;
  calorie_needs: number;
  max_heart_rate: number;
}

export interface Gamification {
  total_xp: number;
  level: number;
  current_streak: number;
  longest_streak: number;
  last_workout_date: Date | null;
  achievements: Array<{
    type: string;
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
  gender: 'male' | 'female' | 'other';
  fitness_level: FitnessLevel;
  fitness_experience: string;
  goals: FitnessGoal[];
  conditions: HealthCondition[];
  equipment: Equipment[];
  workout_preferences: WorkoutPreferences;
  companion_preferences: CompanionPreferences;
  persona: UserPersona;
  calculated_metrics: CalculatedMetrics;
  gamification: Gamification;
  pain_history: PainEvent[];
  created_at: Date;
  updated_at: Date;
}
