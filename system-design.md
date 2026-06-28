# KineticAge AI Companion — System Design Document

## 1. System Overview

KineticAge is an AI-powered fitness companion that combines a **deterministic, trainer-approved Rules Engine** for workout generation with an **AI conversational layer** (Claude) for explanation, motivation, and coaching. The Rules Engine guarantees safe, predictable, explainable workout content. The AI layer makes it feel human. These two systems are deliberately separated — the AI never invents exercises or prescribes weights.

---

## 2. High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        MOBILE CLIENT                                      │
│                   (React Native + TypeScript)                             │
│                                                                           │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  Onboarding │  │  Dashboard  │  │   Bundle     │  │   Workout    │  │
│  │    Flow     │  │   + Home    │  │   Selection  │  │   Session    │  │
│  └─────────────┘  └─────────────┘  └──────────────┘  └──────────────┘  │
│                                                                           │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │                    Zustand State Stores                             │  │
│  │  • sessionStore (state machine, exercises, sets)                   │  │
│  │  • userStore (profile, persona tags, preferences)                  │  │
│  │  • chatStore (conversation history)                                │  │
│  │  • gamificationStore (XP, streak, badges)                          │  │
│  │  • bundleStore (current bundle options)                            │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                           │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────────────────┐ │
│  │ Audio Layer │  │ API Service  │  │ Local Cache (AsyncStorage)      │ │
│  │ (expo-av)   │  │ (fetch)      │  │                                 │ │
│  └─────────────┘  └──────┬───────┘  └─────────────────────────────────┘ │
└──────────────────────────────┼───────────────────────────────────────────┘
                               │ HTTPS / REST
┌──────────────────────────────┼───────────────────────────────────────────┐
│                              ▼            BACKEND SERVER                   │
│                   (Node.js + Express + TypeScript)                         │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                      Middleware Layer                                │ │
│  │  • Firebase Auth JWT Verification                                   │ │
│  │  • Rate Limiting (per-user)                                         │ │
│  │  • Request Validation (zod)                                         │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │                        Service Layer                                 │ │
│  │                                                                      │ │
│  │  ┌───────────────────────────────────────────────────────────────┐  │ │
│  │  │         RULES ENGINE (deterministic, no LLM)                  │  │ │
│  │  │  1. Filter Stage — equipment, location, injuries              │  │ │
│  │  │  2. Category Stage — goal-based set/rep/rest rules            │  │ │
│  │  │  3. Persona Modifier Stage — persona-based additions          │  │ │
│  │  │  4. Bundle Assembly Stage — produce 3-4 bundles               │  │ │
│  │  └───────────────────────────────────────────────────────────────┘  │ │
│  │                                                                      │ │
│  │  ┌───────────────────────────────────────────────────────────────┐  │ │
│  │  │         AI SERVICE (Claude — explain & motivate only)         │  │ │
│  │  │  • Generate bundle rationale text                             │  │ │
│  │  │  • Conversational coaching (voice + text)                     │  │ │
│  │  │  • Exercise explanations from library data                    │  │ │
│  │  │  • Post-workout summaries                                     │  │ │
│  │  │  • Motivational messaging                                    

 │  │ │
│  │  │  • NEVER generates exercise content or weights                │  │ │
│  │  └───────────────────────────────────────────────────────────────┘  │ │
│  │                                                                      │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────────────────┐   │ │
│  │  │ Progression  │  │ Gamification │  │ Persona Assignment      │   │ │
│  │  │ Service      │  │ Service      │  │ Service                 │   │ │
│  │  │ (per-exercise│  │ (XP, streak, │  │ (rules-based,           │   │ │
│  │  │  tracking)   │  │  badges)     │  │  multi-tag)             │   │ │
│  │  └──────────────┘  └──────────────┘  └─────────────────────────┘   │ │
│  │                                                                      │ │
│  │  ┌──────────────┐  ┌──────────────┐                                │ │
│  │  │ Deepgram     │  │ ElevenLabs   │                                │ │
│  │  │ (STT)        │  │ (TTS stream) │                                │ │
│  │  └──────────────┘  └──────────────┘                                │ │
│  │                                                                      │ │
│  │  All external API calls wrapped with p-retry (3x, exponential)      │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                           │
└──────────┬──────────────────┬────────────────────┬───────────────────────┘
           │                  │                    │
           ▼                  ▼                    ▼
