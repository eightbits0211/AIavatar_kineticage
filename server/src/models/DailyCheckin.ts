import mongoose, { Schema, Document } from 'mongoose';

export interface IDailyCheckin extends Document {
  user_id: mongoose.Types.ObjectId;
  date: Date;
  energy_level: 'low' | 'medium' | 'high';
  soreness: Array<{
    body_area: string;
    severity: 'mild' | 'moderate' | 'severe';
  }>;
  xp_awarded: number;
  created_at: Date;
}

const DailyCheckinSchema = new Schema<IDailyCheckin>({
  user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, required: true },
  energy_level: { type: String, enum: ['low', 'medium', 'high'], required: true },
  soreness: [{
    body_area: String,
    severity: { type: String, enum: ['mild', 'moderate', 'severe'] },
  }],
  xp_awarded: { type: Number, default: 10 },
  created_at: { type: Date, default: Date.now },
});

DailyCheckinSchema.index({ user_id: 1, date: -1 });

export const DailyCheckin = mongoose.model<IDailyCheckin>('DailyCheckin', DailyCheckinSchema);
