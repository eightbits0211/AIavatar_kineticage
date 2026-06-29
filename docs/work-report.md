# KineticAge — Work Report (Roshini Kotte)

**Date:** 29 June 2026
**Demo Deadline:** 17 July 2026
**Repository:** eightbits0211/AIavatar_kineticage

---

## 1. Project Overview

KineticAge is an AI-powered fitness companion that delivers personalized workout plans, voice and text coaching, motivation, accountability, and progress tracking. The product's core differentiator is the feeling of having a knowledgeable, supportive training partner available at any time.

**Tech Stack:** React Native (Expo) + Node.js/Express + MongoDB Atlas + Firebase Auth + Gemini AI + Deepgram STT + ElevenLabs TTS

---

## 2. Contribution Summary

| Metric | Value |
|--------|-------|
| Commits (non-merge) | 48 |
| Pull Requests authored & merged | 17 |
| Role | Full backend architecture, services, API design, documentation, project setup |

---

## 3. Completed Work — By Sprint

### Sprint 1: Authentication, Onboarding & Health Metrics

| # | Task | PR |
|---|------|-----|
| 1 | Project scaffolding (monorepo: mobile + server + shared types) | #1 |
| 2 | Documentation suite (PRD, tech stack research, workflow, steering files) | #1 |
| 3 | MVP Product Backlog (10 epics, 34 features, 34 stories, 5 sprints) | — |
| 4 | MongoDB Atlas connection + environment config | #2 |
| 5 | Firebase Auth middleware (JWT verification on every request) | #2 |
| 6 | User model (full schema: profile, metrics, gamification, preferences, pain history, weight log) | #2, #23 |
| 7 | Profile routes — GET, PUT, CREATE with auto-recalculation of metrics and personas | #2, #7 |
| 8 | Auth routes — Guest login (Firebase Anonymous), Google login, Account upgrade | #6 |
| 9 | Persona assignment service (8 persona rules + behavioral evaluation logic) | #3 |
| 10 | Personalization endpoint (BMI, BMR, TDEE, MHR, Target Zone + persona tags + 15 XP) | #3 |
| 11 | Rate limiting middleware (60 req/min per user) | #2 |

### Sprint 2: Personas & Workout Recommendation Engine

| # | Task | PR |
|---|------|-----|
| 1 | Rules Engine — Stage 1: Filter (equipment, location, injuries, MHR intensity zone, fitness level) | #4, #23 |
| 2 | Rules Engine — Stage 2: Category (goal-specific sets/reps/rest for 6 workout categories) | #4 |
| 3 | Rules Engine — Stage 3: Persona Modifier (beginner volume reduction, office posture, injury rehab) | #4 |
| 4 | Rules Engine — Stage 4: Bundle Assembly (3-4 bundles, scoring, muscle rotation, seeded PRNG) | #4, #23 |
| 5 | Rules Engine orchestrator (full 4-stage pipeline with fallbacks) | #4 |
| 6 | Bundle routes — POST /api/bundles/generate + GET /api/bundles/active | #5 |
| 7 | Bundle model (exercises, rationale, focus, generation context, set_id grouping) | #5 |
| 8 | Exercise model (contraindications, substitution groups, per-category defaults, intensity zones, workout phases, difficulty levels) | #3, #14, #17, #23 |
| 9 | Exercise seed data — 80 trainer-approved exercises with full metadata | #3, #14 |
| 10 | Enforced PRD bundle sequence (Warm-up → Primary → Primary → BMI → Core → Cardio → Cool-down) | #17 |
| 11 | Exercise browse routes — GET /api/exercises, GET /api/exercises/:id | #14 |
| 12 | AI rationale generation for bundles (non-blocking, graceful fallback if AI down) | #5 |
| 13 | MHR intensity zone filtering — safety gate excluding exercises above user's safe MHR zone | #23 |
| 14 | Fitness level filtering — beginner/intermediate/advanced exercise gating | #23 |
| 15 | Deterministic bundle generation — seeded PRNG for reproducible results | #23 |

### Sprint 3: Workout Session & AI Companion

| # | Task | PR |
|---|------|-----|
| 1 | Session model (exercises, sets, pain events, progression flags) | #9 |
| 2 | SessionTurn model (conversation tracking — voice/text, timestamps) | #9 |
| 3 | Session routes — start, exercise update, end, pause, resume | #9 |
| 4 | ExerciseProgression model (per-exercise tracking + progression state machine) | #9 |
| 5 | Progression service — evaluate history, trigger progress/deload/fast-track | #9 |
| 6 | Companion/Chat route — full prompt building with session context | #9 |
| 7 | AI personality prompt — "Kira" coach with 4-layer system (base, user, session, history) + guardrails | #9 |
| 8 | AI service — Gemini 2.5 Flash with p-retry, weight-stripping safety, markdown stripping for TTS | #14 |
| 9 | Deepgram STT service + POST /api/stt/transcribe route | #15 |
| 10 | ElevenLabs TTS service + POST /api/tts/stream route (audio streaming) | #15 |
| 11 | WebSocket voice live proxy (real-time STT → AI → TTS pipeline with Rules Engine context) | #20 |
| 12 | Voice onboarding service (server-side extraction from voice input) | #21 |
| 13 | Browser voice demo page for testing | #18 |

