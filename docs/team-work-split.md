# KineticAge — Work Summary & Team Split

**Demo Date:** 17 July 2026

**Team:** Roshini + Teammate

---

## Work Already Completed (by Roshini)

### Sprint 1 — Auth, Onboarding, Health Metrics

| Status | What |
|--------|------|
| Done | Firebase Auth middleware (JWT verification) |
| Done | Auth routes — Guest login, Google login, Account upgrade |
| Done | Full User model (profile, metrics, gamification, preferences, pain history) |
| Done | Profile routes — GET, PUT, CREATE with auto-recalculation |
| Done | Personalization endpoint — BMI, TDEE, MHR, Target Zone + persona tags + 15 XP |
| Done | Persona service — all 8 persona rules + metric formulas |
| Done | Rate limiting middleware |
| Done | Database connection + env config |
| TODO | Onboarding screens (mobile) |
| TODO | Firebase Auth on mobile |
| TODO | Health Metrics display screen |

### Sprint 2 — Personas + Workout Recommendation Engine

| Status | What |
|--------|------|
| Done | Rules Engine — Stage 1: Filter (equipment, location, injuries) |
| Done | Rules Engine — Stage 2: Category (goal-specific sets/reps/rest for 6 goals) |
| Done | Rules Engine — Stage 3: Persona Modifier (beginner volume down, office posture, injury rehab) |
| Done | Rules Engine — Stage 4: Bundle Assembly (3-4 bundles, scoring, muscle rotation) |
| Done | Bundle routes — generate + get active bundles |
| Done | Bundle model in MongoDB |
| Done | Exercise model (contraindications, substitution groups, per-category defaults) |
| Done | Exercise seed data — 80+ trainer-approved exercises |
| Done | AI service (Groq/Llama) with retry + weight-stripping safety |
| Done | AI rationale generation for bundles (non-blocking, fallback if AI down) |
| TODO | Bundle selection UI (mobile) |

### Sprint 3 — Workout Session + AI Avatar

| Status | What |
|--------|------|
| Done | Session model (exercises, sets, pain events, progression flags) |
| Done | SessionTurn model (conversation tracking — voice/text) |
| Done | AI personality prompt — "Kira" with full guardrails |
| Done | AI buildPrompt — 4-layer system (base, user, session, history) |
| Done | Session state machine in Zustand (full state flow) |
| Done | Chat store in Zustand (messages, loading) |
| Done | ExerciseProgression model (per-exercise tracking + progression state) |
| TODO | Session routes (start, update, end, resume) |
| TODO | Companion/Chat route |
| TODO | Voice pipeline (Deepgram + ElevenLabs) |
| TODO | Workout session UI, Chat UI, Voice hooks |

### Sprint 4 — Gamification + Dashboard

| Status | What |
|--------|------|
| Done | Gamification fields on User model (XP, level, streaks, badges, grace days) |
| Done | DailyCheckin model |
| Done | Gamification store in Zustand (XP, level, streaks) |
| TODO | Gamification service (XP rules, streak grace-day, badges) |
| TODO | Dashboard route |
| TODO | Daily check-in route |
| TODO | All dashboard/gamification UI |

### Sprint 5 — Progress Tracking + Hardening

| Status | What |
|--------|------|
| TODO | Progress routes |
| TODO | Progress UI |
| TODO | Switch to Claude API |
| TODO | Prompt tuning |
| TODO | Error hardening |
| TODO | UI polish + testing |

### Other Completed Work

| Status | Item |
|--------|------|
| Done | README + development workflow doc |
| Done | Tech stack research document |
| Done | Presentation slides |
| Done | Full MVP Product Backlog (10 epics, 34 features, 34 stories, 5 sprints) |
| Done | Kiro specs + steering files |
| Done | Mobile scaffolding (Expo + TypeScript) |
| Done | All Zustand stores (user, session, chat, gamification) |
| Done | API service layer + shared TypeScript types |
| Done | Audio dependencies installed |

---

## Work Split Going Forward

### Roshini — Backend and Services

#### Week 1 (Jun 18-24)

