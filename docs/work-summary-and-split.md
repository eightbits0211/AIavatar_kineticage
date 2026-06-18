# KineticAge — Work Summary & Team Split

## Project Overview

**Product:** KineticAge — AI-Powered Fitness Companion  
**Target MVP Demo:** 17 July 2026  
**Tech Stack:** React Native (Expo) + Node.js/Express + MongoDB Atlas + Firebase Auth + Claude API + Deepgram STT + ElevenLabs TTS  
**Architecture:** Deterministic Rules Engine (safe workout generation) + AI Companion (explains, motivates, coaches)

---

## MVP Scope (from Product Backlog)

| Sprints | Epics | Features | User Stories | MoSCoW Must-Haves |
|---------|-------|----------|--------------|-------------------|
| 5 | 10 | 34 | 34 | 25 |

### Sprint Breakdown (Original Plan)

| Sprint | Theme | # Stories |
|--------|-------|-----------|
| 1 | Foundation: Auth, Onboarding, Health Metrics | 6 |
| 2 | Personalization: Personas + Workout Recommendation Engine | 6 |
| 3 | Workout Session + AI Avatar Foundation | 8 |
| 4 | Gamification + Dashboard | 8 |
| 5 | Progress Tracking, Remaining Dashboard Widgets & Hardening | 6 |

---

## Part 1: Detailed Summary of All Work Completed (by Roshini)

### Sprint 1: Foundation — Authentication, Onboarding, Health Metrics

**Sprint Goal:** A new user can sign in (Google or Guest), complete onboarding, and see their calculated health metrics.  
**Status: ~70% backend complete, ~5% mobile complete**

#### Completed ✅

| Item | File(s) | Notes |
|------|---------|-------|
| Firebase Auth middleware (JWT verification) | `server/src/middleware/auth.ts` | Verifies Firebase tokens on all protected routes |
| Auth routes: Guest login, Google login, Account upgrade | `server/src/routes/auth.ts` | POST /api/auth/guest, /api/auth/google, /api/auth/upgrade |
| User model (comprehensive) | `server/src/models/User.ts` | Includes all fields: physical attributes, goals, equipment, injuries, preferences, persona_tags, calculated_metrics, gamification, pain_history, companion_preferences |
| Profile routes (GET, PUT, CREATE) | `server/src/routes/profile.ts` | GET/PUT /api/profile + POST /api/profile/create; auto-recalculates metrics and personas on relevant field updates |
| Personalization endpoint | `server/src/routes/personalize.ts` | POST /api/personalize — calculates BMI/BMR/TDEE/MHR/Target Zone, assigns persona tags, marks onboarding complete, awards 15 XP |
| Persona service — full rules-based assignment | `server/src/services/persona.ts` | All 8 personas implemented with documented rules; calculateMetrics() with Mifflin-St Jeor, activity multipliers, BMI categories; evaluateInconsistentEnthusiast() for behavioral persona |
| Rate limiting middleware | `server/src/middleware/rateLimit.ts` | Applied globally |
| Database connection config | `server/src/config/db.ts`, `env.ts` | MongoDB Atlas connection + environment variable management |

#### Not Yet Done ❌

- Onboarding screens on mobile (guided conversation flow, validation, progress indicator)
- Firebase Auth integration on mobile (Google sign-in, guest mode, token management)
- Health Metrics summary screen (display BMI, TDEE, MHR, Training Zone with disclaimers)
- Navigation setup on mobile

---

### Sprint 2: Personalization Core — Personas + Workout Recommendation Engine

**Sprint Goal:** A user is classified into personas and receives 3-4 personalized workout options with one recommended.  
**Status: ~90% backend complete, 0% mobile UI**

#### Completed ✅

