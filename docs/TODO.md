# KineticAge — Remaining Work

*Last updated: 24 June 2026*

---

## Before Demo (July 17)

### Backend (Roshini)

| # | Task | Priority | Status |
|---|------|----------|--------|
| 1 | Seed demo accounts (users with history, XP, streaks, badges) | High | TODO |
| 2 | Prompt tuning (test Kin across personas, refine tone, no markdown) | High | TODO |
| 3 | Error hardening (graceful fallbacks if Gemini/Deepgram/ElevenLabs down) | Medium | TODO |
| 4 | Rename companion "Kira" → "Kin" in basePersonality.ts | Low | TODO |

### Mobile (Teammate)

| # | Task | Sprint | Status |
|---|------|--------|--------|
| 1 | Navigation setup (AuthStack + MainTabs) | Sprint 1 | TODO |
| 2 | Firebase Auth on mobile (Google, guest, token) | Sprint 1 | TODO |
| 3 | Onboarding screens (chat-style with Kin, 9 steps) | Sprint 1 | TODO |
| 4 | Health Metrics summary screen | Sprint 1 | TODO |
| 5 | Bundle selection screen (4 cards, recommended highlighted) | Sprint 2 | TODO |
| 6 | Workout session screen (progress dots, Done/Skip/Pause) | Sprint 3 | TODO |
| 7 | Chat UI (persistent, voice/text switching) | Sprint 3 | TODO |
| 8 | Voice pipeline mobile (recording hook, VoiceButton, playback) | Sprint 3 | TODO |
| 9 | Dashboard screen (today's workout, XP, streak, achievements) | Sprint 4 | TODO |
| 10 | Gamification UI (level-up animation, badges grid) | Sprint 4 | TODO |
| 11 | Daily check-in UI (energy + soreness modal) | Sprint 4 | TODO |
| 12 | Progress screens (weight trend, weekly activity, charts) | Sprint 5 | TODO |
| 13 | Profile screen (talkativeness slider, voice style) | Sprint 5 | TODO |
| 14 | UI polish (animations, loading states, error states) | Sprint 5 | TODO |

---

## Post-MVP (after July 17)

| # | Feature | Notes |
|---|---------|-------|
| 1 | **Pipecat + Gemini speech-to-speech** | Lower latency, replace Deepgram+ElevenLabs with single streaming model |
| 2 | **Voice style options** | 4 ElevenLabs voice IDs (Calm/Energetic/Friendly/Professional) mapped to user preference |
| 3 | **Weekly persona re-evaluation** | Scheduled job for behavioral personas (Inconsistent Enthusiast based on completion rate) |
| 4 | **Request validation (zod)** | Input validation middleware on all routes |
| 5 | **Wearable integrations** | Apple Watch, Garmin — heart rate during workout |
| 6 | **Nutrition logging** | Meal tracking beyond calorie estimate |
| 7 | **Social features** | Friends, leaderboards, challenges |
| 8 | **Avatar customization** | Unlock avatar appearances as user levels up |
| 9 | **Multi-language support** | i18n for prompts and UI |
| 10 | **Adaptive programming** | AI learns from long-term patterns, auto-adjusts difficulty |
| 11 | **Exercise images/videos** | Visual references for each exercise |
| 12 | **Offline mode** | Cache current bundle locally for workouts without internet |

---

## Completed Work (this session — June 23-24)

- ✅ Fixed shared types (SetData + userStore)
- ✅ Switched AI from Groq → Gemini (gemini-2.5-flash)
- ✅ Added exercise browse routes (GET /api/exercises, GET /api/exercises/:id)
- ✅ Fixed progression_flags CastError bug
- ✅ Full end-to-end testing — all endpoints verified
- ✅ Built browser voice demo (STT → AI → TTS)
- ✅ Fixed TTS reading markdown (stripMarkdown + prompt instruction)
- ✅ Enforced PRD bundle sequence (Warm-up → Primary → Primary → BMI → Core → Cardio → Cool-down)
- ✅ Added workout_phase to all 80 exercises
- ✅ Fixed category stage to pass through structural exercises
- ✅ PRs merged: #14, #15, #16, #17, #18

---

## Key Context for Next Session

- ElevenLabs model: `eleven_monolingual_v1` (current), consider `eleven_turbo_v2` for lower latency
- Firebase Web API Key: AIzaSyBDoRZHeb1OKP2KeVXmJ5xShp4yfV2i7ko (for testing token exchange)
- Voice demo page: http://localhost:3000/voice-demo.html
- Rate limit: 60 req/min per user (increase temporarily for testing)
- Companion name in PRD/mockups: "Kin" (currently "Kira" in code)
- Bundle structure: 7 exercises for 45min, adjusted per duration
