# KineticAge — Complete User Flow

## Overview

KineticAge is a voice-first AI fitness companion. The core architecture separates **workout generation** (deterministic Rules Engine) from **coaching** (AI companion). The AI never invents exercises or prescribes weights — it only explains, motivates, and responds to the user using data from the Rules Engine.

---

## 1. Authentication

### 1.1 Guest Sign-In
```
Client → POST /api/auth/guest → Server
```
- Server creates an anonymous Firebase user via `admin.auth().createUser({})`
- Generates a custom token via `admin.auth().createCustomToken(uid)`
- Creates a MongoDB User document with `is_guest: true`, `onboarding_completed: false`
- Returns: `{ token, uid, is_guest: true }`
- Client exchanges custom token for an ID token via Firebase SDK (`signInWithCustomToken`)

### 1.2 Google Sign-In
```
Client → Firebase Google popup → POST /api/auth/google → Server
```
- Client completes Google sign-in via Firebase SDK (popup flow)
- Client calls `/api/auth/google` with the Firebase ID token in `Authorization: Bearer <token>`
- Server verifies JWT via `admin.auth().verifyIdToken(token)`
- If user exists in MongoDB → returns profile (`is_new: false`)
- If new user → creates MongoDB document, returns `is_new: true`

### 1.3 Guest → Full Account Upgrade
```
Client → POST /api/auth/upgrade → Server
```
- After guest user signs in with Google/email, client calls upgrade
- Server updates `is_guest: false`, adds name/email to the existing MongoDB document
- All existing data (sessions, progress) is preserved

### Edge Cases
- **Expired token**: Server returns 401, client refreshes via `getIdToken(true)` and retries
- **Invalid token**: Server returns 401 "Invalid or expired token"
- **Rate limiting**: 60 requests/min per user (keyed by UID or IP)

---

## 2. Onboarding

### 2.1 Profile Setup
```
Client → PUT /api/profile → Server
```
Collects (in guided conversational flow on mobile):
- **name**: string
- **age**: 16–100 (validated, blocked if <16)
- **height_cm**: number (or converted from ft/in)
- **weight_kg**: number (or converted from lbs)
- **gender**: male | female | other | prefer_not_to_say
- **fitness_goal**: strength | hypertrophy | mobility | general_fitness | weight_loss | home_workout
- **activity_level**: sedentary | lightly_active | moderately_active | very_active
- **workout_location**: gym | home | outdoors | hybrid
- **equipment**: multi-select array (none, dumbbells, barbell, resistance_bands, kettlebell, pull_up_bar, bench, machines, cardio_equipment)
- **injuries**: multi-select array (none, knee, lower_back, shoulder, wrist, ankle, other) + free text notes
- **workout_duration**: 15 | 30 | 45 | 60 minutes
- **prior_program_experience**: boolean
- **companion_preferences**: { talkativeness: minimal|balanced|high, in_session_verbosity: quiet|standard|detailed }

### 2.2 Personalization
```
Client → POST /api/personalize → Server
```
Runs synchronously after onboarding submission:

**Calculated Metrics:**
- BMI = weight_kg / (height_m)² → categorized as underweight/normal/overweight/obese
- BMR (Mifflin-St Jeor): Male = (10×weight) + (6.25×height) − (5×age) + 5
- TDEE = BMR × activity multiplier (1.2 / 1.375 / 1.55 / 1.725)
- MHR = 220 − age
- Target Training Zone = 60%–80% of MHR

**Persona Assignment (2–4 tags, not mutually exclusive):**
- `complete_beginner`: Sedentary + no prior program
- `regular_gym_goer`: Moderate/Very Active + Gym + prior program
- `weight_loss_seeker`: Goal = Weight Loss
- `strength_training_user`: Goal = Strength
- `home_workout_user`: Location = Home + minimal equipment
- `office_professional`: Sedentary/Light + 15 or 30 min duration
- `injury_recovery_user`: Injuries ≠ None
- `ai_companion_seeker`: Talkativeness = High
- `inconsistent_enthusiast`: Behavioral — applied after 2 weeks if completion rate <50%