| Item | File(s) | Notes |
|------|---------|-------|
| Complete 4-stage Rules Engine pipeline | `server/src/services/rulesEngine/index.ts` | Orchestrates all stages; loads exercises from MongoDB; handles fallbacks when too few exercises pass filters |
| Stage 1: Filter | `server/src/services/rulesEngine/filterStage.ts` | Filters by equipment, location, injuries; priority: Injury > Location > Equipment; stats tracking |
| Stage 2: Category | `server/src/services/rulesEngine/categoryStage.ts` | Goal-specific set/rep/rest rules (Strength: 3-6 reps/90-180s, Hypertrophy: 8-12/60-90s, Mobility: time-based/15-30s, General: 8-12/45-60s, Weight Loss: 12-20/15-30s); compound/isolation classification |
| Stage 3: Persona Modifier | `server/src/services/rulesEngine/personaModifier.ts` | Beginner volume reduction (-1 set, prefer beginner exercises); Office Professional posture exercise addition; Injury Recovery rehab mobility addition |
| Stage 4: Bundle Assembly | `server/src/services/rulesEngine/bundleAssembly.ts` | 3-4 bundles with focus differentiation (Push/Pull/Legs/Full Body); exercise count by duration (15min=3-4, 30min=5-6, 45min=6-8, 60min=8-10); scoring for is_recommended based on muscle group rotation; substitution group variety; calorie estimation |
| Bundle routes | `server/src/routes/bundles.ts` | POST /api/bundles/generate (full pipeline + AI rationale + store in MongoDB); GET /api/bundles/active; deactivates previous bundles; handles energy_level and available_time overrides for regeneration |
| Bundle model | `server/src/models/Bundle.ts` | Full schema with exercises, rationale, focus, generation_context, set_id, active flag |
| Exercise model | `server/src/models/Exercise.ts` | Full schema: category_tags, muscle_groups (primary/secondary), equipment_required, location_compatible, contraindications, substitution_group, default_set_rep_range per category, difficulty_level |
| Exercise seed data (80+ exercises) | `server/seeds/exercises.json`, `exercises-part2.json`, `exercises-part3.json` | Trainer-approved exercises covering all categories, equipment, locations |
| Seed script | `server/seeds/seed.ts` | Populates MongoDB with exercise library |
| AI service (Groq/Llama with retry) | `server/src/services/claude.ts` | sendCompanionMessage() with p-retry (3x exponential backoff); action_intent parsing; safety weight-stripping layer |
| AI rationale generation for bundles | `server/src/routes/bundles.ts` | Non-blocking — if AI fails, uses generic fallback rationale |

#### Not Yet Done ❌

- Bundle selection UI on mobile (3-4 cards, recommended highlighted, exercise detail view)
- Voice/text onboarding input (Nice-to-Have per MoSCoW)

---

### Sprint 3: Workout Session + AI Avatar Foundation

**Sprint Goal:** A user can complete a guided workout session with timers and pause/resume, while interacting with the AI Avatar via voice and text.  
**Status: ~30% backend complete, ~10% mobile complete**

#### Completed ✅

| Item | File(s) | Notes |
|------|---------|-------|
| Session model (full schema) | `server/src/models/Session.ts` | Exercises with statuses (completed/skipped/pain_stopped/in_progress/pending), per-set tracking (target reps, actual reps, completed_at), pain_events, xp_awarded, progression_flags |
| SessionTurn model | `server/src/models/SessionTurn.ts` | Conversation turns with input_mode (voice/text), timestamps |
| AI prompt system — base personality | `server/src/prompts/basePersonality.ts` | "Kira" companion identity; strict guardrails (never invents exercises, never prescribes weights, never gives medical advice); tone rules; pain handling; response format rules |
| AI prompt system — buildPrompt (4-layer) | `server/src/prompts/buildPrompt.ts` | Layer 1: Base personality (static) → Layer 2: User context (per-user: name, age, goal, personas, injuries, preferences with tone adjustments per persona tag) → Layer 3: Session context (per-turn: bundle, exercise, set, reps, rest) → Layer 4: History context (recent session summaries) |
| Session state machine store (Zustand) | `mobile/src/stores/sessionStore.ts` | Full state machine: idle → session_starting → exercise_intro → set_active → set_complete → check_in → rest → session_summary → idle; actions: startSession, nextExercise, nextSet, completeSet, endSession, reset |
| Chat store (Zustand) | `mobile/src/stores/chatStore.ts` | Messages array (role, content, input_mode, timestamp), addMessage, setLoading, clearMessages |
| ExerciseProgression model | `server/src/models/ExerciseProgression.ts` | Per-exercise tracking: history (reps achieved, feedback, skipped), current_prescription, progression_state (stable/ready_to_progress/deload_candidate), consecutive counters |