| Task | Sprint |
|------|--------|
| Session routes — start, update exercise, end, resume logic | Sprint 3 |
| Companion/Chat route — full prompt building + context | Sprint 3 |
| Progression service — evaluate history, trigger progress/deload | Sprint 3 |

#### Week 2 (Jun 25-Jul 1)

| Task | Sprint |
|------|--------|
| Deepgram STT service + route | Sprint 3 |
| ElevenLabs TTS service + route | Sprint 3 |
| Gamification service — XP rules, streak grace-day, 7 badges | Sprint 4 |
| Daily check-in route | Sprint 4 |

#### Week 3 (Jul 2-8)

| Task | Sprint |
|------|--------|
| Dashboard route (today's workout, XP, streak, history, weekly summary) | Sprint 4 |
| Progress routes (history, weekly, goal, insights) | Sprint 5 |
| Motivational prompts service | Sprint 4 |
| Switch from Groq to Claude API | Sprint 5 |

#### Week 4 (Jul 9-15)

| Task | Sprint |
|------|--------|
| Prompt tuning — 10+ test conversations per persona | Sprint 5 |
| Error handling hardening — retry verification, graceful failures | Sprint 5 |
| Demo data and seed accounts | Sprint 5 |
| Bug fixes | Sprint 5 |

---

### Teammate — Mobile UI and Voice Pipeline

#### Week 1 (Jun 18-24)

| Task | Sprint |
|------|--------|
| Navigation setup (AuthStack + MainTabs, conditional routing) | Sprint 1 |
| Firebase Auth on mobile (Google sign-in, guest, token management) | Sprint 1 |
| Onboarding screens (10-step guided flow, validation, progress indicator) | Sprint 1 |
| Health Metrics summary screen (BMI, TDEE, MHR, Training Zone + disclaimers) | Sprint 1 |

#### Week 2 (Jun 25-Jul 1)

| Task | Sprint |
|------|--------|
| Bundle selection screen (3-4 cards, recommended highlighted, detail view) | Sprint 2 |
| Workout session screen (instructions, set tracking, rest timer, pause/resume) | Sprint 3 |
| Chat UI (persistent, accessible from any screen, voice/text switching) | Sprint 3 |

#### Week 3 (Jul 2-8)

| Task | Sprint |
|------|--------|
| Voice pipeline — recording hook, VoiceButton, audio playback, full integration | Sprint 3 |
| Dashboard screen (today's workout widget, XP bar, streak display) | Sprint 4 |
| Gamification UI (level-up animation, badges grid, XP progress) | Sprint 4 |
| Daily check-in UI (energy + soreness modal) | Sprint 4 |
| Adjustable talkativeness settings screen | Sprint 3 |

#### Week 4 (Jul 9-15)

| Task | Sprint |
|------|--------|
| Progress screens (workout log, goal progress, historical data, insights) | Sprint 5 |
| Dashboard remaining widgets (history summary, progress overview) | Sprint 5 |
| Exercise Library browse UI | Sprint 5 |
| UI polish (animations, loading states, error states, offline fallback) | Sprint 5 |
| Real-device testing (iOS + Android on mobile data) | Sprint 5 |

---

### Jul 16-17 — Demo Prep (Both)

| Task |
|------|
| End-to-end testing of full demo flow |
| Bug fixes |
| Demo recording |

---

## Coordination Rules

| Rule |
|------|
| API contract (shared/types/) is the handshake — add fields and notify |
| Merge to dev every 2 days minimum |
| Roshini writes APIs, Teammate consumes them (mock until ready) |
| Voice split: Roshini = server services + routes, Teammate = mobile hooks + UI |
| Feature branches per git workflow — never push directly to dev or main |
| Test each service in isolation before connecting |

---

## Overall Contribution

| Person | Past Work | Remaining Work | Total Project |
|--------|-----------|----------------|---------------|
| Roshini | 100% of work done so far | 50% of remaining | 75-80% |
| Teammate | 0% | 50% of remaining | 20-25% |

---

*Created: 18 June 2026*
