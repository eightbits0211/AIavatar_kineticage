import mongoose, { Schema, Document } from 'mongoose';

export type WorkoutPhase = 'warm_up' | 'primary' | 'bmi_targeting' | 'core' | 'cardio_finisher' | 'balance_mobility' | 'cool_down';

/**
 * MHR intensity zones based on percentage of Maximum Heart Rate.
 * - low: <60% MHR (warm-ups, cool-downs, mobility)
 * - moderate: 60-75% MHR (general fitness, moderate cardio)
 * - high: 75-85% MHR (strength, hypertrophy heavy compounds)
 * - very_high: >85% MHR (HIIT, plyometrics, sprints)
 */
export type IntensityZone = 'low' | 'moderate' | 'high' | 'very_high';

export interface IExercise extends Document {
  exercise_id: string;
  name: string;
  category_tags: string[];
  workout_phase: WorkoutPhase[];
  intensity_zone: IntensityZone;
  muscle_groups: {
    primary: string[];
    secondary: string[];
  };
  equipment_required: string[];
  location_compatible: string[];
  contraindications: string[];
  substitution_group: string;
  default_set_rep_range: Record<string, {
    sets: number;
    rep_min: number;
    rep_max: number;
    rest_seconds: number;
  }>;
  instructions_text: string;
  difficulty_level: 'beginner' | 'intermediate' | 'advanced';
  image_url: string;
  image_url_end: string;
}

const ExerciseSchema = new Schema<IExercise>({
  exercise_id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  category_tags: [{ type: String }],
  workout_phase: [{ type: String, enum: ['warm_up', 'primary', 'bmi_targeting', 'core', 'cardio_finisher', 'balance_mobility', 'cool_down'] }],
  intensity_zone: { type: String, enum: ['low', 'moderate', 'high', 'very_high'], default: 'moderate' },
  muscle_groups: {
    primary: [{ type: String }],
    secondary: [{ type: String }],
  },
  equipment_required: [{ type: String }],
  location_compatible: [{ type: String }],
  contraindications: [{ type: String }],
  substitution_group: { type: String, required: true },
  default_set_rep_range: { type: Schema.Types.Mixed, required: true },
  instructions_text: { type: String, required: true },
  difficulty_level: { type: String, enum: ['beginner', 'intermediate', 'advanced'], required: true },
  image_url: { type: String, default: '' },
  image_url_end: { type: String, default: '' },
});

ExerciseSchema.index({ difficulty_level: 1 });
ExerciseSchema.index({ category_tags: 1 });
ExerciseSchema.index({ equipment_required: 1 });
ExerciseSchema.index({ workout_phase: 1 });

export const Exercise = mongoose.model<IExercise>('Exercise', ExerciseSchema);
