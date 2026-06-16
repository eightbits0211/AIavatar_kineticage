import mongoose, { Schema, Document } from 'mongoose';

export interface IBundle extends Document {
  user_id: mongoose.Types.ObjectId;
  title: string;
  is_recommended: boolean;
  estimated_duration_min: number;
  estimated_calorie_burn: { low: number; high: number };
  exercises: Array<{
    exercise_id: mongoose.Types.ObjectId;
    name: string;
    sets: number;
    rep_min: number;
    rep_max: number;
    rest_seconds: number;
    instructions_text: string;
    image_url: string;
    muscle_groups: string[];
  }>;
  rationale: string;
  focus: string;
  generated_at: Date;
  generation_context: {
    persona_tags: string[];
    fitness_goal: string;
    excluded_exercises: mongoose.Types.ObjectId[];
    recent_muscle_groups: string[];
  };
  set_id: mongoose.Types.ObjectId;
  active: boolean;
}

const BundleSchema = new Schema<IBundle>({
  user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true },
  is_recommended: { type: Boolean, default: false },
  estimated_duration_min: { type: Number, required: true },
  estimated_calorie_burn: {
    low: { type: Number, required: true },
    high: { type: Number, required: true },
  },
  exercises: [{
    exercise_id: { type: String },
    name: String,
    sets: Number,
    rep_min: Number,
    rep_max: Number,
    rest_seconds: Number,
    instructions_text: String,
    image_url: String,
    muscle_groups: [String],
  }],
  rationale: { type: String, default: '' },
  focus: { type: String, required: true },
  generated_at: { type: Date, default: Date.now },
  generation_context: {
    persona_tags: [String],
    fitness_goal: String,
    excluded_exercises: [{ type: Schema.Types.ObjectId }],
    recent_muscle_groups: [String],
  },
  set_id: { type: Schema.Types.ObjectId, required: true },
  active: { type: Boolean, default: true },
});

export const Bundle = mongoose.model<IBundle>('Bundle', BundleSchema);
