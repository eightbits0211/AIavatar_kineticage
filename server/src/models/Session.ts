import mongoose, { Schema, Document } from 'mongoose';

export interface ISession extends Document {
  user_id: mongoose.Types.ObjectId;
  bundle_id: mongoose.Types.ObjectId;
  started_at: Date;
  completed_at: Date | null;
  paused_at: Date | null;
  status: 'in_progress' | 'full' | 'partial' | 'abandoned';
  exercises_planned: number;
  exercises_completed: number;
  exercises: Array<{
    exercise_id: mongoose.Types.ObjectId;
    exercise_name: string;
    status: 'completed' | 'skipped' | 'pain_stopped' | 'in_progress' | 'pending';
    feedback: 'felt_easy' | 'felt_normal' | 'felt_hard' | null;
    skip_reason: string | null;
    sets: Array<{
      set_number: number;
      target_rep_min: number;
      target_rep_max: number;
      actual_reps: number | null;
      completed: boolean;
      completed_at: Date | null;
    }>;
  }>;
  pain_events: Array<{
    exercise_id: mongoose.Types.ObjectId;
    body_area: string;
    timestamp: Date;
  }>;
  xp_awarded: number;
  progression_flags: Array<{
    exercise_id: mongoose.Types.ObjectId;
    type: string;
    details: string;
  }>;
}

const SessionSchema = new Schema<ISession>({
  user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  bundle_id: { type: Schema.Types.ObjectId, ref: 'Bundle', required: true },
  started_at: { type: Date, default: Date.now },
  completed_at: { type: Date, default: null },
  paused_at: { type: Date, default: null },
  status: { type: String, enum: ['in_progress', 'full', 'partial', 'abandoned'], default: 'in_progress' },
  exercises_planned: { type: Number, default: 0 },
  exercises_completed: { type: Number, default: 0 },
  exercises: [{
    exercise_id: { type: String },
    exercise_name: String,
    status: { type: String, enum: ['completed', 'skipped', 'pain_stopped', 'in_progress', 'pending'], default: 'pending' },
    feedback: { type: String, enum: ['felt_easy', 'felt_normal', 'felt_hard', null], default: null },
    skip_reason: { type: String, default: null },
    sets: [{
      set_number: Number,
      target_rep_min: Number,
      target_rep_max: Number,
      actual_reps: { type: Number, default: null },
      completed: { type: Boolean, default: false },
      completed_at: { type: Date, default: null },
    }],
  }],
  pain_events: [{
    exercise_id: { type: String },
    body_area: String,
    timestamp: { type: Date, default: Date.now },
  }],
  xp_awarded: { type: Number, default: 0 },
  progression_flags: [{ type: Schema.Types.Mixed }],
});

SessionSchema.index({ user_id: 1, started_at: -1 });

export const Session = mongoose.model<ISession>('Session', SessionSchema);
