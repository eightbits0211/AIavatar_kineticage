# Kinetic Age AI Companion — Development Workflow & Git Guide

## 1. Git Strategy

### Branch Structure

```
main                         ← Stable, always working. Only receives merges from dev.
├── dev                      ← Integration branch. Features merge here first.
├── feature/setup            ← Project scaffolding
├── feature/auth             ← Firebase Auth + MongoDB
├── feature/claude-chat      ← Basic Claude conversation (explain/motivate only)
├── feature/voice            ← Deepgram + ElevenLabs
├── feature/rules-engine     ← Deterministic workout generator (4-stage pipeline)
├── feature/session          ← Workout session state machine
├── feature/progression      ← Per-exercise progression tracking
├── feature/onboarding       ← Profile + persona assignment
├── feature/gamification     ← XP, streaks, badges, dashboard
├── feature/exercise-library ← Exercise content seeding + UI
├── feature/daily-checkins   ← Daily check-in flow
├── feature/polish           ← UI cleanup, edge cases
└── fix/[description]        ← Bug fix branches
```

### Rules

1. **Never push directly to `main`.** Always go through `dev` first.
2. **Never push directly to `dev`.** Always open a PR from a feature branch.
3. **One feature per branch.** Don't mix unrelated work.
4. **Pull `dev` before starting a new branch** to avoid merge conflicts.
5. **Commit often** — small commits are better than one giant commit.
6. **Delete feature branches** after they're merged to keep things clean.

### Commit Message Format

```
type: short description (max 72 chars)
```

**Types:**
- `feat:` — new feature or functionality
- `fix:` — bug fix
- `docs:` — documentation changes
- `refactor:` — code restructuring (no behavior change)
- `style:` — formatting, semicolons, etc (no logic change)
- `test:` — adding or updating tests
- `chore:` — dependency updates, config changes

**Examples:**
```
feat: add voice recording with expo-av
feat: add Claude service with system prompt
feat: add session state machine (Zustand)
fix: handle empty Deepgram transcription
fix: prevent crash when session ends early
docs: update system prompt instructions
refactor: extract state machine to separate module
chore: update ElevenLabs SDK to v2.1
```

---

## 2. Daily Workflow (For Each Developer)

### Starting Work

```bash
# 1. Switch to dev and pull latest
git checkout dev
git pull origin dev

# 2. Create your feature branch from dev
git checkout -b feature/your-feature-name
```

### While Working

```bash
# Stage and commit frequently
git add -A
git commit -m "feat: add deepgram transcription endpoint"

# More work...
git add -A
git commit -m "feat: add voice recording hook using expo-av"

# Push to remote (first time)
git push -u origin feature/your-feature-name

# Push subsequent commits
git push
```

### When Feature Is Done

```bash
# 1. Pull latest dev and rebase (keeps history clean)
git checkout dev
git pull origin dev
git checkout feature/your-feature-name
git rebase dev

# 2. Push (may need --force-with-lease after rebase)
git push --force-with-lease

# 3. Create PR on GitHub
gh pr create --base dev --title "feat: voice input/output pipeline" --body "Adds Deepgram STT, ElevenLabs TTS, recording and playback hooks"

# 4. After review + merge, delete the branch
git checkout dev
git pull origin dev
git branch -d feature/your-feature-name
git push origin --delete feature/your-feature-name
```

### Merging dev → main (When dev is stable)

```bash
git checkout main
git pull origin main
git merge dev
git push origin main
```

---

## 3. Monorepo Structure