#### Not Yet Done ❌

- Session routes (POST /api/session/start, PUT /api/session/:id/exercise, POST /api/session/:id/end)
- Session resume logic (return within 30 min → offer to resume)
- Companion/Chat route (POST /api/companion/message)
- Voice pipeline — Deepgram STT service + route
- Voice pipeline — ElevenLabs TTS service + route
- Progression service logic (model exists, no evaluation service)
- Workout session screen on mobile (exercise display, set tracking, rest timer, pause/resume, progress indicator)
- Chat UI on mobile (persistent, accessible from any screen)
- Voice recording/playback hooks on mobile (useVoiceInput, VoiceButton, useAudioPlayback)
- Adjustable talkativeness UI (settings screen)

---

### Sprint 4: Gamification + Dashboard

**Sprint Goal:** A user earns XP and streaks for their workouts and sees this reflected on a complete dashboard, alongside AI motivational messaging.  
**Status: ~15% backend complete, ~5% mobile complete**

#### Completed ✅

| Item | File(s) | Notes |
|------|---------|-------|
| Gamification fields on User model | `server/src/models/User.ts` | total_xp, level, current_streak, longest_streak, last_workout_date, grace_days_used_this_week, badges array |
| DailyCheckin model | `server/src/models/DailyCheckin.ts` | Energy level, soreness, timestamps |
| Gamification store (Zustand) | `mobile/src/stores/gamificationStore.ts` | XP, level (500 XP per level), streak tracking, setGamificationData, addXp, incrementStreak, resetStreak |
| Onboarding XP award (15 XP) | `server/src/routes/personalize.ts` | One-time award on first personalization |

#### Not Yet Done ❌