┌──────────────────┐ ┌───────────────┐ ┌─────────────────────┐
│  MongoDB Atlas   │ │  Claude API   │ │  Deepgram + 11Labs  │
│  • users         │ │  (Anthropic)  │ │                     │
│  • exercises     │ │  Explain &    │ │                     │
│  • bundles       │ │  motivate     │ │                     │
│  • sessions      │ │  ONLY         │ │                     │
│  • progression   │ └───────────────┘ └─────────────────────┘
│  • gamification  │
└──────────────────┘
```

---

## 3. Rules Engine Detail

### 3.1 Four-Stage Pipeline

```
User Profile + Exercise Library
            │
            ▼
┌─────────────────────────────────────────────────┐
│ STAGE 1: FILTER                                  │
│ Input: Full exercise library (80-120 exercises)  │
│ Rules:                                           │
│   - Exclude if equipment not in user's list      │
│   - Exclude if location not compatible           │
│   - Exclude if contraindicated for user injuries │
│ Output: Eligible exercise set                    │
└──────────────────────┬──────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────┐
│ STAGE 2: CATEGORY                                │
│ Input: Eligible exercises + user's fitness goal  │
│ Rules:                                           │
│   - Map goal → Workout Category                  │
│   - Apply category-specific set/rep/rest ranges  │
│   - Apply exercise-type ratios                   │
│     (e.g., Hypertrophy: 60% compound, 40% iso)  │
│ Output: Categorized, parameterized exercises     │
└──────────────────────┬──────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────┐
│ STAGE 3: PERSONA MODIFIER                        │
│ Input: Categorized exercises + persona tags      │
│ Rules (additive, priority order):                │
│   - Injury Recovery → add rehab-friendly moves   │
│   - Office Professional → add posture exercises  │
│   - Complete Beginner → reduce volume, simplify  │
│   - Home Workout → ensure bodyweight options     │
│ Priority: Injury > Equipment > Goal > Persona   │
│ Output: Modified exercise set                    │
└──────────────────────┬──────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────┐
│ STAGE 4: BUNDLE ASSEMBLY                         │
│ Input: Modified exercises + progression data     │
│ Rules:                                           │
│   - Produce 3-4 distinct bundles                 │
│   - Differentiate by: focus, duration, intensity │
│   - Score each against: planned focus, recent    │
│     muscle groups, recovery status               │
│   - Mark highest-scoring as is_recommended       │
│   - Include: title, duration, calorie range,     │
│     exercise list (sets/reps/rest), rationale    │
│   - Ensure no specific weight values anywhere    │
│ Output: 3-4 ExerciseBundle objects               │
└─────────────────────────────────────────────────┘
```

### 3.2 Category Rules

| Category | Rep Range | Rest | Exercise Type Ratio | Progression |
|----------|-----------|------|--------------------| ------------|
| Strength | 3-6 | 90-180s | Compound-heavy | Add reps in range → suggest heavier |
| Hypertrophy | 8-12 | 60-90s | 60% compound, 40% isolation | Add set after consistent completion |
| Mobility | 10-15 or time-based | 15-30s | Flow/hold-based | Increase hold duration or range |
| General Fitness | 8-12 mixed | 45-60s | Balanced | Rotate focus weekly |
| Weight Loss | 12-20 | 15-30s | Circuit/superset | Increase density (more work, same time) |
| Home Workout | Bodyweight, tempo | 30-60s | Bodyweight + unilateral | Harder variations, tempo manipulation |

### 3.3 Exercise Count by Duration

| Duration | Exercise Count | Structure |
|----------|---------------|-----------|
| 15 min | 3-4 | Minimal warm-up, circuit/superset |
| 30 min | 5-6 | Brief warm-up, main block, optional finisher |
| 45 min | 6-8 | Warm-up, main block, accessory block |
| 60 min | 8-10 | Full warm-up, main block, accessory, cool-down |

---

## 4. Progression Logic

```
Per-exercise tracking (or substitution group):

