import mongoose, { Schema, Document } from 'mongoose';

export interface IExerciseProgression extends Document {
  user_id: mongoose.Types.ObjectId;
  exercise_id: mongoose.Types.ObjectId;
  substitution_group: string;
  history: Array<{
    session_id: mongoose.Types.ObjectId;
    date: Date;
    sets_completed: number;
    reps_achieved: number[];
    feedback: string | null;
    skipped: boolean;
  }>;
  current_prescription: {
    sets: number;
    rep_min: number;
    rep_max: number;
  };
  progression_state: 'stable' | 'ready_to_progress' | 'deload_candidate';
  consecutive_top_completions: number;
  consecutive_skips_or_hard: number;
}

const ExerciseProgressionSchema = new Schema<IExerciseProgression>({
  user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  exercise_id: { type: Schema.Types.ObjectId, ref: 'Exercise', required: true },
  substitution_group: { type: String, required: true },
  history: [{
    session_id: { type: Schema.Types.ObjectId, ref: 'Session' },
    date: Date,
    sets_completed: Number,
    reps_achieved: [Number],
    feedback: { type: String, default: null },
    skipped: { type: Boolean, default: false },
  }],
  current_prescription: {
    sets: { type: Number, required: true },
    rep_min: { type: Number, required: true },
    rep_max: { type: Number, required: true },
  },
  progression_state: { type: String, enum: ['stable', 'ready_to_progress', 'deload_candidate'], default: 'stable' },
  consecutive_top_completions: { type: Number, default: 0 },
  consecutive_skips_or_hard: { type: Number, default: 0 },
});

ExerciseProgressionSchema.index({ user_id: 1, exercise_id: 1 }, { unique: true });

export const ExerciseProgression = mongoose.model<IExerciseProgression>('ExerciseProgression', ExerciseProgressionSchema);
