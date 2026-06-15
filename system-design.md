# Kinetic Age AI Companion — System Design Document

## 1. System Overview

The Kinetic Age AI Companion is a mobile application that provides voice and text-based guided strength training through a conversational AI. The system processes user voice input, generates intelligent workout guidance via an LLM, and delivers responses as natural-sounding speech — creating the experience of having a personal trainer in your pocket.

---

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        MOBILE CLIENT                                     │
│                   (React Native + TypeScript)                            │
│                                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐  │
│  │  Onboarding │  │  Dashboard  │  │   Workout    │  │  Progress   │  │
│  │    Flow     │  │   Screen    │  │   Session    │  │   Charts    │  │
│  └─────────────┘  └─────────────┘  └──────────────┘  └─────────────┘  │
│                                                                          │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                    Zustand State Store                             │  │
│  │  • sessionStore (state machine, current exercise, sets, reps)     │  │
│  │  • userStore (profile, persona, preferences)                      │  │
│  │  • chatStore (conversation history, pending messages)             │  │
│  │  • gamificationStore (XP, streak, achievements)                   │  │
│  └───────────────────────────┬───────────────────────────────────────┘  │
│                               │                                          │
│  ┌─────────────┐  ┌──────────┴──────────┐  ┌────────────────────────┐  │
│  │ Audio Layer │  │   API Service Layer  │  │   Local Cache Layer    │  │
│  │ (expo-av)   │  │   (axios/fetch)      │  │   (AsyncStorage)       │  │
│  └─────────────┘  └──────────┬──────────┘  └────────────────────────┘  │
│                               │                                          │
└───────────────────────────────┼──────────────────────────────────────────┘
                                │
                          HTTPS / REST
                    (WebSocket post-MVP)
                                │
┌───────────────────────────────┼──────────────────────────────────────────┐
│                               ▼                                          │
│                      BACKEND SERVER                                       │
│               (Node.js + Express + TypeScript)                            │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                        Middleware Layer                             │ │
│  │  • Firebase Auth JWT Verification                                  │ │
│  │  • Rate Limiting (per-user)                                        │ │
│  │  • Request Validation                                              │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                         Route Layer                                 │ │
│  │  POST /api/auth/signup          POST /api/auth/login               │ │
│  │  GET  /api/profile              PUT  /api/profile                  │ │
│  │  POST /api/personalize          GET  /api/persona                  │ │
│  │  POST /api/routine/generate     GET  /api/routine/active           │ │
│  │  POST /api/session/start        POST /api/session/end              │ │
│  │  POST /api/companion/message    POST /api/companion/checkin        │ │
│  │  POST /api/tts/stream           POST /api/stt/transcribe           │ │
│  │  GET  /api/exercises            GET  /api/exercises/:id            │ │
│  │  GET  /api/progress             GET  /api/gamification             │ │
│  │  POST /api/daily-checkin                                           │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                       Service Layer                                 │ │
│  │                                                                     │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐ │ │
│  │  │ Claude       │  │ Deepgram     │  │ ElevenLabs               │ │ │
│  │  │ Service      │  │ Service      │  │ Service                  │ │ │
│  │  │ • chat()     │  │ • transcribe │  │ • streamTTS()            │ │ │
│  │  │ • generate() │  │              │  │ • getVoices()            │ │ │
│  │  └──────────────┘  └──────────────┘  └──────────────────────────┘ │ │
│  │                                                                     │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐ │ │
│  │  │ Session      │  │ Gamification │  │ Personalization          │ │ │
│  │  │ Service      │  │ Service      │  │ Engine                   │ │ │
│  │  │ • start()    │  │ • awardXP()  │  │ • assignPersona()        │ │ │
│  │  │ • end()      │  │ • streak()   │  │ • updateConfidence()     │ │ │
│  │  │ • summarize()│  │ • level()    │  │ • recalculate()          │ │ │
│  │  └──────────────┘  └──────────────┘  └──────────────────────────┘ │ │
│  │                                                                     │ │
│  │  All services wrapped with p-retry (3 attempts, exponential backoff)│ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└──────────┬──────────────────┬────────────────────┬───────────────────────┘
           │                  │                    │
           ▼                  ▼                    ▼