IF user completes TOP of rep range for 2 consecutive sessions:
  → Increase prescribed rep range OR add a set
  → AI suggests "consider slightly heavier next time" (no number)
  → Flag: progression_milestone (awards 20 XP)

IF user marks "felt hard" OR skips exercise 2+ times:
  → Deprioritize exercise in future bundles
  → Substitute from same substitution_group
  → Flag: deload_candidate

IF user marks "felt easy" consistently:
  → Fast-track progression criteria (1 session instead of 2)
```

---

## 5. Database Schema (MongoDB)

### 5.1 Collections

```javascript
// ═══════════════════════════════════════════════════════
// USERS
// ═══════════════════════════════════════════════════════
{
  _id: ObjectId,
  firebase_uid: String,
  name: String,
  email: String,
  age: Number,
  height_cm: Number,
  weight_kg: Number,
  gender: String,              // "male" | "female" | "other" | "prefer_not_to_say"
  fitness_goal: String,        // single select from 6 options
  activity_level: String,      // 4 levels
  workout_location: String,    // "gym" | "home" | "outdoors" | "hybrid"
  equipment: [String],         // multi-select
  injuries: [String],          // multi-select injury areas
  injury_notes: String,
  workout_duration: Number,    // 15 | 30 | 45 | 60
  prior_program_experience: Boolean,
  persona_tags: [String],      // 2-4 tags, not mutually exclusive
  companion_preferences: {
    voice_id: String,
    talkativeness: String,     // "minimal" | "balanced" | "high"
    in_session_verbosity: String  // "quiet" | "standard" | "detailed"
  },
  calculated_metrics: {
    bmi: Number,
    bmi_category: String,
    bmr: Number,
    tdee: Number,
    tdee_range: { low: Number, high: Number },
    max_heart_rate: Number,
    target_zone: { low: Number, high: Number }
  },
  gamification: {
    total_xp: Number,
    level: Number,
    current_streak: Number,
    longest_streak: Number,
    last_workout_date: Date,
    grace_days_used_this_week: Number,
    badges: [{ badge_id: String, earned_at: Date }]
  },
  pain_history: [{ exercise_id: ObjectId, body_area: String, reported_at: Date, session_id: ObjectId }],
  onboarding_completed: Boolean,
  created_at: Date,
  updated_at: Date
}

// ═══════════════════════════════════════════════════════
// EXERCISES (trainer-approved library, 80-120 entries)
// ═══════════════════════════════════════════════════════
{
  _id: ObjectId,
  exercise_id: String,
  name: String,
  category_tags: [String],         // which workout categories this applies to
  muscle_groups: {
    primary: [String],
    secondary: [String]
  },
  equipment_required: [String],
  location_compatible: [String],
  contraindications: [String],     // injury areas
  substitution_group: String,      // links substitutable exercises
  default_set_rep_range: {
    strength: { sets: 4, rep_min: 3, rep_max: 6, rest_seconds: 120 },
    hypertrophy: { sets: 3, rep_min: 8, rep_max: 12, rest_seconds: 75 },
    // ... per category
  },
  instructions_text: String,
  difficulty_level: String,
  image_url: String
}

// ═══════════════════════════════════════════════════════
// BUNDLES (generated workout options)
// ═══════════════════════════════════════════════════════
{
  _id: ObjectId,
  user_id: ObjectId,
  title: String,
  is_recommended: Boolean,
  estimated_duration_min: Number,
  estimated_calorie_burn: { low: Number, high: Number },
  exercises: [{
    exercise_id: ObjectId,
    name: String,
    sets: Number,
    rep_min: Number,
    rep_max: Number,
    rest_seconds: Number,
    instructions_text: String,
    image_url: String,
    muscle_groups: [String]
  }],
  rationale: String,
  focus: String,
  generated_at: Date,
  generation_context: {
    persona_tags: [String],
    fitness_goal: String,
    excluded_exercises: [ObjectId],
    recent_muscle_groups: [String]
  },
  set_id: ObjectId,  // groups bundles generated together
  active: Boolean
}

