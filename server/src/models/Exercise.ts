import mongoose, { Schema, Document } from 'mongoose';

export type WorkoutPhase = 'warm_up' | 'primary' | 'bmi_targeting' | 'core' | 'cardio_finisher' | 'balance_mobility' | 'cool_down';

export interface IExercise extends Document {
  exercise_id: string;
  name: string;
  category_tags: string[];
  workout_phase: WorkoutPhase[];
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
}

const ExerciseSchema = new Schema<IExercise>({
  exercise_id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  category_tags: [{ type: String }],
  workout_phase: [{ type: String, enum: ['warm_up', 'primary', 'bmi_targeting', 'core', 'cardio_finisher', 'balance_mobility', 'cool_down'] }],
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
});

ExerciseSchema.index({ difficulty_level: 1 });
ExerciseSchema.index({ category_tags: 1 });
ExerciseSchema.index({ equipment_required: 1 });
ExerciseSchema.index({ workout_phase: 1 });

export const Exercise = mongoose.model<IExercise>('Exercise', ExerciseSchema);
