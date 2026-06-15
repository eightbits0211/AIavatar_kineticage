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

## CRITICAL: Rules Engine vs AI Separation

**This is the most important architectural rule in the entire project.**

1. **The Workout Recommendation Engine is a DETERMINISTIC RULES SERVICE.** It is NOT Claude. It is NOT an LLM. It is pure TypeScript logic that generates workouts from user profile + exercise library.
2. **The AI (Claude) NEVER invents exercises, prescribes weights, or generates workout content.** It ONLY explains, motivates, answers questions, and adjusts tone.
3. **The Rules Engine runs four stages:** Filter (equipment/location/injuries) → Category (goal-specific rules) → Persona Modifier (persona-based additions) → Bundle Assembly (3-4 options).
4. **No specific weights are ever shown to the user.** Only exercise name, sets, rep range, and rest interval.
5. **Claude generates rationale text** explaining why a bundle was recommended, using ONLY structured data from the Rules Engine as input — never inventing content.
6. **If Claude is unavailable, bundles still display** with a generic fallback rationale. Generation NEVER blocks on AI availability.

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
3. Basic Claude chat & AI service (explain/motivate only)
4. Voice (STT & TTS)
5. Rules Engine & Bundle System (deterministic, NOT Claude)
6. Workout session state machine
7. Progression logic
8. Onboarding & persona assignment
9. Gamification
10. Exercise library & content
11. Polish & edge cases

Do not skip steps or build later features before earlier ones are working.

## File & Code Safety

1. **Never overwrite an entire file when only a few lines need changing.** Use targeted edits. Other developers may have made changes you don't see.
2. **Always read a file before editing it.** Do not assume you know what's in it from a previous context.
3. **Never delete files without explicit user confirmation.**
4. **Create files only in the correct folder** per the project structure in system-design.md. Ask if unsure.
5. **Do not install new packages** without stating what you're installing and why. Only use packages from the agreed tech stack unless the user approves a new one.
6. **Do not introduce new patterns** if the codebase already has an established way of doing something. Match existing code style (naming, exports, error handling, file structure).

## API & External Services

1. **Never guess API signatures.** If you don't know how a Deepgram/ElevenLabs/Claude endpoint works, say so or look it up. Wrong API usage wastes time debugging.
2. **Always wrap external API calls with p-retry** in the backend services layer.
3. **All API calls from mobile go through OUR backend.** Never call Claude, Deepgram, or ElevenLabs directly from React Native code.
4. **Use environment variables for all secrets and configuration.** Never hardcode API keys, URLs, or voice IDs.
5. **Stream audio from ElevenLabs** — do not wait for the full response before starting playback.

## Error Handling

1. **Every async function must have error handling.** try/catch in services, error middleware in Express, user-facing error messages on mobile.
2. **Fail gracefully to the user.** If voice fails → show text fallback. If Claude fails → retry → then "I'm having trouble, try again."
3. **Never swallow errors silently.** At minimum, log them. Preferably surface them to the user in a friendly way.
4. **Validate all user input** on both mobile (before sending) and backend (before processing).

## State Machine Discipline

1. **All session behavior is driven by the state machine.** The UI, companion messages, and data collection all follow from the current state.
2. **Never skip states.** The transition order is fixed: idle → session_starting → exercise_intro → set_active → set_complete → check_in → rest → (loop or summary) → idle.
3. **State transitions must be explicit** — triggered by user action or timer completion, never implicitly assumed.
4. **When adding new session behavior**, decide which state it belongs to first, then implement within that state.

## Claude System Prompt Rules

1. **The system prompt is assembled from layers** — never put everything in one massive string.
2. **Keep the prompt concise.** Every token costs money. A 20-turn session at ~2,650 tokens/turn = ~$0.16. Verbose prompts multiply costs.
3. **Test prompt changes with at least 5 varied inputs** before committing. Bad prompts break the entire UX.
4. **Never include user PII (email, password) in Claude prompts.** Only include: name, age, conditions, persona, session history.
5. **Always include safety guardrails** in the system prompt: pain = stop, no medical advice, defer to clinical team.

## Mobile-Specific Rules

1. **Use Zustand stores, not React Context,** for state that changes frequently (session state, chat history).
2. **Use React Navigation for all routing.** No custom navigation logic.
3. **UI components must be accessible:** minimum 48x48dp touch targets, 16sp minimum font, 4.5:1 contrast ratio.
4. **Avoid anonymous inline styles.** Use a theme file for colors, spacing, and typography.
5. **Audio recording uses expo-av.** Microphone permissions must be requested before recording starts.

## Backend-Specific Rules

1. **Express routes are thin.** They validate input, call a service, and return the response. Business logic lives in services.
2. **Mongoose models define the schema.** Never use raw `db.collection()` calls.
3. **One file per route** in `server/src/routes/`.
4. **One file per service** in `server/src/services/`.
5. **Rate limit all endpoints** — 60 requests/min per user.
6. **Auth middleware runs on every route** except `/api/auth/signup` and `/api/auth/login`.

## What NOT To Do

- Do NOT add tests unless explicitly asked. We'll add them later.
- Do NOT set up CI/CD or deployment pipelines yet.
- Do NOT add analytics, logging services, or monitoring.
- Do NOT build an admin panel or web dashboard.
- Do NOT add social features, sharing, or multi-user interactions.
- Do NOT implement push notifications until Step 8 (gamification).
- Do NOT refactor or reorganize code that's already working unless asked.

## Reference Documents

- #[[file:ai-trainer-avatar-tech-stack-research.md]] — Full tech stack details
- #[[file:system-design.md]] — Architecture, schemas, API contracts, project structure
- #[[file:development-workflow.md]] — Git strategy, step-by-step plan, team split
- #[[file:.kiro/specs/ai-companion-workout/requirements.md]] — 21 requirements with acceptance criteria