// ═══════════════════════════════════════════════════════
// SESSIONS (completed/in-progress workouts)
// ═══════════════════════════════════════════════════════
{
  _id: ObjectId,
  user_id: ObjectId,
  bundle_id: ObjectId,
  started_at: Date,
  completed_at: Date,
  status: String,          // "in_progress" | "full" | "partial" | "abandoned"
  exercises: [{
    exercise_id: ObjectId,
    exercise_name: String,
    status: String,        // "completed" | "skipped" | "pain_stopped" | "in_progress" | "pending"
    feedback: String,      // "felt_easy" | "felt_normal" | "felt_hard" | null
    skip_reason: String,
    sets: [{
      set_number: Number,
      target_rep_min: Number,
      target_rep_max: Number,
      actual_reps: Number,
      completed: Boolean,
      completed_at: Date
    }]
  }],
  pain_events: [{ exercise_id: ObjectId, body_area: String, timestamp: Date }],
  xp_awarded: Number,
  progression_flags: [{ exercise_id: ObjectId, type: String, details: String }]
}

// ═══════════════════════════════════════════════════════
// EXERCISE_PROGRESSION (per-user, per-exercise tracking)
// ═══════════════════════════════════════════════════════
{
  _id: ObjectId,
  user_id: ObjectId,
  exercise_id: ObjectId,
  substitution_group: String,
  history: [{
    session_id: ObjectId,
    date: Date,
    sets_completed: Number,
    reps_achieved: [Number],
    feedback: String,
    skipped: Boolean
  }],
  current_prescription: { sets: Number, rep_min: Number, rep_max: Number },
  progression_state: String,    // "stable" | "ready_to_progress" | "deload_candidate"
  consecutive_top_completions: Number,
  consecutive_skips_or_hard: Number
}

// ═══════════════════════════════════════════════════════
// SESSION_TURNS (conversation history)
// ═══════════════════════════════════════════════════════
{
  _id: ObjectId,
  session_id: ObjectId,
  user_id: ObjectId,
  role: String,          // "user" | "companion"
  content: String,
  input_mode: String,    // "voice" | "text"
  state_at_time: String,
  action_intent: String, // structured action if applicable
  timestamp: Date
}