### Sprint 4: Gamification & Dashboard

| # | Task | PR |
|---|------|-----|
| 1 | Gamification service — XP rules, level formula, streak logic with grace-days, 7 badge definitions | #10 |
| 2 | Gamification integrated into session-end (auto-award XP + evaluate all badges) | #10 |
| 3 | Daily check-in route — POST /api/daily-checkin (energy + soreness logging, 10 XP award) | #10 |
| 4 | GET /api/daily-checkin/today (check if already submitted) | #10 |
| 5 | Dashboard route — GET /api/dashboard (today's workout, XP, streak, level, recent sessions, active bundles) | #11 |
| 6 | Comeback badge fix (daysSinceLastWorkout calculation) | #20 |

### Sprint 5: Progress Tracking & Hardening

| # | Task | PR |
|---|------|-----|
| 1 | GET /api/progress/history — paginated session history with exercise details | #12 |
| 2 | GET /api/progress/weekly — weekly/monthly activity aggregation with day-by-day breakdown | #12 |
| 3 | GET /api/progress/goal — goal tracking, consistency rate, sessions-per-week average | #12 |
| 4 | GET /api/progress/insights — automated trend observations and milestones | #12 |
| 5 | GET /api/progress/strength — per-exercise progression (start_reps, current_reps, change, overall %) | #23 |
| 6 | POST /api/progress/weight — log weight entry (dedupes same-day, updates current weight) | #23 |
| 7 | GET /api/progress/weight?range= — weight history with summary stats for charting | #23 |
| 8 | Switched AI from Groq/Llama to Gemini 2.5 Flash | #14 |
| 9 | Fixed progression_flags CastError bug | #16 |

### Documentation & Planning

| # | Task |
|---|------|
| 1 | System design document (full architecture, DB schema, API contracts, prompt architecture, scalability plan) |
| 2 | Complete user flow documentation |
| 3 | Tech stack research document (evaluated 6+ options per layer) |
| 4 | Development workflow guide |
| 5 | Team work split planning document |
| 6 | Kiro specs and steering files for AI-assisted development |
| 7 | Presentation slides |
| 8 | README with setup instructions and sprint plan |
| 9 | MVP Product Backlog spreadsheet (Epics, Features, User Stories, MoSCoW, Sprint 1-5, All Tasks) |

---

## 4. Backend Architecture Built

```
server/src/
├── config/
│   ├── db.ts                    # MongoDB Atlas connection
│   └── env.ts                   # Environment variable management
├── middleware/
│   ├── auth.ts                  # Firebase JWT verification
│   └── rateLimit.ts             # Per-user rate limiting (60/min)
├── models/
│   ├── User.ts                  # Profile + metrics + gamification + weight log
│   ├── Exercise.ts              # 80 exercises, intensity zones, phases, difficulty
│   ├── Bundle.ts                # Generated workout bundles
│   ├── Session.ts               # Workout sessions with state machine
│   ├── SessionTurn.ts           # Conversation history
│   ├── ExerciseProgression.ts   # Per-exercise tracking
│   ├── DailyCheckin.ts          # Daily energy + soreness
│   └── index.ts                 # Model exports
├── routes/
│   ├── auth.ts                  # Guest, Google, upgrade
│   ├── profile.ts               # GET/PUT/CREATE with auto-recalc
│   ├── personalize.ts           # Persona + metrics assignment
│   ├── bundles.ts               # Generate + get active bundles
│   ├── exercises.ts             # Browse exercise library
│   ├── session.ts               # Start, update, end, pause, resume
│   ├── companion.ts             # AI chat with full context
│   ├── stt.ts                   # Speech-to-text (Deepgram)
│   ├── tts.ts                   # Text-to-speech stream (ElevenLabs)
│   ├── voiceDemo.ts             # Browser voice demo
│   ├── voiceContext.ts          # Voice context for live proxy
│   ├── dashboard.ts             # Aggregated home screen data
│   ├── dailyCheckin.ts          # Daily check-in
│   └── progress.ts              # History, weekly, goal, insights, strength, weight
├── services/
│   ├── rulesEngine/
│   │   ├── filterStage.ts       # Equipment + location + injuries + MHR + fitness level
│   │   ├── categoryStage.ts     # Goal → set/rep/rest parameters
│   │   ├── personaModifier.ts   # Persona-based additions/adjustments
│   │   ├── bundleAssembly.ts    # 3-4 bundles with seeded PRNG
│   │   └── index.ts             # Pipeline orchestrator
│   ├── persona.ts               # 8 persona rules + metric formulas
│   ├── progression.ts           # Per-exercise progression evaluation
│   ├── gamification.ts          # XP, levels, streaks, 7 badges
│   ├── claude.ts                # AI companion (Gemini/Claude)
│   ├── deepgram.ts              # STT integration
│   ├── elevenlabs.ts            # TTS streaming
│   ├── voiceLiveProxy.ts        # WebSocket real-time voice
│   └── voiceOnboarding.ts       # Voice-based onboarding extraction
├── prompts/
│   └── basePersonality.ts       # Kin coach personality + guardrails
└── seeds/
    ├── exercises.json            # 20 exercises
    ├── exercises-part2.json      # 20 exercises
    ├── exercises-part3.json      # 40 exercises
    ├── seed.ts                   # Database seeder
    └── add-intensity-zones.ts    # Migration script
```

**Total API Endpoints Built: 25+**

---

## 5. API Endpoints Summary

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | /api/auth/guest | Create anonymous Firebase user |
| POST | /api/auth/google | Process Google sign-in, create/retrieve profile |
| POST | /api/auth/upgrade | Upgrade guest to full account |
| GET | /api/profile | Get user profile |
| PUT | /api/profile | Update profile (auto-recalculates metrics/personas) |
| POST | /api/profile/create | Create profile after signup |
| POST | /api/personalize | Run persona assignment + calculate all metrics |
| POST | /api/bundles/generate | Generate 3-4 exercise bundles via Rules Engine |
| GET | /api/bundles/active | Get current active bundle set |
| GET | /api/exercises | List exercises (with filters) |
| GET | /api/exercises/:id | Get exercise details |
| POST | /api/session/start | Start workout session from selected bundle |
| PUT | /api/session/:id/exercise | Update exercise status (complete/skip/feedback) |
| POST | /api/session/:id/end | End session, calculate XP, evaluate progression |
| POST | /api/session/:id/pause | Pause active session |
| GET | /api/session/active | Get current in-progress session |
| POST | /api/companion/message | Send message to AI companion |
| POST | /api/stt/transcribe | Speech-to-text (Deepgram) |
| POST | /api/tts/stream | Text-to-speech streaming (ElevenLabs) |
| GET | /api/dashboard | Aggregated home screen data |
| POST | /api/daily-checkin | Submit daily check-in (energy + soreness) |
| GET | /api/daily-checkin/today | Check today's submission |
| GET | /api/progress/history | Paginated session history |
| GET | /api/progress/weekly | Weekly/monthly activity aggregation |
| GET | /api/progress/goal | Goal tracking + consistency stats |
| GET | /api/progress/insights | Automated trend observations |
| GET | /api/progress/strength | Per-exercise strength progression |
| POST | /api/progress/weight | Log weight entry |
| GET | /api/progress/weight | Weight history + summary |

---

## 6. Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| Rules Engine is deterministic, AI never generates exercises | Safety — trainer-approved content only, predictable and explainable |
| 4-stage rules engine pipeline | Separation of concerns, each stage independently testable |
| MHR safety gating in filter stage | User safety — prevents high-intensity exercises for older/sedentary users |
| Seeded PRNG for optional determinism | Reproducible bundles for debugging, variety by default |
| Gemini 2.5 Flash for AI companion | Free tier for development, low latency, good quality |
| Firebase Auth (not custom JWT) | Quick setup, handles Google/Apple/Anonymous auth out of the box |
| MongoDB Atlas (not Postgres) | Flexible schema for rapid iteration, free tier available |
| Per-exercise progression tracking | Granular difficulty adjustment per the PRD requirements |
| Weight log on User model (not separate collection) | Simpler queries, fewer joins, data co-located with user |
| p-retry on all external APIs | Resilience against transient failures (Gemini, Deepgram, ElevenLabs) |
| AI weight-stripping in responses | Safety guardrail — AI never prescribes specific weight numbers |

---

## 7. Remaining Work (My Tasks Before Demo)

| # | Task | Priority | Effort | Notes |
|---|------|----------|--------|-------|
| 1 | Seed demo accounts (users with realistic history, XP, streaks, badges) | High | Medium | Need 2-3 personas with weeks of data |
| 2 | Prompt tuning — test Kira across all persona types, refine tone, ensure no markdown in voice | High | Medium | 10+ test conversations per persona |
| 3 | Error hardening — graceful fallbacks if Gemini/Deepgram/ElevenLabs is down | Medium | Medium | p-retry in place, need user-facing fallback messages |
| 4 | Weight logging prompt logic (when to ask user — tie to daily check-in?) | Low | Small | UX decision needed |
| 5 | End-to-end testing with full demo flow | High | Medium | Jul 14-15 |

---

*Report generated: 29 June 2026*
