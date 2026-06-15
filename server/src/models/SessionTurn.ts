import mongoose, { Schema, Document } from 'mongoose';

export interface ISessionTurn extends Document {
  session_id: mongoose.Types.ObjectId;
  user_id: mongoose.Types.ObjectId;
  role: 'user' | 'companion';
  content: string;
  input_mode: 'voice' | 'text';
  state_at_time: string;
  action_intent: string | null;
  timestamp: Date;
}

const SessionTurnSchema = new Schema<ISessionTurn>({
  session_id: { type: Schema.Types.ObjectId, ref: 'Session', required: true },
  user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  role: { type: String, enum: ['user', 'companion'], required: true },
  content: { type: String, required: true },
  input_mode: { type: String, enum: ['voice', 'text'], required: true },
  state_at_time: { type: String, required: true },
  action_intent: { type: String, default: null },
  timestamp: { type: Date, default: Date.now },
});

SessionTurnSchema.index({ session_id: 1, timestamp: 1 });

export const SessionTurn = mongoose.model<ISessionTurn>('SessionTurn', SessionTurnSchema);
