# KineticAge — Work Report (Roshini Kotte)

**Date:** 15 July 2026 (final submission)
**Demo Deadline:** 17 July 2026
**Repository:** eightbits0211/AIavatar_kineticage

> **Final status:** Backend is complete, deployed live, and verified end-to-end. See Section 9 for the final-submission summary and today's verification results.

---

## 1. Project Overview

KineticAge is an AI-powered fitness companion that delivers personalized workout plans, voice and text coaching, motivation, accountability, and progress tracking. The product's core differentiator is the feeling of having a knowledgeable, supportive training partner available at any time.

**Tech Stack:** React Native (Expo) + Node.js/Express + MongoDB Atlas + Firebase Auth + Gemini AI + Deepgram STT + ElevenLabs TTS

---

## 2. Contribution Summary

| Metric | Value |
|--------|-------|
| Commits (non-merge, authored by Roshini) | 102 |
| Pull Requests merged (repo total) | 63 |
| Role | Full backend architecture, services, API design, deployment, documentation, project setup |

*Backend deployed live on Render: `https://aiavatar-kineticage.onrender.com` (branch `dev`, auto-deploy).*

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
| 10 | Error hardening — graceful fallbacks for AI, STT, and TTS (no 500s for service failures) | dev |
| 11 | Demo seed script — 3 realistic users with sessions, progressions, check-ins, weight logs, badges | dev |
| 12 | Per-session calories_burned — calculated and stored on session end, returned in progress history | dev |
| 13 | Prompt tuning — no-markdown enforcement for TTS + stripMarkdown post-processor | #25 |
| 14 | Exercise images — 80 exercises mapped to 2-frame animated images + image_url_end field | #27 |

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
│   ├── aiCompanion.ts           # AI companion (Gemini 2.5 Flash) — renamed from claude.ts
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

## 7. Remaining Work (My Tasks Before Demo) — ALL COMPLETE

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | Animated exercise GIFs | ✅ Done | Final solution: `omercotkd/exercises-gifs` GitHub CDN (free, no watermark, no API key). All 80 exercises mapped (PRs #27, #28). |
| 2 | Weight logging | ✅ Done | Weight log endpoints + session-end calorie calc from actual reps × user weight (PR #31). |
| 3 | End-to-end testing with full demo flow | ✅ Done | Verified on both local and live deployment on 15 Jul — see Section 9. |

---

## 8. Completed Today (30 June 2026)

- ✅ Proactive AI triggers endpoint — 7 trigger types (session_start, exercise_intro, set_complete, rest_start, exercise_complete, session_end, milestone) with context-aware Kira messages and graceful fallbacks
- ✅ Exercise images — mapped all 80 exercises to 2-frame animated images (start + end position) from free-exercise-db (MIT-licensed, GitHub CDN)
- ✅ Added `image_url_end` field to Exercise model, Bundle model, shared types, bundle assembly, routes, and voice proxy
- ✅ Fixed 3 broken image URLs (Glute Bridge, Walking Lunge, Burpee)
- ✅ Created automated script to upgrade to ExerciseDB animated cartoon GIFs (ready to run tomorrow when API quota resets)
- ✅ Trigger test HTML page for dev testing (`/api/companion/trigger-test`)
- ✅ Exercise preview page for visual QA (`server/public/exercise-preview.html`)

---

*Report generated: 30 June 2026*

---

## 9. Final Submission Summary (15 July 2026)

The backend is feature-complete, deployed to a public host, and verified working end-to-end. Below is everything delivered since the 30 June report.

### 9.1 Backend work completed (1–15 July)

| Area | Work | PRs |
|------|------|-----|
| Exercise media | Final GIF solution — `omercotkd/exercises-gifs` GitHub CDN (free, no watermark, no key); all 80 exercises mapped | #27, #28 |
| Voice styles | 4 voice styles (calm / energetic / friendly / professional) mapped to ElevenLabs voices + Gemini Live voices | #29 |
| Coaching personality | 4 coaching styles (motivational / friendly / strict / zen) injected into the system prompt | #39 |
| Soreness-aware plans | Daily check-in soreness deprioritizes sore muscle groups in bundle generation | #39 |
| Bundle lifecycle | Auto-regenerate bundles after a session; dashboard `bundles_stale` flag; resume-vs-new prompt for in-progress sessions | #36, #37 |
| Calories | Session-end calories from actual reps × muscle-group rate × user weight | #31 |
| Voice/text sync | Proxy emits `workout_state` / `session_started`; auto-starts session on coaching; loads prior text history into voice context | #32, #35 |
| Deterministic voice actions | Replaced fragile phrase-matching with native Gemini Live **function calling** — `start_workout`, `complete_set`, `next_exercise`, `skip_exercise`, `pause_workout`, `resume_workout`, `end_workout`, `report_pain` | #47, #48, #50 |
| Voice robustness | VAD interruption fix (LOW start sensitivity — Kin no longer cut off mid-sentence); onboarding never gets stuck (defaults after failed extractions + "just start" escape hatch) | #51 |
| Reliability | Rate limit raised to 600/min; `avatar_url` field; AI companion service rename (`claude.ts` → `aiCompanion.ts`) | dev |
| Performance | Disabled Gemini "thinking" budget (removed ~370 hidden tokens/response → faster, no truncation) | dev |
| TTS fix | ElevenLabs deprecated `eleven_monolingual_v1`; migrated to `eleven_flash_v2_5` + fail-fast on 400 (all TTS was silently failing) | #63 |
| Deployment | Backend deployed to Render with WebSocket support, all env vars, DB seeded; `/health` verified | — |

### 9.2 End-to-end verification (15 July)

Tested against **both** the local server and the **live Render deployment**:

| Path | Result |
|------|--------|
| `/health` (deployed) | ✅ ok |
| Text chat (Gemini 2.5 Flash) | ✅ complete replies, ~1.7–2.4s |
| Text-to-speech (ElevenLabs) | ✅ audio returned after model fix |
| Voice (Gemini Live WebSocket proxy) | ✅ connects, sets up, Kin responds |

### 9.3 Scope boundary — known open item (frontend, not backend)

Live voice does not yet play/capture audio **inside the Android APK**. Root cause (confirmed with the mobile owner): the app's live-voice code is browser-only (`getUserMedia` / Web `AudioContext`) and no native audio path was wired up. This is a **mobile/frontend build** (add a native audio module, mirror the existing web client) and is owned by the mobile developer. It requires **no backend changes** — the backend voice proxy, Gemini Live, and TTS are all verified working. The web build exercises the full voice experience today.

### 9.4 Bottom line

All backend responsibilities for the demo are complete, deployed, and tested. The AI companion (text + voice), Rules Engine, session lifecycle, gamification, and progress tracking are live on the server and confirmed responding as of 15 July 2026.

---

*Report updated: 15 July 2026*
