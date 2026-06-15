---
inclusion: auto
---

# Coding & Git Workflow — Kinetic Age AI Companion

This document defines the process for all code development and git operations in this project. Follow these rules strictly.

## Project Structure

This is a monorepo with:
- `mobile/` — React Native (Expo) app in TypeScript
- `server/` — Node.js + Express backend in TypeScript
- `shared/` — Shared TypeScript types used by both mobile and server
- `docs/` — Documentation files

## Git Rules

1. **Never commit directly to `main` or `dev`.** Always create a feature branch.
2. **Branch naming:** `feature/[short-description]` for new features, `fix/[short-description]` for bugs.
3. **Branch from `dev`**, not from `main`.
4. **Commit message format:** `type: short description` where type is one of: feat, fix, docs, refactor, style, test, chore.
5. **Push to feature branch**, then create a PR targeting `dev`.
6. **Keep commits small and focused.** One logical change per commit.
7. **Never commit `.env` files or API keys.** Use `.env.example` for templates.

## Tech Stack (Do Not Change Without Discussion)

- **Mobile:** React Native (Expo), TypeScript, Zustand, React Navigation, expo-av
- **Backend:** Node.js, Express, TypeScript, Mongoose
- **Database:** MongoDB Atlas
- **Auth:** Firebase Auth (standalone — auth only)
- **AI:** Anthropic Claude API (claude-sonnet-4)
- **STT:** Deepgram
- **TTS:** ElevenLabs (streaming)
- **Retry:** p-retry with exponential backoff on all external API calls

## Architecture Rules

1. **API keys stay server-side only.** The mobile app never directly calls Claude, Deepgram, or ElevenLabs.
2. **All external API calls go through the backend** and are wrapped with p-retry (3 attempts, exponential backoff).
3. **State machine drives the workout session.** States: idle → session_starting → exercise_intro → set_active → set_complete → check_in → rest → session_summary → idle.
4. **Zustand for state management** on mobile. Do not use React Context for frequently-changing state.
5. **Mongoose schemas** define all database models. Do not write raw MongoDB queries.
6. **Shared types** in `shared/types/` — both mobile and server import from here for consistency.

## Claude System Prompt

The system prompt is assembled in layers:
1. Base personality (static)
2. User context (persona, name, conditions)
3. Session context (current exercise, set, state)
4. History (last 5-8 turns + last 3 session summaries)
5. Instructions (state-specific output format)

When modifying the system prompt, edit files in `server/src/prompts/`.

## Code Quality

- No `any` types unless absolutely necessary with a comment explaining why.
- All routes must validate input (express-validator or zod).
- All error responses must return a structured JSON error with a message.
- Console.log is acceptable in development but must not be left in production code.
- Each service (claude, deepgram, elevenlabs) must be behind an abstraction so it can be swapped.

## Implementation Order

Follow the steps defined in `development-workflow.md`:
1. Project scaffolding
2. Database & Auth
3. Basic Claude chat
4. Voice (STT & TTS)
5. Workout session state machine
6. Routine generation
7. Onboarding & personalization
8. Gamification
9. Exercise library & content
10. Polish & edge cases

Do not skip steps or build later features before earlier ones are working.

## Reference Documents

- #[[file:ai-trainer-avatar-tech-stack-research.md]] — Full tech stack details
- #[[file:system-design.md]] — Architecture, schemas, API contracts, project structure
- #[[file:development-workflow.md]] — Git strategy, step-by-step plan, team split
- #[[file:.kiro/specs/ai-companion-workout/requirements.md]] — 21 requirements with acceptance criteria
