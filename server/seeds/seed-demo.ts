/**
 * Demo Seed Script: Creates 3 demo users with realistic workout history,
 * XP, streaks, badges, weight logs, and exercise progression data.
 *
 * Users:
 *   1. "Alex" — Regular Gym-Goer, intermediate, strength-focused, 3-week history
 *   2. "Sam"  — Complete Beginner, weight loss goal, 2-week history, home workouts
 *   3. "Jordan" — Office Professional, general fitness, 1-week history, short sessions
 *
 * Run: cd server && npx ts-node seeds/seed-demo.ts
 *
 * NOTE: This creates users with fake firebase_uids (demo_alex, demo_sam, demo_jordan).
 * For the live demo, swap these UIDs with real Firebase test accounts.
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { User } from '../src/models/User';
import { Session } from '../src/models/Session';
import { ExerciseProgression } from '../src/models/ExerciseProgression';
import { DailyCheckin } from '../src/models/DailyCheckin';
import { Bundle } from '../src/models/Bundle';
import { Exercise } from '../src/models/Exercise';

dotenv.config();

// ─── Helpers ───

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(8 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 60), 0, 0);
  return d;
}

function randomFeedback(): 'felt_easy' | 'felt_normal' | 'felt_hard' {
  const opts: Array<'felt_easy' | 'felt_normal' | 'felt_hard'> = ['felt_easy', 'felt_normal', 'felt_hard'];
  return opts[Math.floor(Math.random() * 3)];
}

function randomReps(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

// ─── Demo User Definitions ───

const DEMO_USERS = [
  {
    firebase_uid: 'demo_alex',
    name: 'Alex Chen',
    email: 'alex.demo@kineticage.app',
    age: 28,
    height_cm: 178,
    weight_kg: 82,
    gender: 'male' as const,
    fitness_goal: 'strength',
    fitness_level: 'intermediate' as const,
    activity_level: 'moderately_active',
    workout_location: 'gym',
    equipment: ['barbell', 'dumbbells', 'pull_up_bar', 'bench', 'cable_machine', 'kettlebell'],
    injuries: ['none'],
    injury_notes: '',
    workout_duration: 45,
    prior_program_experience: true,
    persona_tags: ['regular_gym_goer', 'strength_training_user'],
    companion_preferences: {
      voice_id: '',
      talkativeness: 'balanced' as const,
      in_session_verbosity: 'standard' as const,
    },
    calculated_metrics: {
      bmi: 25.9,
      bmi_category: 'overweight',
      bmr: 1855,
      tdee: 2875,
      tdee_range: { low: 2731, high: 3019 },
      max_heart_rate: 192,
      target_zone: { low: 115, high: 154 },
    },
    gamification: {
      total_xp: 1350,
      level: 3,
      current_streak: 5,
      longest_streak: 14,
      last_workout_date: daysAgo(1),
      grace_days_used_this_week: 0,
      badges: [
        { badge_id: 'first_step', earned_at: daysAgo(21) },
        { badge_id: 'consistency_starter', earned_at: daysAgo(16) },
        { badge_id: 'week_warrior', earned_at: daysAgo(12) },
        { badge_id: 'leveling_up', earned_at: daysAgo(10) },
      ],
    },
    weight_log: [
      { date: daysAgo(21), weight_kg: 84 },
      { date: daysAgo(14), weight_kg: 83.2 },
      { date: daysAgo(7), weight_kg: 82.5 },
      { date: daysAgo(1), weight_kg: 82 },
    ],
    onboarding_completed: true,
    is_guest: false,
    sessionsToCreate: 15,
    sessionDaysBack: 21,
  },
  {
    firebase_uid: 'demo_sam',
    name: 'Sam Williams',
    email: 'sam.demo@kineticage.app',
    age: 35,
    height_cm: 165,
    weight_kg: 78,
    gender: 'female' as const,
    fitness_goal: 'weight_loss',
    fitness_level: 'beginner' as const,
    activity_level: 'sedentary',
    workout_location: 'home',
    equipment: ['none', 'exercise_mat', 'resistance_bands'],
    injuries: ['none'],
    injury_notes: '',
    workout_duration: 30,
    prior_program_experience: false,
    persona_tags: ['complete_beginner', 'weight_loss_seeker', 'home_workout_user'],
    companion_preferences: {
      voice_id: '',
      talkativeness: 'high' as const,
      in_session_verbosity: 'detailed' as const,
    },
    calculated_metrics: {
      bmi: 28.7,
      bmi_category: 'overweight',
      bmr: 1470,
      tdee: 1764,
      tdee_range: { low: 1676, high: 1852 },
      max_heart_rate: 185,
      target_zone: { low: 111, high: 148 },
    },
    gamification: {
      total_xp: 520,
      level: 2,
      current_streak: 3,
      longest_streak: 5,
      last_workout_date: daysAgo(1),
      grace_days_used_this_week: 1,
      badges: [
        { badge_id: 'first_step', earned_at: daysAgo(14) },
        { badge_id: 'consistency_starter', earned_at: daysAgo(9) },
      ],
    },
    weight_log: [
      { date: daysAgo(14), weight_kg: 80 },
      { date: daysAgo(10), weight_kg: 79.5 },
      { date: daysAgo(7), weight_kg: 79.1 },
      { date: daysAgo(3), weight_kg: 78.4 },
      { date: daysAgo(0), weight_kg: 78 },
    ],
    onboarding_completed: true,
    is_guest: false,
    sessionsToCreate: 8,
    sessionDaysBack: 14,
  },
  {
    firebase_uid: 'demo_jordan',
    name: 'Jordan Patel',
    email: 'jordan.demo@kineticage.app',
    age: 42,
    height_cm: 172,
    weight_kg: 75,
    gender: 'male' as const,
    fitness_goal: 'general_fitness',
    fitness_level: 'beginner' as const,
    activity_level: 'lightly_active',
    workout_location: 'home',
    equipment: ['none', 'dumbbells', 'exercise_mat'],
    injuries: ['lower_back'],
    injury_notes: 'Mild lower back pain from desk job, cleared by physio for light exercise',
    workout_duration: 15,
    prior_program_experience: false,
    persona_tags: ['office_professional', 'home_workout_user', 'injury_recovery_user'],
    companion_preferences: {
      voice_id: '',
      talkativeness: 'minimal' as const,
      in_session_verbosity: 'quiet' as const,
    },
    calculated_metrics: {
      bmi: 25.4,
      bmi_category: 'overweight',
      bmr: 1672,
      tdee: 2299,
      tdee_range: { low: 2184, high: 2414 },
      max_heart_rate: 178,
      target_zone: { low: 107, high: 142 },
    },
    gamification: {
      total_xp: 280,
      level: 1,
      current_streak: 4,
      longest_streak: 4,
      last_workout_date: daysAgo(0),
      grace_days_used_this_week: 0,
      badges: [
        { badge_id: 'first_step', earned_at: daysAgo(6) },
      ],
    },
    weight_log: [
      { date: daysAgo(7), weight_kg: 76 },
      { date: daysAgo(3), weight_kg: 75.5 },
      { date: daysAgo(0), weight_kg: 75 },
    ],
    onboarding_completed: true,
    is_guest: false,
    sessionsToCreate: 5,
    sessionDaysBack: 7,
  },
];

// ─── Session Generator ───

async function createDemoSessions(userId: mongoose.Types.ObjectId, config: {
  sessionsToCreate: number;
  sessionDaysBack: number;
  fitnessGoal: string;
  workoutDuration: number;
}) {
  const exercises = await Exercise.find({}).lean();
  if (exercises.length === 0) {
    console.warn('  ⚠️  No exercises in DB — run seed.ts first');
    return;
  }

  const sessions = [];
  const bundleId = new mongoose.Types.ObjectId(); // Fake bundle ID

  for (let i = 0; i < config.sessionsToCreate; i++) {
    const dayOffset = Math.floor((config.sessionDaysBack / config.sessionsToCreate) * i);
    const startDate = daysAgo(config.sessionDaysBack - dayOffset);
    const endDate = new Date(startDate.getTime() + config.workoutDuration * 60 * 1000);

    // Pick 4-7 random exercises for the session
    const exerciseCount = config.workoutDuration <= 15 ? 4 : config.workoutDuration <= 30 ? 6 : 7;
    const shuffled = [...exercises].sort(() => Math.random() - 0.5);
    const sessionExercises = shuffled.slice(0, exerciseCount);

    // Determine session status (mostly full, some partial)
    const isPartial = Math.random() < 0.15;
    const completedCount = isPartial
      ? Math.max(Math.ceil(exerciseCount * 0.6), 3)
      : exerciseCount;

    const exerciseDocs = sessionExercises.map((ex: any, idx: number) => {
      const completed = idx < completedCount;
      const sets = [];
      const numSets = 3;
      for (let s = 1; s <= numSets; s++) {
        sets.push({
          set_number: s,
          target_rep_min: 8,
          target_rep_max: 12,
          actual_reps: completed ? randomReps(8, 14) : null,
          completed,
          completed_at: completed ? new Date(startDate.getTime() + (idx * numSets + s) * 90000) : null,
        });
      }
      return {
        exercise_id: ex.exercise_id,
        exercise_name: ex.name,
        status: completed ? 'completed' : 'pending',
        feedback: completed ? randomFeedback() : null,
        skip_reason: null,
        sets,
      };
    });

    // XP: 50 for full, 25 for partial
    const xp = isPartial ? 25 : 50;

    sessions.push({
      user_id: userId,
      bundle_id: bundleId,
      started_at: startDate,
      completed_at: endDate,
      paused_at: null,
      status: isPartial ? 'partial' : 'full',
      exercises_planned: exerciseCount,
      exercises_completed: completedCount,
      exercises: exerciseDocs,
      pain_events: [],
      xp_awarded: xp,
      progression_flags: [],
    });
  }

  await Session.insertMany(sessions);
  return sessions;
}

// ─── Progression Generator ───

async function createDemoProgressions(userId: mongoose.Types.ObjectId, sessions: any[]) {
  // Build progression data from session exercises
  const exerciseHistory: Record<string, Array<{ session_id: any; date: Date; reps: number[] }>> = {};

  for (const session of sessions) {
    for (const ex of session.exercises) {
      if (ex.status !== 'completed') continue;
      if (!exerciseHistory[ex.exercise_id]) {
        exerciseHistory[ex.exercise_id] = [];
      }
      exerciseHistory[ex.exercise_id].push({
        session_id: session._id || new mongoose.Types.ObjectId(),
        date: session.started_at,
        reps: ex.sets.filter((s: any) => s.completed).map((s: any) => s.actual_reps),
      });
    }
  }

  const progressions = [];
  for (const [exerciseId, history] of Object.entries(exerciseHistory)) {
    if (history.length < 2) continue; // Need at least 2 sessions for meaningful progression

    // Determine progression state
    const lastTwo = history.slice(-2);
    const avgLast = lastTwo[1].reps.reduce((a, b) => a + b, 0) / lastTwo[1].reps.length;
    let state: 'stable' | 'ready_to_progress' | 'deload_candidate' = 'stable';
    let consecutiveTop = 0;

    if (avgLast >= 12) {
      state = 'ready_to_progress';
      consecutiveTop = 2;
    }

    progressions.push({
      user_id: userId,
      exercise_id: exerciseId,
      substitution_group: '',
      history: history.map(h => ({
        session_id: h.session_id,
        date: h.date,
        sets_completed: h.reps.length,
        reps_achieved: h.reps,
        feedback: null,
        skipped: false,
      })),
      current_prescription: { sets: 3, rep_min: 8, rep_max: 12 },
      progression_state: state,
      consecutive_top_completions: consecutiveTop,
      consecutive_skips_or_hard: 0,
    });
  }

  if (progressions.length > 0) {
    await ExerciseProgression.insertMany(progressions);
  }
  return progressions.length;
}

// ─── Daily Check-ins Generator ───

async function createDemoCheckins(userId: mongoose.Types.ObjectId, daysBack: number) {
  const checkins = [];
  // Create check-ins for ~70% of days
  for (let i = 0; i < daysBack; i++) {
    if (Math.random() < 0.3) continue; // Skip some days

    const date = daysAgo(i);
    const energyLevels = ['low', 'medium', 'high'];
    const sorenessAreas = ['legs', 'arms', 'chest', 'back', 'shoulders'];
    const severities = ['mild', 'moderate', 'severe'];

    const soreness = Math.random() < 0.4 ? [{
      body_area: sorenessAreas[Math.floor(Math.random() * sorenessAreas.length)],
      severity: severities[Math.floor(Math.random() * 2)], // mostly mild/moderate
    }] : [];

    checkins.push({
      user_id: userId,
      date,
      energy_level: energyLevels[Math.floor(Math.random() * 3)],
      soreness,
      xp_awarded: 10,
      created_at: date,
    });
  }

  if (checkins.length > 0) {
    await DailyCheckin.insertMany(checkins);
  }
  return checkins.length;
}

// ─── Main ───

async function seedDemo() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('❌ MONGODB_URI not set in .env');
    process.exit(1);
  }

  console.log('🔗 Connecting to MongoDB...');
  await mongoose.connect(mongoUri);
  console.log('✅ Connected\n');

  // Verify exercises exist
  const exerciseCount = await Exercise.countDocuments();
  if (exerciseCount === 0) {
    console.error('❌ No exercises in database. Run `npx ts-node seeds/seed.ts` first.');
    process.exit(1);
  }
  console.log(`📋 Found ${exerciseCount} exercises in library\n`);

  // Clean up existing demo data
  const demoUids = DEMO_USERS.map(u => u.firebase_uid);
  const existingDemoUsers = await User.find({ firebase_uid: { $in: demoUids } });
  if (existingDemoUsers.length > 0) {
    console.log('🧹 Cleaning up existing demo data...');
    const userIds = existingDemoUsers.map(u => u._id);
    await Session.deleteMany({ user_id: { $in: userIds } });
    await ExerciseProgression.deleteMany({ user_id: { $in: userIds } });
    await DailyCheckin.deleteMany({ user_id: { $in: userIds } });
    await User.deleteMany({ firebase_uid: { $in: demoUids } });
    console.log('  ✅ Cleaned\n');
  }

  // Create each demo user
  for (const userDef of DEMO_USERS) {
    console.log(`👤 Creating ${userDef.name} (${userDef.firebase_uid})...`);
    console.log(`   Persona: ${userDef.persona_tags.join(', ')}`);
    console.log(`   Goal: ${userDef.fitness_goal} | Level: ${userDef.fitness_level}`);

    const { sessionsToCreate, sessionDaysBack, ...userData } = userDef;

    const user = new User(userData);
    await user.save();
    console.log(`   ✅ User created (ID: ${user._id})`);

    // Create sessions
    const sessions = await createDemoSessions(user._id, {
      sessionsToCreate,
      sessionDaysBack,
      fitnessGoal: userDef.fitness_goal,
      workoutDuration: userDef.workout_duration,
    });
    console.log(`   ✅ ${sessionsToCreate} sessions created (over ${sessionDaysBack} days)`);

    // Create progressions
    const progressionCount = await createDemoProgressions(user._id, sessions || []);
    console.log(`   ✅ ${progressionCount} exercise progressions created`);

    // Create daily check-ins
    const checkinCount = await createDemoCheckins(user._id, sessionDaysBack);
    console.log(`   ✅ ${checkinCount} daily check-ins created`);

    console.log('');
  }

  // Summary
  console.log('═══════════════════════════════════════════');
  console.log('✅ DEMO SEED COMPLETE');
  console.log('═══════════════════════════════════════════');
  console.log('');
  console.log('Demo accounts created:');
  for (const u of DEMO_USERS) {
    console.log(`  • ${u.name} (${u.firebase_uid})`);
    console.log(`    ${u.persona_tags.join(', ')} | Level ${u.gamification.level} | ${u.gamification.total_xp} XP | ${u.gamification.current_streak}-day streak`);
  }
  console.log('');
  console.log('To test with these accounts, use the firebase_uid in the auth header');
  console.log('or create matching Firebase test users and swap the UIDs.');

  await mongoose.disconnect();
}

seedDemo().catch((err) => {
  console.error('❌ Demo seed failed:', err.message);
  console.error(err.stack);
  process.exit(1);
});