┌──────────────────┐ ┌───────────────┐ ┌─────────────────────┐
│  MongoDB Atlas   │ │  Claude API   │ │  Deepgram API       │
│                  │ │  (Anthropic)  │ │  + ElevenLabs API   │
│  • users         │ │               │ │                     │
│  • routines      │ │               │ │                     │
│  • sessions      │ │               │ │                     │
│  • exercises     │ │               │ │                     │
│  • gamification  │ │               │ │                     │
└──────────────────┘ └───────────────┘ └─────────────────────┘
```

---

## 3. Data Flow Diagrams

### 3.1 Voice Conversation Flow (Core Loop)

```
User speaks    ──→  expo-av captures audio
                         │
                         ▼
                    Audio blob sent to Backend
                    POST /api/stt/transcribe
                         │
                         ▼
               Backend → Deepgram API (STT)
                    (with p-retry)
                         │
                         ▼
                  Transcribed text returned
                         │
                         ▼
              Backend → Claude API (with system prompt +
                    session history + user persona context)
                    (with p-retry)
                         │
                         ▼
                  Claude response text returned
                         │
                         ├──→ Text returned to client (displayed on screen)
                         │
                         ▼
              Backend → ElevenLabs API (streaming TTS)
                    (with p-retry)
                         │
                         ▼
                  Audio stream returned to client
                         │
                         ▼
                  expo-av plays audio chunks as they arrive
```

**Latency budget target: < 4 seconds end-to-end**
- Deepgram STT: ~300-500ms
- Claude API: ~1-2s
- ElevenLabs first chunk: ~500ms-1s
- Network overhead: ~500ms

### 3.2 Onboarding & Personalization Flow

```
User completes profile steps
         │
         ▼
POST /api/profile (store all fields)
         │
         ▼
POST /api/personalize
         │
         ▼
AI Personalization Engine:
  ├── Calculate BMI = weight(kg) / height(m)²
  ├── Calculate Calorie Needs (Mifflin-St Jeor)
  ├── Calculate Max Heart Rate = 220 - age
  ├── Analyze: goals + fitness level + equipment + conditions
  │
  ▼
Assign User Persona (1 of 9 types)
  + confidence score (0-100%)
         │
         ▼
Store persona in user document
         │
         ▼
POST /api/routine/generate
  (Claude generates weekly plan based on persona + profile)
         │
         ▼