**Outputs:**
- Sets `onboarding_completed: true`
- Awards 15 XP (one-time onboarding bonus)
- Stores calculated_metrics and persona_tags on user document

### Edge Cases
- **Exit during onboarding**: Progress saved, resumes from last step on next login
- **Age <16**: Blocked with message, cannot proceed
- **Unusual values** (height 250cm, weight 300kg): Client prompts confirmation
- **Missing required fields**: `/api/personalize` returns 400 if incomplete

---

## 3. Workout Generation (Rules Engine)

### 3.1 Trigger
```
Client → POST /api/bundles/generate → Server
```
Called when:
- User completes onboarding (first time)
- User dismisses all bundles and requests regeneration
- User opens app with no active bundles

### 3.2 Four-Stage Pipeline

**Stage 1: Filter**
- Input: Full exercise library (80+ exercises from MongoDB)
- Excludes exercises where:
  - Equipment not in user's list
  - Location not compatible (unless user is "hybrid")
  - Contraindicated for user's injuries (highest priority)
- Fallback: If <3 exercises pass, adds all bodyweight/no-equipment exercises

**Stage 2: Category**
- Maps fitness_goal → workout category rules:
  - Strength: 3–6 reps, 90–180s rest, compound-heavy
  - Hypertrophy: 8–12 reps, 60–90s rest, 60% compound / 40% isolation
  - Mobility: 10–15 reps or time-based, 15–30s rest
  - General Fitness: 8–12 reps mixed, 45–60s rest
  - Weight Loss: 12–20 reps, 15–30s rest, circuit-style
  - Home Workout: bodyweight-focused, 30–60s rest
- Applies category-specific set/rep/rest from each exercise's `default_set_rep_range`
- Fallback: Uses general_fitness defaults if category yields too few

**Stage 3: Persona Modifier**
- Additive modifications based on active persona tags:
  - `complete_beginner`: Reduce sets by 1 (min 2), prefer beginner-difficulty exercises
  - `office_professional`: Add 1 posture/mobility exercise if not present
  - `injury_recovery_user`: Add 1 mobility exercise for affected area (non-contraindicated)
  - Others: No workout modifications (only affect AI tone)
- Priority: Injury exclusions > Equipment/Location > Goal > Persona

**Stage 4: Bundle Assembly**
- Produces 3–4 distinct bundles following a fixed exercise sequence:
  1. Warm-up (1 exercise)
  2. Primary Goal (2 exercises)
  3. BMI Targeting (1 exercise) — varies by BMI category
  4. Core (1 exercise)
  5. Cardio Finisher (1 exercise)
  6. Cool-down Stretch (1 exercise)
- Exercise count adjusted by duration (15min=4, 30min=6, 45min=7, 60min=7-8)
- Scores bundles against: recently trained muscle groups, variety
- Marks exactly 1 as `is_recommended: true`
- No specific weight values anywhere

### 3.3 AI Rationale
After bundles are assembled, AI (Gemini) generates a 1-line rationale for each bundle using only structured data from the pipeline. If AI is unavailable, generic fallback text is used — generation never blocks on AI.

### 3.4 Storage
- Previous active bundles deactivated (`active: false`)
- New bundles stored in MongoDB with `active: true` and a shared `set_id`

### Edge Cases
- **Empty exercise library**: Error "Exercise library is empty. Run seed script."
- **Too few eligible exercises**: Fallback to bodyweight baseline
- **AI unavailable for rationale**: Generic fallback text used, bundles still display
- **All exercises filtered out by injuries**: Minimal bodyweight fallback set

---

## 4. Bundle Selection