```
AIavatar_kineticage/
├── docs/                        ← All documentation
│   ├── tech-stack.md
│   ├── requirements.md
│   ├── system-design.md
│   └── development-workflow.md
│
├── mobile/                      ← React Native app (Expo)
│   ├── package.json
│   ├── tsconfig.json
│   ├── app.json
│   └── src/
│       ├── navigation/
│       ├── screens/
│       ├── components/
│       ├── stores/              ← Zustand stores
│       ├── services/            ← API calls, auth
│       ├── hooks/               ← Custom hooks
│       ├── utils/
│       └── theme/
│
├── server/                      ← Node.js + Express backend
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts             ← Entry point
│       ├── config/
│       ├── middleware/
│       ├── routes/
│       ├── services/
│       ├── models/              ← Mongoose schemas
│       ├── prompts/             ← Claude system prompts
│       └── utils/
│
├── shared/                      ← Shared TypeScript types
│   └── types/
│       ├── user.ts
│       ├── session.ts
│       ├── exercise.ts
│       ├── routine.ts
│       └── api.ts
│
├── .gitignore
├── .env.example                 ← Template for env vars (no secrets)
└── README.md
```

---

## 4. Step-by-Step Implementation Plan

### Step 1: Project Scaffolding
**Branch:** `feature/setup`
**Who:** 1 person
**Duration:** Half a day

**Tasks:**
- Initialize React Native project with Expo (TypeScript template)
- Initialize Node.js + Express backend with TypeScript
- Create shared types package
- Set up ESLint, Prettier, tsconfig
- Move existing docs to `docs/` folder
- Create `.env.example` with all required env var keys (no values)

**Definition of Done:** Both `mobile/` and `server/` exist, both compile without errors, folder structure matches system design.

---

### Step 2: Database & Auth
**Branch:** `feature/auth`
**Who:** 1 person (backend-focused)
**Duration:** 1-2 days

**Tasks:**
- Create MongoDB Atlas cluster (free tier)
- Write Mongoose schemas for all collections (User, Session, Routine, Exercise, SessionTurn, DailyCheckin)
- Set up Firebase project, enable email + Google auth
- Write auth middleware (verify Firebase JWT on every request)
- Create routes: `POST /api/auth/signup`, `GET /api/profile`, `PUT /api/profile`
- On mobile: install Firebase Auth, build Login/Signup screen

**Definition of Done:** Can sign up via mobile app, JWT verified on backend, user document appears in MongoDB Atlas.

---

### Step 3: Basic Claude Chat & AI Service
**Branch:** `feature/claude-chat`
**Who:** 1 person
**Duration:** 1-2 days

**Tasks:**
- Create `server/src/services/claude.ts` (Anthropic SDK wrapper)
- Write the base system prompt (Layer 1: personality + guardrails — AI never invents exercises or prescribes weights)
- Create `POST /api/companion/message` endpoint
- On mobile: build simple chat screen (text input + message list)
- Wire: type message → backend → Claude → display response
- Implement safety validation layer: strip any weight numbers or exercise content from responses

**Definition of Done:** Can text the companion and get intelligent, in-character responses. AI never prescribes weights or invents exercises.

---

### Step 4: Voice — STT & TTS
**Branch:** `feature/voice`
**Who:** 1 person (can work in parallel with Steps 2-3)
**Duration:** 2-3 days

**Tasks:**
1. Deepgram STT:
   - Create `server/src/services/deepgram.ts`
   - Create `POST /api/stt/transcribe` endpoint
   - Test with cURL + sample .wav file

2. ElevenLabs TTS:
   - Create `server/src/services/elevenlabs.ts`
   - Create `POST /api/tts/stream` endpoint (chunked response)
   - Test by sending text, verifying audio returned

3. Mobile audio recording:
   - Build `useVoiceInput` hook (expo-av)
   - Build VoiceButton component (tap to record, release to send)

4. Mobile audio playback:
   - Build `useAudioPlayback` hook
   - Play audio stream from TTS endpoint

5. Connect pipeline:
   - Record → Deepgram → Claude → ElevenLabs → Play
   - Full voice conversation working

**Definition of Done:** Say "hello" into mic, hear companion respond aloud within 4 seconds.

---

### Step 5: Rules Engine & Bundle System
**Branch:** `feature/rules-engine`
**Who:** 1-2 people
**Duration:** 3-4 days