- Gamification service (XP award rules: full=50, partial=25, milestone=20, streak 7-day=100, 30-day=500, first workout=30, onboarding=15)
- Streak service (grace-day model — missing 1 scheduled day doesn't break streak if workout next day)
- Badge evaluation service (7 MVP badges: First Step, Consistency Starter, Week Warrior, Momentum, Comeback, Leveling Up, Goal Getter)
- Dashboard route (GET /api/dashboard — today's workout, XP, streak, recent history, weekly summary)
- Daily check-in route (POST /api/daily-checkin — energy, soreness → feeds rules engine, awards 10 XP)
- Today's Workout Widget (UI)
- XP display + level progress bar (UI)
- Streaks display (UI)
- Motivational prompts system (context-aware messaging tied to real activity)
- Dashboard screen (mobile)
- Level-up animation (UI)
- Badges grid (earned + locked) (UI)

---

### Sprint 5: Progress Tracking, Remaining Dashboard Widgets & Hardening

**Sprint Goal:** A user can review their full history and goal progress; remaining dashboard widgets are complete; the MVP is stabilized for release.  
**Status: 0% — Nothing implemented**

#### Not Yet Done ❌

- Completed Workouts Log route + UI (chronological list: date, bundle name, duration, completion status)
- Goal Progress Tracking route + UI (progress toward stated fitness goal)
- Workout History Summary on dashboard (recent 3-5 workouts)
- Progress Overview on dashboard (workouts this week vs. planned)
- Historical Data View (weekly/monthly aggregation toggle)
- Fitness Improvement Insights (trend insights — consistency, volume over time)
- Switch from Groq to Claude API (before demo)
- Prompt tuning (10+ test conversations per persona, iterate for natural flow)
- Error handling hardening (verify all retry layers, graceful failures)
- Real-device testing (iOS + Android on mobile data)
- UI polish (animations, loading states, transitions, offline fallback)
- Demo data/seed accounts

---

### Additional Work Completed (Cross-Sprint)

| Item | File(s) |
|------|---------|
| Project documentation — README | `README.md` |
| Development workflow & Git strategy | `development-workflow.md` |
| Tech stack research document | `ai-trainer-avatar-tech-stack-research.md` |
| Presentation (Marp slides) | `presentation.md` |
| MVP Product Backlog (10 Epics, 34 Features, 34 User Stories, 5 Sprints, MoSCoW) | `MVP docs/` |
| Kiro spec (requirements document) | `.kiro/specs/ai-companion-workout/requirements.md` |
| Kiro steering files | `.kiro/steering/` |
| Mobile app scaffolding (Expo + TypeScript) | `mobile/` |
| Navigation dependencies installed | `mobile/package.json` |
| Zustand state stores (user, session, chat, gamification) | `mobile/src/stores/` |
| API service layer (typed fetch wrapper with auth token) | `mobile/src/services/api.ts` |
| Shared TypeScript types | `shared/types/` |
| Folder structure (screens, components, hooks, navigation, theme, utils) | `mobile/src/` |
| Audio dependencies (expo-av, expo-audio) | `mobile/package.json` |
| Server entry point with route registration | `server/src/index.ts` |
| Models index (all models exported) | `server/src/models/index.ts` |
| Environment config | `server/.env.example`, `server/src/config/env.ts` |
| Docs folder (switching-to-claude guide) | `docs/switching-to-claude.md` |

---

## Part 2: Fair Work Split — Roshini + Teammate

### Rationale

- **Roshini** continues on backend/services — the Rules Engine, AI service, session management, gamification logic, and progression are all backend systems she's been building.
- **Teammate** takes ownership of the entire mobile UI + voice pipeline integration — a clean, self-contained track that consumes Roshini's APIs.
- The two tracks intersect only at the API boundary (defined in `shared/types/`).

---

### Roshini — Backend & Services (Server-side)

#### Sprint 3 Work (Remaining)

| Task | User Stories Covered | Priority | Effort | Details |
|------|---------------------|----------|--------|---------|
| Session routes | US-07.1.1, US-07.2.1, US-07.4.1, US-07.5.1 | Must-Have | Large | POST /api/session/start (create session from bundle), PUT /api/session/:id/exercise (update exercise status, set completion, feedback), POST /api/session/:id/end (mark full/partial/abandoned, calculate XP), session resume logic (offer resume within 30 min) |
| Companion/Chat route | US-06.3.1, US-11 (Text Chat) | Must-Have | Medium | POST /api/companion/message — builds full system prompt using buildPrompt(), includes session context, conversation history, action_intent parsing for structured actions (skip, next, end) |
| Progression service | US-08 (Progression Logic) | Must-Have | Medium | Evaluate per-exercise history after each session; 2 consecutive top-of-range → increase reps or add set; 2+ skips/hard → deload + substitute from substitution_group; wire progression_flags into session records and next bundle generation |
| Deepgram STT service + route | US-06.1.1 (Voice Coaching) | Must-Have | Medium | server/src/services/deepgram.ts — audio buffer → transcription; POST /api/stt/transcribe; retry with 2s delay on failure |
| ElevenLabs TTS service + route | US-06.1.1, US-10 (Voice Output) | Must-Have | Medium | server/src/services/elevenlabs.ts — text → streaming audio; POST /api/tts/stream (chunked response); consistent voice_id; retry once on failure |

#### Sprint 4 Work

| Task | User Stories Covered | Priority | Effort | Details |
|------|---------------------|----------|--------|---------|
| Gamification service | US-09.1.1 (XP), US-09.2.1 (Levels), US-09.3.1 (Streaks), US-09.4.1 (Achievements) | Must-Have | Medium | XP award rules (full=50, partial=25, milestone=20, streak 7-day=100, 30-day=500, first workout=30); Level N = N×200 XP; Streak grace-day model (1 grace day/week); Badge evaluation (7 MVP badges: First Step, Consistency Starter, Week Warrior, Momentum, Comeback, Leveling Up, Goal Getter) |
| Daily check-in route | US-19 (Daily Check-Ins) | Medium | Small | POST /api/daily-checkin — collect energy_level + soreness; store in DailyCheckin collection; feed soreness into Rules Engine's next bundle filter; award 10 XP; respect talkativeness setting (no check-in if Minimal) |
| Dashboard route | US-08.1.1, US-08.2.1, US-08.3.1, US-08.4.1, US-08.5.1 | Must-Have | Medium | GET /api/dashboard — aggregates: today's active bundle (recommended), XP total + level + progress to next, current/longest streak, recent 5 sessions (date, name, duration, status), weekly summary (completed vs planned), estimated calories |
| Motivational prompts service | US-06.2.1 | Medium | Medium | Template-driven + AI-personalized messaging tied to real events (streak milestones, personal bests, returning after break, workout counts); respect talkativeness levels; "Comeback" framing for streak breaks |

#### Sprint 5 Work

| Task | User Stories Covered | Priority | Effort | Details |
|------|---------------------|----------|--------|---------|
| Progress routes | US-10.1.1, US-10.2.1, US-10.3.1, US-10.4.1 | Medium | Medium | GET /api/progress/history (paginated workout log); GET /api/progress/weekly (weekly aggregation); GET /api/progress/goal (progress toward stated fitness goal); GET /api/progress/insights (trend data — consistency %, volume changes) |
| Switch to Claude API | — | Must-Have | Small | Replace Groq SDK with Anthropic SDK in claude.ts; update model to claude-sonnet-4; adjust message format; test with existing prompts |
| Prompt tuning | US-12 (AI Companion Behavior), US-21 (Personality) | Must-Have | Medium | Run 10+ test conversations across personas (Beginner, Gym-Goer, Weight Loss, Injury Recovery, Office Professional); verify guardrails hold (no weights, no exercises invented, no medical advice); iterate tone per persona; test pain handling flow |
| Error handling hardening | US-20 (Data Persistence) | Must-Have | Small | Verify p-retry on all external calls (Claude, Deepgram, ElevenLabs); structured error responses indicating which service is unavailable; graceful degradation (voice fails → text; AI fails → generic fallback) |
| Demo data & seed accounts | — | Must-Have | Small | Create 2-3 demo user profiles with pre-loaded session history, progression data, and gamification state for demo walkthrough |

---

### Teammate — Mobile UI & Voice Pipeline (Client-side)

#### Sprint 1 Work (Remaining Mobile)

| Task | User Stories Covered | Priority | Effort | Details |
|------|---------------------|----------|--------|---------|
| Navigation setup | All | Must-Have | Medium | Configure React Navigation: AuthStack (Login, Onboarding), MainTabs (Dashboard, Library, Session, Progress, Profile); conditional routing based on auth state and onboarding status |
| Firebase Auth on mobile | US-01.1.1 (Google Login), US-01.2.1 (Guest Login) | Must-Have | Medium | Google sign-in flow, guest sign-in via POST /api/auth/guest, token storage, auth state management, auto-login on app reopen |
| Onboarding screens | US-02.1.1 (Profile Data Collection) | Must-Have | Large | 10-step guided conversation flow: age, height, weight, gender, fitness goal, activity level, workout location, equipment (multi-select), injuries (multi-select + free text), workout duration, prior program experience; client-side validation (age 16-100, plausible ranges); progress indicator ("Step 4 of 10"); save progress on exit; resume from last step; companion preferences (talkativeness, in-session verbosity) |
| Health Metrics summary screen | US-03.1.1, US-03.2.1, US-03.3.1 | Must-Have | Small | Display BMI (with WHO category), TDEE (as range ±5%), MHR (220-age), Target Training Zone (60-80% MHR); disclaimer text ("estimate, not medical advice"); call POST /api/personalize after onboarding submit |

#### Sprint 2 Work (Remaining Mobile)

| Task | User Stories Covered | Priority | Effort | Details |
|------|---------------------|----------|--------|---------|
| Bundle selection screen | US-05.1.1, US-05.2.1, US-05.3.1 | Must-Have | Medium | Display 3-4 bundle cards; recommended bundle highlighted at top; each card shows: title, duration, calorie range, exercise count, AI rationale; tap to expand full exercise list with sets/reps/rest; "Start Workout" button; "Generate New Options" if all dismissed (asks about available time/energy); call POST /api/bundles/generate and GET /api/bundles/active |

#### Sprint 3 Work (Remaining Mobile)

| Task | User Stories Covered | Priority | Effort | Details |
|------|---------------------|----------|--------|---------|
| Workout session screen | US-07.1.1, US-07.2.1, US-07.3.1, US-07.4.1, US-07.5.1 | Must-Have | Large | Exercise instructions display (name, sets/reps, step-by-step instructions, expanded detail on tap); set tracking ("Done" button per set, actual reps input); rest timer (countdown between sets, auto-start after set complete); progress indicator (position in total exercises); pause/resume (preserves timer state); completion flow (mark exercise: complete/skipped/felt_hard/felt_easy); post-workout summary screen; integrates with sessionStore state machine |
| Chat UI | US-06.3.1 (Interactive Conversation), US-11 (Text Chat) | Must-Have | Medium | Persistent chat interface accessible from any screen (floating button or tab); message list with clear user/companion distinction (min 16sp font); text input; loading indicator; voice/text seamless switching without context loss; connects to POST /api/companion/message |
| Voice pipeline (mobile side) | US-06.1.1 (Voice Coaching), US-09 (Voice Input), US-10 (Voice Output) | Must-Have | Large | useVoiceInput hook (expo-av: press-to-talk recording, send audio buffer to POST /api/stt/transcribe); VoiceButton component (tap to record, visual feedback, release to send); useAudioPlayback hook (receive streaming audio from POST /api/tts/stream, play immediately); interrupt playback when user initiates new input; text displayed simultaneously with voice; fallback to text-only if voice fails |
| Adjustable talkativeness UI | US-06.4.1 | Must-Have | Small | Settings screen: Talkativeness (Minimal/Balanced/High) + In-session verbosity (Quiet/Standard/Detailed); persists to user profile via PUT /api/profile |

#### Sprint 4 Work (Remaining Mobile)

| Task | User Stories Covered | Priority | Effort | Details |
|------|---------------------|----------|--------|---------|
| Dashboard screen | US-08.1.1, US-08.2.1, US-08.3.1 | Must-Have | Medium | Today's Workout Widget (recommended bundle with "Start" CTA; reflects completed status if done); XP display (total + progress bar toward next level); Streak display (current + longest); pulls from GET /api/dashboard; cache client-side, refresh on pull-to-refresh or after session |
| Gamification UI | US-09.1.1, US-09.2.1, US-09.3.1, US-09.4.1 | Medium | Medium | XP bar component (animated fill); level-up celebration (visual animation + companion message); streak badge component; badges grid (earned with "new" marker + locked with criteria shown); level display |
| Daily check-in UI | US-19 (Daily Check-Ins) | Medium | Small | Brief check-in modal on app open (non-workout day, talkativeness ≥ Balanced): energy level selector + soreness selector; submit to POST /api/daily-checkin; award 10 XP with visual feedback |
| Motivational prompts display | US-06.2.1 | Medium | Small | Display proactive messages from companion (post-workout summary, welcome back, streak celebration); respect talkativeness setting; "Comeback" framing for streak recovery |

#### Sprint 5 Work (Remaining Mobile)

| Task | User Stories Covered | Priority | Effort | Details |
|------|---------------------|----------|--------|---------|
| Progress screens | US-10.1.1, US-10.2.1, US-10.3.1, US-10.4.1 | Medium | Medium | Completed Workouts Log (chronological list: date, bundle name, duration, status; tap for full breakdown; empty state); Goal Progress view (goal-relevant indicator — consistency rate, sessions in-category); Historical Data View (weekly/monthly toggle; workouts completed + total time/calories per period); Fitness Insights (trend cards — consistency %, volume changes) |
| Workout History Summary on dashboard | US-08.4.1 | Medium | Small | Condensed list of recent 3-5 workouts on dashboard; tap navigates to full history |
| Progress Overview on dashboard | US-08.5.1 | Medium | Small | High-level progress widget (workouts this week vs planned); tap navigates to Goal Progress detail |
| UI polish & hardening | All | Must-Have | Medium | Loading states (skeleton screens); animations (transitions, level-up, badge earn); error states (network drops, API failures — user-facing messages); offline fallback (cache current bundle locally); real-device testing (iOS + Android on mobile data) |
| Exercise Library browse UI | US-06 (Exercise Library) | Medium | Small | ExerciseListScreen (browse by category, search); ExerciseDetailScreen (instructions, muscles, difficulty, image) |

---

## Part 3: Timeline — Aligned with Sprint Plan

The original sprint plan sequences work by dependency order. With 4 weeks until the July 17 demo, and Sprints 1-2 backend mostly done, the remaining work maps as follows:

### Week 1 (Jun 18–24) — Completing Sprint 1 (Mobile) + Sprint 3 (Backend)

| Roshini (Backend) | Teammate (Mobile) |
|---|---|
| Session routes (start, update exercise, end, resume) | Navigation setup (AuthStack + MainTabs) |
| Companion/Chat route (POST /api/companion/message) | Firebase Auth integration (Google + Guest) |
| Progression service (evaluate history, trigger progress/deload) | Onboarding screens (10-step flow + validation) |
| | Health Metrics summary screen |

**Why:** Teammate needs auth + onboarding first (Sprint 1 mobile). Roshini builds the session backend (Sprint 3) so it's ready when teammate builds session UI next week.

---

### Week 2 (Jun 25–Jul 1) — Sprint 2 (Mobile) + Sprint 3 (Mobile + Backend Voice) + Sprint 4 (Backend)

| Roshini (Backend) | Teammate (Mobile) |
|---|---|
| Deepgram STT service + route | Bundle selection screen (Sprint 2 mobile) |
| ElevenLabs TTS service + route | Workout session screen (Sprint 3 mobile) |
| Gamification service (XP, streaks, badges, grace-day) | Chat UI (persistent, accessible from any screen) |
| Daily check-in route | |

**Why:** Voice services (Roshini) must be ready before mobile voice pipeline connects (Week 3). Gamification backend needed before dashboard UI (Week 3). Teammate catches up on Sprint 2 mobile (bundle selection) and Sprint 3 mobile (session + chat).

---

### Week 3 (Jul 2–8) — Sprint 3 (Voice Integration) + Sprint 4 (Dashboard + Gamification UI)

| Roshini (Backend) | Teammate (Mobile) |
|---|---|
| Dashboard route (GET /api/dashboard) | Voice pipeline — mobile hooks + connect to STT/TTS routes |
| Progress routes (history, weekly, goal, insights) | Dashboard screen (today's workout, XP, streak) |
| Motivational prompts service | Gamification UI (XP bar, level-up, badges grid) |
| Switch to Claude API | Daily check-in UI |
| | Adjustable talkativeness settings UI |

**Why:** Voice pipeline connects (teammate) once Deepgram/ElevenLabs routes (Roshini, Week 2) are ready. Dashboard UI (teammate) connects to dashboard route (Roshini, this week). Claude switch (Roshini) ensures AI quality for final testing.

---

### Week 4 (Jul 9–15) — Sprint 5 (Progress Tracking + Hardening)

| Roshini (Backend) | Teammate (Mobile) |
|---|---|
| Prompt tuning (10+ conversations per persona) | Progress screens (history log, goal progress, historical data) |
| Error handling hardening (retry verification, graceful failures) | Dashboard remaining widgets (history summary, progress overview) |
| Demo data & seed accounts | Exercise Library browse UI |
| Bug fixes | UI polish (animations, loading states, error states, offline fallback) |
| | Real-device testing (iOS + Android) |

**Why:** Final sprint focuses on quality — Roshini hardens the backend and tunes the AI personality, teammate completes remaining UI and polishes the experience.

---

### Jul 16–17 — Demo Prep

| Both |
|---|
| End-to-end testing of full demo flow |
| Bug fixes |
| Demo recording |
| Final prompt iteration if needed |

---

## Sprint Alignment Check

The timeline follows the original sprint dependency order:

| Original Sprint | Timeline Coverage | Notes |
|----------------|-------------------|-------|
| Sprint 1 (Auth, Onboarding, Metrics) | Week 1 (mobile) | Backend already done; mobile catches up |
| Sprint 2 (Personas, Recommendation Engine) | Week 2 (mobile) | Backend already done; bundle selection UI built |
| Sprint 3 (Session, AI Avatar) | Weeks 1-3 | Backend routes (Week 1), UI (Week 2), Voice pipeline (Week 3) |
| Sprint 4 (Gamification, Dashboard) | Weeks 2-3 | Backend service (Week 2), UI (Week 3) |
| Sprint 5 (Progress, Polish) | Week 4 | Both backend routes + mobile UI + hardening |

The dependency chain is respected:
- Auth + Onboarding (Week 1) → before Bundles UI (Week 2)
- Session backend (Week 1) → before Session UI (Week 2)
- Rules Engine (already done) → before Bundle Selection (Week 2)
- Gamification backend (Week 2) → before Dashboard UI (Week 3)
- Deepgram/ElevenLabs backend (Week 2) → before Voice pipeline mobile (Week 3)
- All features built → before Polish + Hardening (Week 4)

---

## Coordination Rules

1. **API contract is the handshake** — `shared/types/` defines the interface. If either person needs a new field, add it and notify the other.
2. **Merge to `dev` every 2 days minimum** — avoids divergence.
3. **Roshini writes the API, Teammate consumes it** — Teammate can mock endpoints until Roshini's routes are ready, then swap in real calls.
4. **Voice pipeline split:**
   - Roshini: `server/src/services/deepgram.ts`, `server/src/services/elevenlabs.ts` + their routes (`/api/stt/transcribe`, `/api/tts/stream`)
   - Teammate: `mobile/src/hooks/useVoiceInput.ts`, `mobile/src/hooks/useAudioPlayback.ts`, `mobile/src/components/VoiceButton.tsx`
5. **Feature branches per the git workflow** — `feature/session-routes`, `feature/onboarding-ui`, etc. Never push directly to `dev` or `main`.
6. **Test each service in isolation before connecting** — Deepgram alone, ElevenLabs alone, then full pipeline.

---

## Effort Summary

| Person | Must-Have Tasks | Medium Priority Tasks | Total Effort |
|--------|----------------|----------------------|--------------|
| Roshini | 10 tasks (5 Large/Medium Sprint 3, 3 Medium Sprint 4, 2 Small Sprint 5 + prompt tuning Medium) | 3 tasks | ~50% of remaining work |
| Teammate | 9 tasks (3 Large, 4 Medium Sprint 1-3, 2 Medium Sprint 4) | 5 tasks | ~50% of remaining work |

The split is approximately equal in effort, with Roshini handling the services/logic layer and Teammate handling the presentation/interaction layer.

---

*Document created: 18 June 2026*