### 4.1 Display
```
Client → GET /api/bundles/active → Server
```
Returns 3–4 bundles with:
- Title, focus, estimated duration, calorie burn range
- Exercise list (name, sets, rep range, rest, instructions, muscle groups)
- Rationale text
- `is_recommended` flag

### 4.2 User Choice
- Recommended bundle highlighted at top
- User can view full exercise details for any bundle
- User selects one (or dismisses all to regenerate)

### Edge Cases
- **Dismiss all bundles**: Companion asks about energy/time → regenerates with adjusted constraints
- **No active bundles found**: 404 → triggers generation

---

## 5. Workout Session

### 5.1 Start Session
```
Client → POST /api/session/start { bundle_id } → Server
```
- Creates Session document: `status: 'in_progress'`, exercises copied from bundle
- Each exercise: `status: 'pending'`, sets array with target_rep_min/max
- If an existing in-progress session exists → returns it for resume

### 5.2 State Machine
```
idle → session_starting → exercise_intro → set_active → set_complete → check_in → rest → (loop) → session_summary → idle
```
- UI, companion messages, and data all follow from current state
- Transitions triggered by user action or timer completion
- Never skip states

### 5.3 During Workout

**Complete a set:**
```
Client → PUT /api/session/:id/exercise { exercise_id, action: 'complete_set', data: { set_number, actual_reps } }
```
- Marks set as completed with timestamp and actual reps
- Rest timer begins automatically

**Complete an exercise:**
```
Client → PUT /api/session/:id/exercise { exercise_id, action: 'complete_exercise', data: { feedback: 'felt_easy'|'felt_normal'|'felt_hard' } }
```
- Marks exercise as 'completed'

**Skip an exercise:**
```
Client → PUT /api/session/:id/exercise { exercise_id, action: 'skip', data: { reason } }
```
- Marks exercise as 'skipped', records reason

**Report pain:**
```
Client → PUT /api/session/:id/exercise { exercise_id, action: 'pain', data: { body_area } }
```
- Marks exercise as 'pain_stopped'
- Records pain event with exercise_id, body_area, timestamp
- AI immediately stops guidance, suggests rest, offers to skip/end

### 5.4 End Session
```
Client → POST /api/session/:id/end → Server
```
Calculates:
- **Completion ratio**: completed_exercises / total_exercises
- **Status**: full (100%) | partial (≥50%) | abandoned (<50%)
- **XP**: full=50, partial=25, abandoned=0 + first workout bonus=30 + progression milestones×20
- **Streak**: Incremented for full/partial, not for abandoned
- **Progression**: Evaluates per-exercise history (see Section 7)
- **Badges**: Evaluates all badge criteria (see Section 8)

### 5.5 Session Pause + Resume
```
Client → POST /api/session/:id/pause
Client → GET /api/session/active (checks for resumable session)
```
- Paused sessions can be resumed within 30 minutes
- After 30 min → automatically marked abandoned
- Starting a new session while one exists → returns existing for resume

### Edge Cases
- **Exit mid-session (≥50%)**: Marked partial, 25 XP awarded
- **Exit mid-session (<50%)**: Marked abandoned, 0 XP
- **Return within 30 min**: Offered resume from where they left off
- **Network drop during session**: Client caches locally, syncs on reconnect
- **Double-end**: Returns 400 "Session is not in progress"

---

## 6. Voice Pipeline

### 6.1 Architecture (Option A — Production: WebSocket Proxy)
```
┌──────────┐     WebSocket      ┌──────────────┐     WebSocket      ┌─────────────┐
│  Client  │ ←─────────────────→│  Server      │ ←─────────────────→│ Gemini Live │
│ (Browser │   Audio + JSON     │ /ws/voice-   │   Audio + JSON     │   API       │
│  or App) │                    │  live         │                    │             │
└──────────┘                    └──────┬───────┘                    └─────────────┘
                                       │
                                       ▼
                                ┌──────────────┐
                                │   MongoDB    │
                                │ (sessions,   │
                                │  turns, XP)  │
                                └──────────────┘
```