**Tasks:**
- Build `server/src/services/rulesEngine/filterStage.ts` — filter exercises by equipment, location, injuries
- Build `server/src/services/rulesEngine/categoryStage.ts` — apply goal-specific set/rep/rest rules
- Build `server/src/services/rulesEngine/personaModifier.ts` — apply persona-based additions (priority order: Injury > Equipment > Goal > Persona)
- Build `server/src/services/rulesEngine/bundleAssembly.ts` — assemble 3-4 bundles, score for is_recommended, ensure variety
- Build `POST /api/bundles/generate` endpoint
- Build Bundle Selection screen on mobile (3-4 cards, recommended highlighted)
- AI generates rationale text for each bundle (using only structured data from rules engine)
- Ensure NO specific weight values appear anywhere in the output

**Definition of Done:** User profile → Rules Engine → 3-4 distinct bundles displayed with one recommended. AI rationale text explains each. No weights shown.

---

### Step 6: Workout Session State Machine
**Branch:** `feature/session`
**Who:** 1-2 people
**Duration:** 2-3 days

**Tasks:**
- Build `sessionStore.ts` (Zustand) with full state machine
- Build Workout Session screen — UI driven by current state
- Wire state transitions to companion messages
- Build `POST /api/session/start` and `POST /api/session/:id/end`
- User marks exercises: complete, skipped, "felt hard"/"felt easy"
- Rest timer with countdown between sets
- Store session data in MongoDB
- AI provides post-workout summary (exercises completed, progression flags, streak, encouragement)

**Definition of Done:** Select a bundle → complete all exercises with set tracking → session marked full → XP awarded → summary displayed.

---

### Step 7: Progression Logic
**Branch:** `feature/progression`
**Who:** 1 person
**Duration:** 1-2 days

**Tasks:**
- Build `server/src/services/progression.ts` — track per-exercise completion history
- Implement progression rules: 2 consecutive top-of-range completions → increase reps or add set
- Implement deload rules: 2+ skips or "felt hard" → deprioritize, substitute
- Wire progression data into bundle assembly stage
- AI suggests "consider slightly heavier next time" (no number) when progression triggers
- Store progression_flags on session records

**Definition of Done:** After 2 sessions of hitting top rep range, next bundle shows increased prescription. After 2 skips, exercise substituted.

---

### Step 8: Onboarding & Persona Assignment
**Branch:** `feature/onboarding`
**Who:** 1 person
**Duration:** 2-3 days

**Tasks:**
- Build all onboarding screens as a guided conversation (age, height/weight, gender, goal, activity level, location, equipment, injuries, duration, prior experience)
- Build `POST /api/personalize` — calculate BMI/TDEE/MHR/Target Zone + assign persona tags (2-4 per user, not mutually exclusive)
- Build companion preference screen (voice selection, talkativeness: Minimal/Balanced/High, in-session verbosity: Quiet/Standard/Detailed)
- Build "Welcome Plan" screen showing first 3-4 generated bundles
- Wire persona tags into both Rules Engine and Claude system prompt
- Display calculated metrics summary with disclaimers

**Definition of Done:** New user completes conversational onboarding → persona tags assigned → metrics calculated → first 3-4 bundles generated and displayed with one recommended.

---

### Step 9: Gamification
**Branch:** `feature/gamification`
**Who:** 1 person
**Duration:** 2 days

**Tasks:**
- Build gamification service (XP calculation, streak tracking, level detection)
- Build StreakBadge and XPBar components
- Build Progress screen with charts
- Wire XP awards into session end flow
- Add daily check-in flow (3 quick questions → 10 XP)
- Build Dashboard screen with streak, XP, today's workout, quick actions

**Definition of Done:** Complete workout → see XP awarded → streak incremented → visible on dashboard and progress screen.

---

### Step 10: Exercise Library & Content
**Branch:** `feature/exercise-library`
**Who:** 1 person
**Duration:** 1-2 days

