# KineticAge — TODO (Before Demo: July 17)

*Last updated: 30 June 2026*

---

## Backend (Roshini)

| # | Task | Priority | Status |
|---|------|----------|--------|
| 1 | Proactive AI triggers — endpoint for contextual Kira messages at key workout moments | High | TODO |
| 2 | Exercise GIFs — map 80 exercises to GIF URLs, populate image_url field in seed data | High | TODO |
| 3 | Weight logging prompt logic — decide when to ask user (weekly? at daily check-in?) | Low | TODO |
| 4 | End-to-end testing with full demo flow | High | TODO (Jul 14-15) |

## Mobile (Pratham)

| # | Task | Priority | Status |
|---|------|----------|--------|
| 1 | Wire proactive AI triggers into workout session UI (call endpoint at set complete, rest start, etc.) | High | TODO |
| 2 | Display exercise GIF on workout session screen (render image_url) | High | TODO |
| 3 | Workout session screen (set tracking, Done/Skip/Pause, rest timer) | High | In progress |
| 4 | Chat UI (persistent, voice/text switching) | High | TODO |
| 5 | Voice pipeline mobile (recording hook, VoiceButton, playback) | High | TODO |
| 6 | Include fitness_level in onboarding profile PUT payload | Medium | TODO |
| 7 | Wire weight logging (POST/GET /api/progress/weight) into Progress tab | Medium | TODO |
| 8 | Gamification UI (level-up animation, badges grid) | Medium | TODO |
| 9 | Daily check-in UI (energy + soreness modal) | Medium | TODO |
| 10 | Progress screens (weight trend chart, strength bars, weekly activity, calorie bars) | Medium | TODO |
| 11 | UI polish (animations, loading states, error states) | Low | TODO |
| 12 | Real-device testing (iOS + Android) | High | TODO |

## Joint (Both)

| # | Task | Priority | When |
|---|------|----------|------|
| 1 | End-to-end testing of full demo flow | High | Jul 14-15 |
| 2 | Bug fixes | High | Jul 14-16 |
| 3 | Demo recording / rehearsal | High | Jul 16-17 |

---

## Completed Today (June 30)

- ✅ Demo seed accounts (3 users with realistic history, XP, streaks, badges)
- ✅ Error hardening (graceful fallbacks for AI, STT, TTS — no 500s)
- ✅ Per-session calories_burned persisted on session end
- ✅ Prompt tuning (no-markdown enforcement, stripMarkdown post-processor, 6/6 tests pass)
- ✅ 5 rules engine gaps addressed (MHR filtering, fitness level, determinism, strength progress, weight logging)

---