**Connection flow:**
1. Client connects to `ws://server/ws/voice-live?token=<jwt>&voice=Kore&session_id=<id>&bundle_id=<id>`
2. Server authenticates via Firebase JWT
3. Server loads user profile, active session, bundle from MongoDB
4. Server builds full system prompt (persona + Rules Engine data + voice rules)
5. Server opens WebSocket to Gemini Live API with that prompt
6. Server sends `context_loaded` message to client (bundle info, user name)

**Audio flow (bidirectional relay):**
- Client captures mic at 16kHz mono → converts to Int16 PCM → base64 → JSON → Server → Gemini
- Gemini responds with PCM 24kHz audio (binary frames) → Server → Client → Web Audio playback
- Latency: ~1–2 seconds end-to-end

**Server intercepts:**
- `inputTranscription` → persists as user turn in SessionTurn
- `outputTranscription` → persists as companion turn, checks for action intents
- Client `{ action: 'complete_set' }` → updates session in MongoDB (NOT relayed to Gemini)
- Detects phrases like "great set", "skip", "pain" → auto-marks in DB

**System prompt layers:**
1. Base personality (Kira identity, guardrails, tone)
2. User context (name, age, goal, persona tags, injuries)
3. Session context (current exercise, set number, reps, rest time)
4. Voice rules (short responses, no markdown, wait for user, never invent exercises)
5. Current Workout Plan (full exercise list from Rules Engine with sets/reps/rest/instructions)
6. User stats (level, XP, streak)

### 6.2 Alternative Pipeline (Option B — Deepgram + Gemini + ElevenLabs)
```
Client → Record audio → POST /api/stt/transcribe (Deepgram) → text
         → POST /api/companion/message (Gemini) → reply text
         → POST /api/tts/stream (ElevenLabs) → audio buffer → playback
```
- Higher latency (~4–6 seconds)
- Used by the `voice-demo.html` page
- Better voice quality from ElevenLabs
- Full context management through backend
- All external calls wrapped with p-retry (3x, exponential backoff)

### 6.3 Voice-Specific Behavior
- During active sets: responses limited to 1–2 sentences
- Between exercises: up to 3–4 sentences allowed
- Pain reported: AI stops immediately, acknowledges, suggests rest/skip/end
- "What's next?": AI announces next exercise from plan
- "How do I do this?": AI explains from exercise instructions_text
- "Done"/"Finished": AI acknowledges set, prompts next
- "Skip": AI moves on without judgment
- Ambiguous command: AI asks brief clarifying question
- Low confidence transcription: "Sorry, didn't catch that — could you repeat?"

### Edge Cases
- **Gemini WebSocket drops**: Server closes client connection with reason
- **Microphone permission denied**: Falls back to text input
- **ElevenLabs fails** (Option B): Returns text only, notifies voice unavailable
- **Deepgram fails** (Option B): Retries once, then prompts "try again or use text"
- **User speaks while AI is speaking**: Gemini handles interruption natively (Option A)

---

## 7. Progression Logic

### 7.1 Tracking
```
ExerciseProgression document per user per exercise:
- history: last 10 sessions (reps achieved, feedback, skipped)
- current_prescription: { sets, rep_min, rep_max }
- progression_state: stable | ready_to_progress | deload_candidate
- consecutive_top_completions: number
- consecutive_skips_or_hard: number
```

### 7.2 Progression Trigger
- User completes ALL sets at top of rep range for 2 consecutive sessions
- → If rep_max < 15: increase rep_min and rep_max by 1
- → If rep_max ≥ 15: add 1 set instead
- → Awards 20 XP per progression milestone
- → AI suggests "consider slightly heavier next time" (no specific weight)