// ═══════════════════════════════════════════════════════
// DAILY_CHECKINS
// ═══════════════════════════════════════════════════════
{
  _id: ObjectId,
  user_id: ObjectId,
  date: Date,
  energy_level: String,
  soreness: [{ body_area: String, severity: String }],
  xp_awarded: Number,
  created_at: Date
}
```

---

## 6. API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | /api/auth/signup | Create account |
| POST | /api/auth/login | Sign in |
| GET | /api/profile | Get user profile |
| PUT | /api/profile | Update profile |
| POST | /api/personalize | Run persona assignment + metrics calculation |
| POST | /api/bundles/generate | Generate 3-4 exercise bundles via Rules Engine |
| GET | /api/bundles/active | Get current active bundle set |
| POST | /api/session/start | Start workout session from selected bundle |
| PUT | /api/session/:id/exercise | Update exercise status (complete/skip/feedback) |
| POST | /api/session/:id/end | End session, calculate XP, evaluate progression |
| POST | /api/companion/message | Send message to AI companion |
| POST | /api/tts/stream | Convert text to speech (streaming) |
| POST | /api/stt/transcribe | Convert speech to text |
| GET | /api/exercises | List exercises (filtered) |
| GET | /api/exercises/:id | Get exercise detail |
| GET | /api/dashboard | Get aggregated dashboard data |
| POST | /api/daily-checkin | Submit daily check-in |
| GET | /api/progress | Get progression data for charts |

---

## 7. Claude System Prompt Architecture

Claude's role is strictly: **explain, motivate, answer, coach.** Never generate workout content.

```
┌─────────────────────────────────────────────────┐
│        SYSTEM PROMPT (assembled per call)         │
├─────────────────────────────────────────────────┤
│                                                  │
│  Layer 1: BASE PERSONALITY                       │
│  • Name and identity                             │
│  • Tone adapted to persona tags                  │
│  • Talkativeness / verbosity constraints         │
│  • Safety: never prescribe weights, never        │
│    invent exercises, defer medical questions      │
│                                                  │
│  Layer 2: USER CONTEXT                           │
│  • Name, age, persona tags                       │
│  • Injury areas (for sensitivity)                │
│  • Fitness goal + activity level                 │
│  • Pain history                                  │
│                                                  │
│  Layer 3: SESSION CONTEXT (if in workout)        │
│  • Current bundle title and exercises            │
│  • Current exercise + set number                 │
│  • Exercise instructions_text (for explanations) │
│  • Recent exercise feedback                      │
│                                                  │
│  Layer 4: CONVERSATION HISTORY                   │
│  • Last 5-8 turns                                │
│  • Recent session summaries                      │
│                                                  │
│  Layer 5: GUARDRAILS                             │
│  • Response must not contain weight numbers      │
│  • Response must not invent exercise names       │
│  • If asked about exercises not in the bundle,   │
│    redirect to the current plan                  │
│  • Medical disclaimer once per week for injury   │
│    users                                         │
│                                                  │
└─────────────────────────────────────────────────┘
```

---

## 8. Project Structure

```
kinetic-age/
├── mobile/                          # React Native (Expo)
│   └── src/
│       ├── navigation/
│       ├── screens/
│       │   ├── Onboarding/          # Multi-step guided flow
│       │   ├── Dashboard/           # Home, bundles, streak, XP
│       │   ├── BundleSelection/     # View 3-4 options, pick one
│       │   ├── Session/             # Active workout
│       │   ├── Library/             # Browse exercises
│       │   ├── Progress/            # Charts, history
│       │   └── Profile/             # Settings, preferences
│       ├── components/
│       ├── stores/                  # Zustand
│       ├── services/                # API layer
│       ├── hooks/                   # useVoice, useSession, etc.
│       └── theme/
│
├── server/                          # Node.js + Express
│   └── src/
│       ├── config/
│       ├── middleware/
│       ├── routes/
│       ├── services/
│       │   ├── rulesEngine/         # THE RULES ENGINE
│       │   │   ├── filterStage.ts
│       │   │   ├── categoryStage.ts
│       │   │   ├── personaModifier.ts
│       │   │   ├── bundleAssembly.ts
│       │   │   └── index.ts
│       │   ├── progression.ts       # Per-exercise progression tracking
│       │   ├── persona.ts           # Persona assignment rules
│       │   ├── gamification.ts      # XP, streaks, badges
│       │   ├── claude.ts            # AI companion (explain/motivate only)
│       │   ├── deepgram.ts          # STT
│       │   └── elevenlabs.ts        # TTS
│       ├── models/                  # Mongoose schemas
│       ├── prompts/                 # Claude system prompt layers
│       └── utils/
│
├── shared/                          # Shared TypeScript types
│   └── types/
│
└── docs/                            # Documentation
```

---

## 9. Security & Performance

- All API keys server-side only
- Firebase Auth JWT on every request
- Rate limiting: 60 req/min per user
- p-retry on all external APIs (Claude, Deepgram, ElevenLabs)
- Voice latency target: < 4 seconds end-to-end
- Rules Engine is pure computation — no network calls, runs in <100ms
- Bundle generation (Rules Engine + AI rationale): < 5 seconds total
- Audio streaming from ElevenLabs — first chunk plays before full response ready

---

## 10. Scalability Path

| Users | Infrastructure |
|-------|---------------|
| 0-500 | Single server + Atlas free/M10 |
| 500-5k | Multiple instances + Atlas M30 + Redis |
| 5k-50k | WebSocket for real-time, load balancer, CDN |
| 50k+ | Microservices split (rules engine, AI, gamification) |

---

*Document updated: June 2026*
*Aligned to KineticAge PRD v1.0 (target demo: 17 July 2026)*