**Tasks:**
- Create exercise JSON seed file (50+ exercises with descriptions, muscles, equipment, contraindications)
- Build seed script to populate MongoDB
- Build ExerciseListScreen and ExerciseDetailScreen
- Add exercise images (source or create)
- Wire exercise data into companion announcements

**Definition of Done:** Can browse exercises, see details + images, companion references them during sessions.

---

### Step 11: Polish & Edge Cases
**Branch:** `feature/polish`
**Who:** Whole team
**Duration:** 2-3 days

**Tasks:**
- Pain handling: test "my knee hurts" → companion stops → offers skip/end
- Prompt tuning: run 10+ sessions, iterate for natural flow and variety
- Error states: network drops, API failures, empty responses
- UI polish: animations, loading states, transitions
- Offline fallback: cache current exercise plan locally
- Retry layer verification: all external calls use p-retry
- Test on real devices on mobile data

**Definition of Done:** No crashes, all edge cases handled gracefully, prompt feels natural.

---

## 5. Team Split (3 People × 4 Weeks)

| Week | Dev 1 (Mobile Lead) | Dev 2 (Backend Lead) | Dev 3 (Voice/Integration) |
|------|--------------------|--------------------|--------------------------|
| 1 | Step 1 (scaffold) + Step 3 (chat UI) + Navigation | Step 2 (auth + MongoDB) + Step 3 (Claude service + guardrails) | Step 4 (Deepgram + ElevenLabs in isolation) |
| 2 | Step 5 (bundle selection UI) + Step 6 (session UI + state machine) | Step 5 (Rules Engine: Filter + Category + Persona + Assembly) + Step 6 (session endpoints) | Step 4 continued (full voice pipeline connected) |
| 3 | Step 8 (onboarding screens) + Step 9 (gamification UI + dashboard) | Step 7 (progression logic) + Step 8 (persona assignment + metrics) + Step 9 (gamification service) | Step 10 (exercise library seeding) + daily check-ins |
| 4-5 | Step 11 (UI polish + edge cases) + demo flows | Step 11 (prompt tuning + error handling + safety validation) | Step 11 (real device testing + demo recording) |

---

## 6. Environment Variables

Create `.env` in `server/` (never commit this):

```
# Database
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/kinetic-age

# Firebase Auth
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your-project.iam.gserviceaccount.com

# Anthropic (Claude)
ANTHROPIC_API_KEY=sk-ant-api03-...

# Deepgram
DEEPGRAM_API_KEY=...

# ElevenLabs
ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_ID_MALE=...
ELEVENLABS_VOICE_ID_FEMALE=...

# Server
PORT=3000
NODE_ENV=development
```

Create `.env.example` (commit this — no actual values):

```
MONGODB_URI=
FIREBASE_PROJECT_ID=
FIREBASE_PRIVATE_KEY=
FIREBASE_CLIENT_EMAIL=
ANTHROPIC_API_KEY=
DEEPGRAM_API_KEY=
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID_MALE=
ELEVENLABS_VOICE_ID_FEMALE=
PORT=3000
NODE_ENV=development
```

---

## 7. PR Review Checklist

Before merging any PR, verify:

- [ ] Code compiles without errors (`npm run build`)
- [ ] Feature works as described in the PR
- [ ] No console.log left in production code
- [ ] No hardcoded API keys or secrets
- [ ] Types are properly defined (no `any` unless justified)
- [ ] Error cases handled (try/catch, retry, user-facing error messages)
- [ ] Commit messages follow the format

---

## 8. Key Principles

1. **Keep API keys server-side only.** Mobile never touches raw keys.
2. **Test each service in isolation before connecting.** Deepgram alone, ElevenLabs alone, Claude alone — then connect them.
3. **State machine drives the session.** All UI and companion behavior follows from the current state.
4. **System prompt is the product.** Invest real time iterating it. The personality and instructions define the entire user experience.
5. **Fail gracefully.** If voice fails → show text. If Claude fails → retry then error message. If network drops → cache locally.
6. **Small, frequent commits.** Makes it easy to revert one bad change without losing everything.

---

*Document created: June 2026*