### 7.3 Deload Trigger
- User skips exercise 2+ times OR marks "felt hard" 2+ times consecutively
- → Exercise marked as `deload_candidate`
- → Deprioritized in future bundles, substitution group alternative preferred

### 7.4 Fast-Track
- "Felt easy" feedback → sets `consecutive_top_completions` to at least 1
- Next session at top range → instant progression (1 session instead of 2)

### Edge Cases
- **Exercise substituted between sessions**: Tracked by substitution_group, not just exercise_id
- **Pain on exercise**: Treated as skip for progression purposes
- **First ever session for an exercise**: Creates new ExerciseProgression record

---

## 8. Gamification

### 8.1 XP System
| Event | XP |
|-------|-----|
| Full workout completed | 50 |
| Partial workout (≥50%) | 25 |
| Abandoned (<50%) | 0 |
| Progression milestone | 20 (per milestone) |
| 7-day streak | 100 bonus |
| 30-day streak | 500 bonus |
| First workout ever | 30 (one-time) |
| Onboarding complete | 15 (one-time) |
| Daily check-in | 10 |

**Levels:** Level N requires N × 200 XP (escalating: L1=0-199, L2=200-599, L3=600-1199...)

### 8.2 Streaks (Grace-Day Model)
- Consecutive workout days increment streak
- **Grace day**: Missing 1 scheduled day does NOT break streak (1 grace per week)
- Missing 2+ days (or grace already used): streak resets to 1
- Stores: current_streak, longest_streak, grace_days_used_this_week, last_workout_date

### 8.3 Badges
| Badge | Criteria |
|-------|----------|
| First Step | Complete first workout |
| Consistency Starter | 3 workouts in 7 days |
| Week Warrior | 7-day streak |
| Momentum | 30-day streak |
| Comeback | Return after 7+ day gap |
| Leveling Up | First progression milestone triggered |
| Goal Getter | 10 workouts in goal category |

Evaluated after each session end. Only newly earned badges returned.

### 8.4 Daily Check-In
```
Client → POST /api/daily-checkin { energy_level, soreness[] }
```
- Collects: energy (low/medium/high), soreness (body_area + severity)
- Awards 10 XP (once per day, duplicate blocked with 409)
- Soreness data informs future workout selection in Rules Engine
- Only initiated if talkativeness ≥ balanced

---

## 9. Dashboard
```
Client → GET /api/dashboard → Server
```
Returns aggregated view:
- **Greeting**: Personalized based on name + streak
- **Today's workout**: ready (bundle available) | in_progress | completed | no_plan
- **Streak**: current + longest
- **XP/Level**: total, current level, progress to next
- **Badges**: earned + locked (with earned_at timestamps)
- **Weekly progress**: workouts completed vs planned, calories burned
- **Recent history**: last 5 sessions (title, duration, status, XP)

---

## 10. AI Companion Behavior

### 10.1 What It Does
- Explains exercises using instructions_text from library
- Motivates with persona-adapted messaging
- Answers questions about form, plan, progress
- Provides post-workout summaries
- Celebrates streaks, badges, personal bests

### 10.2 What It NEVER Does
- Invents exercises not in the current plan
- Prescribes specific weights (kg/lbs)
- Provides medical diagnoses or treatment advice
- Encourages pushing through reported pain
- Uses appearance-based language about body

### 10.3 Tone Adaptation by Persona
- `complete_beginner`: Extra encouragement, explain terms, non-intimidating
- `regular_gym_goer`: Peer-like, skip basics, focus on performance
- `weight_loss_seeker`: Focus on energy/strength, never mention weight/appearance
- `office_professional`: Mindful of time, reference posture/desk tightness
- `injury_recovery_user`: Reassuring, remind safe ranges, medical disclaimer weekly
- `ai_companion_seeker`: More conversational, show personality, ask follow-ups
- `inconsistent_enthusiast`: Celebrate showing up, focus on momentum not perfection