Store routine → Return to client for review/approval
```

### 3.3 Workout Session State Machine

```
                    ┌─────────────────────────────┐
                    │                             │
                    ▼                             │
              ┌──────────┐                       │
              │   IDLE   │                       │
              └────┬─────┘                       │
                   │ user taps "Start Workout"   │
                   ▼                             │
         ┌─────────────────┐                    │
         │ SESSION_STARTING │                    │
         │ (greet, announce │                    │
         │  today's plan)   │                    │
         └────────┬────────┘                    │
                  │                              │
                  ▼                              │
         ┌─────────────────┐                    │
    ┌───→│ EXERCISE_INTRO  │                    │
    │    │ (announce name,  │                    │
    │    │  sets, reps,     │                    │
    │    │  instructions)   │                    │
    │    └────────┬────────┘                    │
    │             │ user says "ready"           │
    │             ▼                              │
    │    ┌─────────────────┐                    │
    │    │   SET_ACTIVE    │                    │
    │    │ (timer running,  │                    │
    │    │  user exercising)│                    │
    │    └────────┬────────┘                    │
    │             │ user says "done"            │
    │             ▼                              │
    │    ┌─────────────────┐                    │
    │    │  SET_COMPLETE   │                    │
    │    │ (transition)     │                    │
    │    └────────┬────────┘                    │
    │             │                              │
    │             ▼                              │
    │    ┌─────────────────┐                    │
    │    │   CHECK_IN      │                    │
    │    │ (ask reps, ask   │                    │
    │    │  difficulty,     │                    │
    │    │  adapt next set) │                    │
    │    └────────┬────────┘                    │
    │             │                              │
    │             ▼                              │
    │    ┌─────────────────┐     more sets?     │
    │    │     REST        │────────────────┐   │
    │    │ (motivation,    │    yes         │   │
    │    │  countdown)     │                │   │
    │    └────────┬────────┘                │   │
    │             │ no more sets            │   │
    │             │                          │   │
    │             ▼                          ▼   │
    │    ┌─────────────────┐      ┌──────────┐ │
    │    │ more exercises? │      │SET_ACTIVE│ │
    │    └───┬────────┬────┘      └──────────┘ │
    │        │yes     │no                       │
    │        │        ▼                         │
    └────────┘  ┌──────────────────┐            │
                │ SESSION_SUMMARY  │            │
                │ (recap, recovery,│            │
                │  XP award)       │            │
                └────────┬─────────┘            │
                         │                      │
                         ▼                      │
                    ┌──────────┐                │
                    │   IDLE   │────────────────┘
                    └──────────┘
```

---

## 4. Database Schema (MongoDB)

### 4.1 Collections

```javascript
// ═══════════════════════════════════════════════════════
// USERS COLLECTION
// ═══════════════════════════════════════════════════════
{
  _id: ObjectId,
  firebase_uid: String,          // Firebase Auth UID
  name: String,
  email: String,
  age: Number,
  height_cm: Number,
  weight_kg: Number,
  gender: String,                // "male" | "female" | "other"
  fitness_level: String,         // "beginner" | "intermediate" | "advanced"
  fitness_experience: String,    // free text description
  goals: [String],               // ["strength", "weight_loss", "muscle_gain", ...]
  conditions: [String],          // ["lower_back_pain", "knee_issues", ...]
  equipment: [String],           // ["dumbbells", "resistance_bands", "none", ...]
  workout_preferences: {
    days_per_week: Number,       // 2-7
    session_duration: Number,    // 15, 30, 45, or 60 minutes
    location: String             // "home" | "gym" | "office"
  },
  companion_preferences: {
    voice_id: String,            // ElevenLabs voice ID
    interaction_level: String,   // "high" | "medium" | "low"
    motivation_style: String     // "gentle" | "energetic" | "coach"
  },
  persona: {
    type: String,                // one of 9 persona types
    confidence: Number,          // 0-100
    assigned_at: Date,
    last_evaluated: Date
  },
  calculated_metrics: {
    bmi: Number,
    calorie_needs: Number,
    max_heart_rate: Number
  },
  gamification: {
    total_xp: Number,
    level: Number,
    current_streak: Number,
    longest_streak: Number,
    last_workout_date: Date,
    achievements: [{
      type: String,
      earned_at: Date
    }]
  },
  pain_history: [{
    exercise_id: ObjectId,
    body_area: String,
    reported_at: Date,
    session_id: ObjectId
  }],
  created_at: Date,
  updated_at: Date
}

// ═══════════════════════════════════════════════════════
// ROUTINES COLLECTION
// ═══════════════════════════════════════════════════════
{
  _id: ObjectId,
  user_id: ObjectId,
  active: Boolean,
  generated_at: Date,
  plan: {
    monday: {
      exercises: [{
        exercise_id: ObjectId,
        sets: Number,
        target_reps: Number,
        rest_seconds: Number
      }],
      estimated_duration: Number
    },
    wednesday: { /* same structure */ },
    friday: { /* same structure */ }
    // ... user's preferred days
  },
  generation_context: {
    persona: String,
    fitness_level: String,
    goals: [String],
    excluded_exercises: [ObjectId]  // from pain history
  }
}

// ═══════════════════════════════════════════════════════
// SESSIONS COLLECTION
// ═══════════════════════════════════════════════════════
{
  _id: ObjectId,
  user_id: ObjectId,
  routine_id: ObjectId,
  started_at: Date,
  completed_at: Date,           // null if ended early
  ended_early: Boolean,
  status: String,               // "active" | "completed" | "abandoned"
  exercises_planned: Number,
  exercises_completed: Number,
  exercises: [{
    exercise_id: ObjectId,
    exercise_name: String,
    status: String,             // "completed" | "skipped" | "pain_stopped"
    skip_reason: String,
    sets: [{
      set_number: Number,
      target_reps: Number,
      actual_reps: Number,
      difficulty: String,       // "easy" | "moderate" | "tough"
      adaptation_applied: String, // "+2 reps" | "unchanged" | "-2 reps"
      completed_at: Date
    }]
  }],
  pain_events: [{
    exercise_id: ObjectId,
    body_area: String,
    timestamp: Date
  }],
  summary: {
    text: String,
    total_sets: Number,
    total_reps: Number,
    adaptations_count: Number,
    recovery_recommendation: String
  },
  post_workout_feedback: {
    overall_difficulty: Number,  // 1-5
    energy_level: String        // "low" | "medium" | "high"
  },
  xp_awarded: Number
}

// ═══════════════════════════════════════════════════════
// SESSION_TURNS COLLECTION (conversation history)
// ═══════════════════════════════════════════════════════
{
  _id: ObjectId,
  session_id: ObjectId,
  user_id: ObjectId,
  role: String,                 // "user" | "companion"
  content: String,
  input_mode: String,           // "voice" | "text"
  state_at_time: String,        // state machine state when message sent
  timestamp: Date
}

// ═══════════════════════════════════════════════════════
// EXERCISES COLLECTION
// ═══════════════════════════════════════════════════════
{
  _id: ObjectId,
  name: String,
  description: String,
  target_muscles: [String],
  instructions: [String],       // numbered steps
  difficulty: String,           // "beginner" | "intermediate" | "advanced"
  equipment_required: [String], // ["dumbbells"] or ["none"]
  contraindications: [String],  // ["knee_issues", "lower_back_pain"]
  image_url: String,
  goal_tags: [String],          // ["strength", "weight_loss", "mobility"]
  default_sets: Number,
  default_reps: Number,
  rest_seconds: Number
}

// ═══════════════════════════════════════════════════════
// DAILY_CHECKINS COLLECTION
// ═══════════════════════════════════════════════════════
{
  _id: ObjectId,
  user_id: ObjectId,
  date: Date,
  sleep_quality: String,        // "poor" | "okay" | "good" | "great"
  energy_level: String,         // "low" | "medium" | "high"
  soreness: [{
    body_area: String,
    severity: String            // "mild" | "moderate" | "severe"
  }],
  xp_awarded: Number,
  created_at: Date
}
```

### 4.2 Indexes

```javascript
// Performance-critical indexes
db.users.createIndex({ firebase_uid: 1 }, { unique: true })
db.sessions.createIndex({ user_id: 1, started_at: -1 })
db.session_turns.createIndex({ session_id: 1, timestamp: 1 })
db.routines.createIndex({ user_id: 1, active: 1 })
db.exercises.createIndex({ difficulty: 1, equipment_required: 1, goal_tags: 1 })
db.daily_checkins.createIndex({ user_id: 1, date: -1 })
```

---

## 5. API Contract Details

### 5.1 Companion Message (Core Interaction)

```
POST /api/companion/message
Authorization: Bearer <firebase_jwt>

Request:
{
  "session_id": "abc123",
  "message": "I did 8 reps, felt tough",
  "input_mode": "voice",
  "current_state": "check_in"
}

Response:
{
  "reply": "Nice work, 8 reps is solid. That's tough but you pushed through. Let's bring it down to 6 for the next set. Rest for 60 seconds — you've earned it.",
  "next_state": "rest",
  "adaptation": { "next_target_reps": 6 },
  "rest_duration_seconds": 60,
  "audio_url": null  // null if TTS handled separately
}
```

### 5.2 TTS Stream

```
POST /api/tts/stream
Authorization: Bearer <firebase_jwt>

Request:
{
  "text": "Nice work, 8 reps is solid...",
  "voice_id": "user_selected_voice_id"
}

Response: audio/mpeg stream (chunked transfer encoding)
```

### 5.3 STT Transcribe

```
POST /api/stt/transcribe
Authorization: Bearer <firebase_jwt>
Content-Type: multipart/form-data

Request: audio file (WAV/WebM)

Response:
{
  "transcript": "I did 8 reps felt tough",
  "confidence": 0.94
}
```

### 5.4 Start Session

```
POST /api/session/start
Authorization: Bearer <firebase_jwt>

Request:
{
  "routine_id": "routine_abc",
  "day": "wednesday"
}

Response:
{
  "session_id": "session_xyz",
  "exercises": [
    {
      "exercise_id": "ex1",
      "name": "Seated Bicep Curls",
      "sets": 3,
      "target_reps": 10,
      "rest_seconds": 60,
      "instructions": ["Sit on a chair...", "Hold dumbbells...", ...],
      "image_url": "https://..."
    },
    ...
  ],
  "greeting": "Hey Roshini! Ready for upper body today? We've got 4 exercises lined up."
}
```

### 5.5 End Session

```
POST /api/session/end
Authorization: Bearer <firebase_jwt>

Request:
{
  "session_id": "session_xyz",
  "ended_early": false,
  "post_workout_feedback": {
    "overall_difficulty": 3,
    "energy_level": "medium"
  }
}

Response:
{
  "summary": "Today you did 4 exercises, 12 sets total, 94 reps...",
  "recovery_recommendation": "Rest tomorrow. Hydrate well tonight. Light stretching recommended for shoulders.",
  "xp_awarded": 115,
  "new_total_xp": 2340,
  "level_up": false,
  "streak": { "current": 5, "is_new_best": false }
}
```

### 5.6 Generate Routine

```
POST /api/routine/generate
Authorization: Bearer <firebase_jwt>

Request:
{
  "regenerate": false,
  "feedback": null
}

Response:
{
  "routine_id": "routine_abc",
  "plan": {
    "monday": { "focus": "Upper Body", "exercises": [...], "duration_min": 30 },
    "wednesday": { "focus": "Lower Body", "exercises": [...], "duration_min": 30 },
    "friday": { "focus": "Full Body", "exercises": [...], "duration_min": 30 }
  },
  "persona_applied": "home_workout",
  "notes": "Excluded lunges due to reported knee pain on June 10."
}
```

### 5.7 Personalization

```
POST /api/personalize
Authorization: Bearer <firebase_jwt>

Request: (no body — uses stored profile)

Response:
{
  "persona": "home_workout",
  "confidence": 85,
  "calculated_metrics": {
    "bmi": 24.2,
    "calorie_needs": 2100,
    "max_heart_rate": 185
  },
  "recommendations": {
    "intensity": "moderate",
    "focus_areas": ["upper_body", "core"],
    "avoid": ["high_impact", "heavy_barbell"]
  }
}
```

---

## 6. Claude System Prompt Architecture

The system prompt is constructed dynamically per-session from multiple layers:

```
┌─────────────────────────────────────────────────┐
│           SYSTEM PROMPT (assembled per call)      │
├─────────────────────────────────────────────────┤
│                                                  │
│  Layer 1: BASE PERSONALITY                       │
│  • Companion name and identity                   │
│  • Tone: warm, patient, caring                   │
│  • Language: simple, no jargon                   │
│  • Safety rules (pain = stop, no medical advice) │
│                                                  │
│  Layer 2: USER CONTEXT                           │
│  • User's name, age, conditions                  │
│  • Assigned persona + implications               │
│  • Motivation style preference                   │
│  • Pain history (exercises to avoid)             │
│                                                  │
│  Layer 3: SESSION CONTEXT                        │
│  • Today's exercise plan                         │
│  • Current state in state machine                │
│  • Current exercise + set number                 │
│  • Adaptations made so far this session          │
│                                                  │
│  Layer 4: HISTORY CONTEXT                        │
│  • Last 3 session summaries                      │
│  • Recent daily check-in data                    │
│  • Progress highlights (PR achievements)         │
│                                                  │
│  Layer 5: INSTRUCTIONS                           │
│  • What to output for current state              │
│  • Expected response format (JSON structure)     │
│  • Guardrails and constraints                    │
│                                                  │
└─────────────────────────────────────────────────┘
```

### Token Budget Strategy

| Layer | Estimated Tokens | Notes |
|-------|-----------------|-------|
| Base personality | ~500 | Static, cached |
| User context | ~200 | Changes rarely |
| Session context | ~300 | Changes each turn |
| History (last 5-8 turns) | ~800 | Rolling window |
| Session summaries (last 3) | ~300 | Compressed summaries |
| Instructions | ~200 | Per-state |
| **Total system + context** | **~2,300** | Per call |
| User message | ~50 | Short utterances |
| **Max output** | ~300 | Companion response |
| **Total per turn** | **~2,650 tokens** | |

At ~$3/M input tokens (Sonnet): **~$0.008 per turn**, ~$0.16 per 20-turn session.

---

## 7. Project Structure

```
kinetic-age/
├── mobile/                          # React Native app
│   ├── app.json
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── navigation/
│   │   │   ├── AppNavigator.tsx     # Main tab + stack navigation
│   │   │   └── types.ts
│   │   ├── screens/
│   │   │   ├── Onboarding/
│   │   │   │   ├── AgeScreen.tsx
│   │   │   │   ├── HeightWeightScreen.tsx
│   │   │   │   ├── FitnessLevelScreen.tsx
│   │   │   │   ├── ConditionsScreen.tsx
│   │   │   │   ├── GoalsScreen.tsx
│   │   │   │   ├── EquipmentScreen.tsx
│   │   │   │   ├── PreferencesScreen.tsx
│   │   │   │   └── PlanReviewScreen.tsx
│   │   │   ├── Dashboard/
│   │   │   │   └── DashboardScreen.tsx
│   │   │   ├── Session/
│   │   │   │   ├── WorkoutSessionScreen.tsx
│   │   │   │   └── SessionSummaryScreen.tsx
│   │   │   ├── Library/
│   │   │   │   ├── ExerciseListScreen.tsx
│   │   │   │   └── ExerciseDetailScreen.tsx
│   │   │   ├── Progress/
│   │   │   │   └── ProgressScreen.tsx
│   │   │   └── Profile/
│   │   │       └── ProfileScreen.tsx
│   │   ├── components/
│   │   │   ├── VoiceButton.tsx      # Mic button with recording state
│   │   │   ├── ChatBubble.tsx       # Message display
│   │   │   ├── ExerciseCard.tsx     # Exercise info card
│   │   │   ├── StreakBadge.tsx      # Streak display
│   │   │   ├── XPBar.tsx           # Level/XP progress bar
│   │   │   ├── ProgressChart.tsx    # Weekly/monthly charts
│   │   │   └── RestTimer.tsx        # Countdown timer
│   │   ├── stores/
│   │   │   ├── sessionStore.ts      # Workout state machine
│   │   │   ├── userStore.ts         # Profile + persona
│   │   │   ├── chatStore.ts         # Conversation history
│   │   │   └── gamificationStore.ts # XP, streak, achievements
│   │   ├── services/
│   │   │   ├── api.ts               # Axios instance + interceptors
│   │   │   ├── auth.ts              # Firebase Auth wrapper
│   │   │   ├── voice.ts             # Audio recording (expo-av)
│   │   │   └── audio.ts             # Audio playback (TTS)
│   │   ├── hooks/
│   │   │   ├── useVoiceInput.ts     # Voice recording hook
│   │   │   ├── useAudioPlayback.ts  # TTS playback hook
│   │   │   ├── useSession.ts        # Session state hook
│   │   │   └── useCompanion.ts      # Send message + get response
│   │   ├── utils/
│   │   │   ├── stateMachine.ts      # State transitions
│   │   │   └── formatters.ts        # Time, reps display
│   │   └── theme/
│   │       └── index.ts             # Colors, fonts, spacing
│   └── assets/
│       └── images/
│
├── server/                          # Node.js backend
│   ├── package.json
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts                 # Express app entry
│   │   ├── config/
│   │   │   ├── db.ts               # MongoDB connection
│   │   │   └── env.ts              # Environment variables
│   │   ├── middleware/
│   │   │   ├── auth.ts             # Firebase JWT verification
│   │   │   ├── rateLimit.ts        # Per-user rate limiting
│   │   │   └── validate.ts         # Request body validation
│   │   ├── routes/
│   │   │   ├── auth.ts
│   │   │   ├── profile.ts
│   │   │   ├── personalize.ts
│   │   │   ├── routine.ts
│   │   │   ├── session.ts
│   │   │   ├── companion.ts
│   │   │   ├── tts.ts
│   │   │   ├── stt.ts
│   │   │   ├── exercises.ts
│   │   │   ├── progress.ts
│   │   │   ├── gamification.ts
│   │   │   └── dailyCheckin.ts
│   │   ├── services/
│   │   │   ├── claude.ts           # Claude API wrapper
│   │   │   ├── deepgram.ts         # Deepgram STT wrapper
│   │   │   ├── elevenlabs.ts       # ElevenLabs TTS wrapper
│   │   │   ├── session.ts          # Session logic
│   │   │   ├── gamification.ts     # XP + streak logic
│   │   │   ├── personalization.ts  # Persona assignment + metrics
│   │   │   └── routine.ts          # Routine generation via Claude
│   │   ├── models/
│   │   │   ├── User.ts             # Mongoose schema
│   │   │   ├── Routine.ts
│   │   │   ├── Session.ts
│   │   │   ├── SessionTurn.ts
│   │   │   ├── Exercise.ts
│   │   │   └── DailyCheckin.ts
│   │   ├── prompts/
│   │   │   ├── basePersonality.ts  # Layer 1: static personality
│   │   │   ├── sessionGuide.ts     # Layer 5: per-state instructions
│   │   │   └── buildPrompt.ts      # Assembles full system prompt
│   │   └── utils/
│   │       ├── retry.ts            # p-retry wrapper
│   │       └── tokenCounter.ts     # Estimate token usage
│   └── seeds/
│       └── exercises.json          # Initial exercise library data
│
└── shared/                          # Shared TypeScript types
    └── types/
        ├── user.ts
        ├── session.ts
        ├── exercise.ts
        ├── routine.ts
        └── api.ts                   # Request/response types
```

---

## 8. Implementation Steps (Ordered)

### Phase 1: Foundation (Week 1)

**Step 1: Project Setup**
- Initialize React Native project with Expo
- Initialize Node.js + Express backend with TypeScript
- Set up shared types package
- Configure ESLint, Prettier, tsconfig

**Step 2: Database & Auth**
- Create MongoDB Atlas cluster
- Define Mongoose schemas for all collections
- Set up Firebase Auth project
- Implement auth middleware on backend
- Build login/signup screen on mobile

**Step 3: Basic Claude Integration**
- Create Claude service with system prompt
- Build POST /api/companion/message endpoint
- Create a basic chat screen (text only) on mobile
- Verify conversation works end-to-end

**Step 4: Voice Services (Isolated)**
- Integrate Deepgram: build /api/stt/transcribe endpoint
- Integrate ElevenLabs: build /api/tts/stream endpoint
- Build useVoiceInput hook (expo-av recording)
- Build useAudioPlayback hook (stream playback)
- Test each in isolation: record → transcribe, text → audio

**Step 5: App Structure**
- Set up React Navigation (tabs + stacks)
- Create Zustand stores (session, user, chat, gamification)
- Build basic screen shells for all screens
- Implement theme (colors, fonts, spacing)

---

### Phase 2: Core Loop (Week 2)

**Step 6: Voice Pipeline Connected**
- Connect: mic → Deepgram → Claude → ElevenLabs → speaker
- Implement VoiceButton component with states (idle, recording, processing, playing)
- Add text display of transcription and companion response
- Test full voice loop end-to-end

**Step 7: Session State Machine**
- Implement stateMachine.ts with all state transitions
- Build WorkoutSessionScreen with state-driven UI
- Wire state transitions to companion messages
- Handle: exercise_intro → set_active → set_complete → check_in → rest → loop

**Step 8: Check-Ins & Adaptation**
- Implement check-in flow: reps → difficulty → adaptation
- Build adaptation logic (+2/-2 reps, floor of 3)
- Store check-in data in session_turns
- Display adaptations in UI

**Step 9: Routine Generation**
- Build POST /api/routine/generate using Claude
- Create routine display UI
- Implement "Start Workout" → loads today's exercises from active routine
- Test: profile → routine → session → adaptation cycle

**Step 10: Text Chat Fallback**
- Build ChatBubble component
- Add text input alongside voice button
- Ensure seamless switching (same conversation history)
- Test mid-session voice→text→voice transitions

---

### Phase 3: Onboarding & Personalization (Week 3, Part 1)

**Step 11: Onboarding Flow**
- Build all onboarding screens (age, height/weight, conditions, goals, equipment, preferences)
- Implement profile storage
- Add input validation
- Resume from last step if interrupted

**Step 12: AI Personalization Engine**
- Implement BMI, calorie, max heart rate calculations
- Build persona assignment logic (rules + Claude analysis)
- Store persona with confidence score
- Wire persona into system prompt

**Step 13: Companion Preferences**
- Build voice selection screen (preview ElevenLabs voices)
- Build interaction level and motivation style pickers
- Store preferences and apply to system prompt
- Build plan review/approval screen

---

### Phase 4: Content & Polish (Week 3, Part 2)

**Step 14: Exercise Library**
- Seed database with 50+ exercises (JSON import)
- Build ExerciseListScreen and ExerciseDetailScreen
- Add exercise images
- Wire exercise references into companion announcements

**Step 15: Session Summary & Recovery**
- Implement session summary generation (Claude)
- Build SessionSummaryScreen with stats
- Add recovery recommendations
- Store summaries and reference in future sessions

**Step 16: Safety & Pain Handling**
- Add pain detection to system prompt
- Implement pain event recording
- Wire pain history into routine exclusions
- Add medical deferral responses
- Test: "my knee hurts" → stop → offer skip/end

**Step 17: Motivational Dialogue Polish**
- Iterate system prompt for varied, non-repetitive motivation
- Add streak/progress references to rest-period dialogue
- Test with multiple full sessions for variety

---

### Phase 5: Gamification & Engagement (Week 4, Part 1)

**Step 18: Streak System**
- Implement streak tracking logic in gamification service
- Build StreakBadge component
- Add streak milestone detection and bonus XP
- Implement streak-at-risk push notification

**Step 19: XP System**
- Implement XP calculation on session end
- Build XPBar component (level + progress)
- Add level-up detection and companion announcement
- Display on dashboard

**Step 20: Progress Charts**
- Build ProgressScreen with charts (Victory Native or react-native-chart-kit)
- Implement backend aggregation queries for weekly/monthly data
- Add personal bests section
- Wire improvement detection into companion motivation

**Step 21: Daily Check-Ins**
- Build daily check-in flow (3 quick questions)
- Store in daily_checkins collection
- Award 10 XP per check-in
- Feed data into next session planning

**Step 22: Dashboard**
- Build DashboardScreen with today's workout, streak, XP, greeting
- Add quick-action buttons
- Show persona label
- Handle resume interrupted session

---

### Phase 6: Testing & Demo (Week 4, Part 2)

**Step 23: Integration Testing**
- Test full flow: onboarding → personalization → routine → session → summary → progress
- Test voice pipeline on real devices (iOS + Android)
- Test on mobile data (not just WiFi)
- Test edge cases: pain mid-session, skip all exercises, end early, network drops

**Step 24: Prompt Tuning**
- Run 10+ full sessions with varied personas
- Iterate system prompt for natural conversation flow
- Test pain handling responses
- Test motivation variety across multiple sessions
- Get feedback from test users (ideally different age groups)

**Step 25: Bug Fixes & Polish**
- Fix issues found in testing
- UI polish (animations, transitions, loading states)
- Error handling for all failure modes
- Offline fallback (cache current exercise plan locally)

**Step 26: Demo Preparation**
- Record demo video: full workout session with voice companion
- Prepare presentation covering: problem, solution, demo, tech, next steps
- Document any known limitations

---

## 9. Deployment Architecture

```
┌─────────────────┐     ┌─────────────────────────┐
│   App Store     │     │    Google Play Store     │
│   (iOS build)   │     │    (Android build)       │
└────────┬────────┘     └────────────┬────────────┘
         │                           │
         └─────────────┬─────────────┘
                       │
                       ▼
              ┌─────────────────┐
              │  Railway / Render│  ← Node.js backend
              │  (Auto-scaling)  │
              └────────┬────────┘
                       │
         ┌─────────────┼─────────────┐
         │             │             │
         ▼             ▼             ▼
┌──────────────┐ ┌──────────┐ ┌──────────────┐
│MongoDB Atlas │ │ Firebase │ │  Cloudinary  │
│ (Database)   │ │  (Auth)  │ │  (Images)    │
└──────────────┘ └──────────┘ └──────────────┘
```

**Environment Variables (Backend):**
```
MONGODB_URI=mongodb+srv://...
FIREBASE_PROJECT_ID=...
FIREBASE_PRIVATE_KEY=...
ANTHROPIC_API_KEY=sk-ant-...
DEEPGRAM_API_KEY=...
ELEVENLABS_API_KEY=...
ELEVENLABS_DEFAULT_VOICE_ID=...
PORT=3000
NODE_ENV=production
```

---

## 10. Security Considerations

- All API keys stored server-side only, never in mobile client
- Firebase Auth JWT verified on every backend request
- Rate limiting: 60 requests/min per user (prevents abuse of Claude/ElevenLabs)
- Audio files not stored permanently — transcribed and discarded
- User data associated only with authenticated user ID (no cross-user access)
- HTTPS enforced on all endpoints
- Input validation on all routes (express-validator or zod)
- Mongoose schemas provide additional type safety at DB level

---

## 11. Scalability Path

| Users | Infrastructure | Changes Needed |
|-------|---------------|----------------|
| 0-500 | Single Railway instance + Atlas free/M10 | None |
| 500-5k | Railway Pro + Atlas M30 + Redis cache | Add Redis for session state caching |
| 5k-50k | Multiple Railway instances + Atlas M50 + CDN | WebSocket for real-time, load balancer, CDN for exercise images |
| 50k+ | Kubernetes + Atlas sharded + microservices | Split into microservices (session, companion, gamification) |

---

*Document created: June 2026*
*Based on requirements v21 and agreed tech stack*
