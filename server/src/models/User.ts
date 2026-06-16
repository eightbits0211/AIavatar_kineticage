import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  firebase_uid: string;
  name: string;
  email: string;
  age: number;
  height_cm: number;
  weight_kg: number;
  gender: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  fitness_goal: string;
  activity_level: string;
  workout_location: string;
  equipment: string[];
  injuries: string[];
  injury_notes: string;
  workout_duration: number;
  prior_program_experience: boolean;
  persona_tags: string[];
  companion_preferences: {
    voice_id: string;
    talkativeness: 'minimal' | 'balanced' | 'high';
    in_session_verbosity: 'quiet' | 'standard' | 'detailed';
  };
  calculated_metrics: {
    bmi: number;
    bmi_category: string;
    bmr: number;
    tdee: number;
    tdee_range: { low: number; high: number };
    max_heart_rate: number;
    target_zone: { low: number; high: number };
  };
  gamification: {
    total_xp: number;
    level: number;
    current_streak: number;
    longest_streak: number;
    last_workout_date: Date | null;
    grace_days_used_this_week: number;
    badges: Array<{ badge_id: string; earned_at: Date }>;
  };
  pain_history: Array<{
    exercise_id: mongoose.Types.ObjectId;
    body_area: string;
    reported_at: Date;
    session_id: mongoose.Types.ObjectId;
  }>;
  onboarding_completed: boolean;
  created_at: Date;
  updated_at: Date;
}

const UserSchema = new Schema<IUser>(
  {
    firebase_uid: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
    age: { type: Number, min: 16, max: 100 },
    height_cm: { type: Number },
    weight_kg: { type: Number },
    gender: { type: String, enum: ['male', 'female', 'other', 'prefer_not_to_say'] },
    fitness_goal: {
      type: String,
      enum: ['strength', 'hypertrophy', 'mobility', 'general_fitness', 'weight_loss', 'home_workout'],
    },
    activity_level: {
      type: String,
      enum: ['sedentary', 'lightly_active', 'moderately_active', 'very_active'],
    },
    workout_location: { type: String, enum: ['gym', 'home', 'outdoors', 'hybrid'] },
    equipment: [{ type: String }],
    injuries: [{ type: String }],
    injury_notes: { type: String, default: '' },
    workout_duration: { type: Number, enum: [15, 30, 45, 60] },
    prior_program_experience: { type: Boolean, default: false },
    persona_tags: [{ type: String }],
    companion_preferences: {
      voice_id: { type: String, default: '' },
      talkativeness: { type: String, enum: ['minimal', 'balanced', 'high'], default: 'balanced' },
      in_session_verbosity: { type: String, enum: ['quiet', 'standard', 'detailed'], default: 'standard' },
    },
    calculated_metrics: {
      bmi: { type: Number, default: 0 },
      bmi_category: { type: String, default: '' },
      bmr: { type: Number, default: 0 },
      tdee: { type: Number, default: 0 },
      tdee_range: { low: { type: Number, default: 0 }, high: { type: Number, default: 0 } },
      max_heart_rate: { type: Number, default: 0 },
      target_zone: { low: { type: Number, default: 0 }, high: { type: Number, default: 0 } },
    },
    gamification: {
      total_xp: { type: Number, default: 0 },
      level: { type: Number, default: 1 },
      current_streak: { type: Number, default: 0 },
      longest_streak: { type: Number, default: 0 },
      last_workout_date: { type: Date, default: null },
      grace_days_used_this_week: { type: Number, default: 0 },
      badges: [{ badge_id: String, earned_at: Date }],
    },
    pain_history: [
      {
        exercise_id: { type: Schema.Types.ObjectId, ref: 'Exercise' },
        body_area: String,
        reported_at: Date,
        session_id: { type: Schema.Types.ObjectId, ref: 'Session' },
      },
    ],
    onboarding_completed: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
);

export const User = mongoose.model<IUser>('User', UserSchema);
