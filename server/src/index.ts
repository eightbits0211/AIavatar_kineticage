import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/db';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes (will be added in subsequent steps)
// app.use('/api/auth', authRoutes);
// app.use('/api/profile', profileRoutes);
// app.use('/api/companion', companionRoutes);
// app.use('/api/session', sessionRoutes);
// app.use('/api/routine', routineRoutes);
// app.use('/api/exercises', exerciseRoutes);
// app.use('/api/tts', ttsRoutes);
// app.use('/api/stt', sttRoutes);
// app.use('/api/progress', progressRoutes);
// app.use('/api/gamification', gamificationRoutes);
// app.use('/api/daily-checkin', dailyCheckinRoutes);
// app.use('/api/personalize', personalizeRoutes);

// Start server
const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export default app;