### 10.4 Safety Guardrails
- Pain → stop, acknowledge, suggest rest, offer skip/end
- Medical question → decline, direct to healthcare professional
- Weight prescription → always say "a weight that feels manageable"
- Response validation → backend strips any weight numbers that slip through (regex)

---

## 11. Progress Tracking
```
GET /api/progress/history — Paginated session history
GET /api/progress/weekly — This week vs last week (sessions, sets, reps, XP)
GET /api/progress/goal — Goal progress (total workouts, per-week avg, streak)
GET /api/progress/insights — Simple trend observations
```

Insights generated:
- Consistency comparison (this week vs last)
- Streak status messages
- Progression proximity ("close to progressing on X exercises")
- Milestone acknowledgments (10, 25, 50, 100 workouts)

---

## 12. Data Flow Summary

```
User Signs In
    │
    ▼
Onboarding (profile + metrics + persona) ──→ 15 XP
    │
    ▼
Generate Bundles (Rules Engine: Filter → Category → Persona → Assembly)
    │
    ▼
User Selects Bundle
    │
    ▼
Start Session ──→ State Machine begins
    │
    ├─── Voice Live: Client ↔ Server Proxy ↔ Gemini (real-time audio)
    │    └─── Server intercepts: persists turns, detects actions
    │
    ├─── Text Chat: Client → /api/companion/message → Gemini → response
    │
    ├─── Set Complete → DB updated → progression tracked
    ├─── Skip → DB updated → deload counter incremented
    ├─── Pain → DB updated → event recorded → AI stops
    │
    ▼
End Session
    ├─── Completion calculated (full/partial/abandoned)
    ├─── XP awarded (base + bonuses)
    ├─── Streak updated (grace-day model)
    ├─── Progression evaluated (rep increases / deloads)
    ├─── Badges evaluated (7 badge types)
    └─── Dashboard refreshed
```

---

## 13. API Endpoint Reference

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | /api/auth/guest | No | Create guest account |
| POST | /api/auth/google | Yes | Register/retrieve Google user |
| POST | /api/auth/upgrade | Yes | Upgrade guest to full account |
| GET | /api/profile | Yes | Get user profile |
| PUT | /api/profile | Yes | Update profile |
| POST | /api/personalize | Yes | Run metrics + persona assignment |
| POST | /api/bundles/generate | Yes | Generate bundles via Rules Engine |
| GET | /api/bundles/active | Yes | Get active bundle set |
| POST | /api/session/start | Yes | Start workout session |
| PUT | /api/session/:id/exercise | Yes | Update exercise (complete/skip/pain) |
| POST | /api/session/:id/end | Yes | End session (XP/streak/badges) |
| POST | /api/session/:id/pause | Yes | Pause session |
| GET | /api/session/active | Yes | Get resumable session |
| GET | /api/session/voice-context | Yes | Get system prompt for voice |
| GET | /api/session/voice-context/demo | No | Demo voice context |
| POST | /api/companion/message | Yes | Text chat with AI |
| POST | /api/stt/transcribe | Yes | Speech-to-text (Deepgram) |
| POST | /api/tts/stream | Yes | Text-to-speech (ElevenLabs) |
| GET | /api/exercises | No | List/filter exercise library |
| GET | /api/exercises/:id | No | Get exercise details |
| POST | /api/daily-checkin | Yes | Submit daily check-in |
| GET | /api/daily-checkin/today | Yes | Get today's check-in |
| GET | /api/dashboard | Yes | Aggregated dashboard data |
| GET | /api/progress/history | Yes | Session history |
| GET | /api/progress/weekly | Yes | Weekly stats |
| GET | /api/progress/goal | Yes | Goal progress |
| GET | /api/progress/insights | Yes | Trend observations |
| WS | /ws/voice-live | Token param | Voice live proxy (Gemini) |
| GET | /health | No | Health check |

---

*Document generated: June 2026*
