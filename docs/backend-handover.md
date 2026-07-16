# KineticAge — Backend Handover

**Owner:** Roshini Kotte (backend)
**Last updated:** 15 July 2026
**Repository:** eightbits0211/AIavatar_kineticage
**Live backend:** `https://aiavatar-kineticage.onrender.com` (Render, branch `dev`)

This is the complete handover for the KineticAge backend: architecture, how to run it, deployment, external services, the full API surface, known issues, and follow-ups. For a short demo-day summary and links, see [demo-and-handover.md](./demo-and-handover.md).

---

## 1. What the backend is

A Node.js + Express + TypeScript API (MongoDB via Mongoose) that powers an AI fitness companion. Two deliberately separated systems:

- **Rules Engine** — deterministic, trainer-approved workout generation. Not an LLM. Guarantees safe, explainable content (which exercises, sets, reps, rest, progression).
- **AI layer (Google Gemini)** — explains, motivates, answers, coaches. Never invents exercises or prescribes weights.

**AI providers:**
- Text coaching → **Gemini 2.5 Flash** (`server/src/services/aiCompanion.ts`)
- Real-time voice → **Gemini Live** `gemini-3.1-flash-live-preview`, native speech-to-speech (`server/src/services/voiceLiveProxy.ts`)
- STT (tap-to-talk fallback) → **Deepgram**
- TTS (text replies / fallback) → **ElevenLabs** `eleven_flash_v2_5`

> Note: earlier docs referenced Anthropic Claude. The project standardized on Gemini. The AI companion file was renamed `claude.ts` → `aiCompanion.ts`.

---

## 2. Run it locally

```bash
cd server
npm install
cp .env.example .env    # fill in values (see Section 3)
npm run dev             # ts-node-dev on http://localhost:3000
```

Seed the exercise library (required — the Rules Engine throws if empty):

```bash
# from server/, with MONGODB_URI set in .env
npx ts-node seeds/seed.ts          # 80-exercise library
npx ts-node seeds/seed-demo.ts     # optional: 3 demo users w/ sessions, progress, badges
```

Verify: `curl http://localhost:3000/health` → `{ "status": "ok", ... }`

Browser test pages (served from `server/public/`):
- `/voice-live.html` — full live voice coach
- `/voice-demo.html` — text + voice quick demo
- `/exercise-preview.html` — exercise library with GIFs

---

## 3. Environment variables

From `server/src/config/env.ts`. Set in `.env` locally and in the host dashboard for deploys (never commit them).

| Variable | Purpose | Required |
|----------|---------|----------|
| `PORT` | Server port (host sets automatically) | No (default 3000) |
| `NODE_ENV` | `production` on deploy | Recommended |
| `MONGODB_URI` | MongoDB Atlas connection string | **Yes** |
| `FIREBASE_PROJECT_ID` | Verify client JWTs | **Yes** (auth) |
| `FIREBASE_PRIVATE_KEY` | Firebase admin (keep `\n` escaped) | **Yes** (auth) |
| `FIREBASE_CLIENT_EMAIL` | Firebase admin | **Yes** (auth) |
| `GEMINI_API_KEY` | Gemini text + voice (`GOOGLE_API_KEY` also accepted) | **Yes** (AI) |
| `DEEPGRAM_API_KEY` | Speech-to-text | If voice |
| `ELEVENLABS_API_KEY` | Text-to-speech | If voice |
| `ELEVENLABS_VOICE_ID_MALE` / `_FEMALE` | Default voice IDs | If voice |
| `ANTHROPIC_API_KEY` | Legacy/optional | No |
| `GROQ_API_KEY` | Dev-tier LLM, optional | No |

> `server/.env` is gitignored and must never be committed. The Firebase **admin** service-account JSON belongs only on the server host — never in the mobile app or git.

---

## 4. Deployment (Render)

- **Host:** Render, auto-deploys branch `dev` (needs GitHub repo access for webhooks; otherwise use Manual Deploy).
- **Build:** `npm install --include=dev && npm run build` (the `--include=dev` is required — `typescript` and `@types/*` are devDependencies needed to compile).
- **Start:** `npm start` (`node dist/index.js`).
- **Port:** reads `process.env.PORT` (Render assigns it — don't hardcode 3000).
- **WebSockets:** the host must support long-lived WS (Render does) for the Gemini Live voice proxy at `/ws/voice-live`.
- **Free-tier cold start:** the server sleeps when idle; the first request can take ~30–90s. Warm it (`/health` or open a page) before demos.

After any `server/**` change: confirm Render deployed the commit (Events tab) and hit `/health`. A `server/` change needs a **redeploy only** — no mobile rebuild (the app calls the backend over the network).

---

## 5. Architecture map

```
server/src/
├── config/         db.ts (Mongo), env.ts
├── middleware/     auth.ts (Firebase JWT), rateLimit.ts (600/min per user)
├── models/         User, Exercise, Bundle, Session, SessionTurn,
│                   ExerciseProgression, DailyCheckin
├── routes/         auth, profile, personalize, bundles, exercises, session,
│                   companion, companionTrigger, dailyCheckin, dashboard,
│                   progress, stt, tts, voiceDemo, voiceContext
├── services/
│   ├── rulesEngine/   filterStage, categoryStage, personaModifier,
│   │                  bundleAssembly, index (4-stage pipeline)
│   ├── aiCompanion.ts    Gemini 2.5 Flash text companion (renamed from claude.ts)
│   ├── voiceLiveProxy.ts Gemini Live WS proxy (function calling, VAD, onboarding)
│   ├── voiceOnboarding.ts voice onboarding extraction + defaults
│   ├── persona.ts, progression.ts, gamification.ts
│   ├── deepgram.ts (STT), elevenlabs.ts (TTS)
├── prompts/        basePersonality.ts (Kin persona + guardrails)
└── seeds/          exercises*.json (80), seed.ts, seed-demo.ts
```

**Request flow:** client → Firebase JWT auth middleware → rate limiter → route → service(s) → Mongo. External AI/voice calls are wrapped in `p-retry` with graceful fallbacks (no 500s on transient service failures).

---

## 6. API surface (25+ endpoints)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | /api/auth/guest | Anonymous Firebase user + profile |
| POST | /api/auth/google | Create/fetch profile after Google sign-in |
| POST | /api/auth/upgrade | Guest → full account |
| GET/PUT | /api/profile | Get / update profile (auto-recalc metrics + personas) |
| POST | /api/profile/create | Create profile after signup |
| POST | /api/personalize | Persona tags + BMI/BMR/TDEE/MHR + 15 XP |
| POST | /api/bundles/generate | Generate 3–4 bundles via Rules Engine |
| GET | /api/bundles/active | Current active bundles |
| GET | /api/exercises, /api/exercises/:id | Exercise library |
| POST | /api/session/start | Start session from bundle |
| PUT | /api/session/:id/exercise | Update exercise (complete/skip/feedback) |
| POST | /api/session/:id/end | End: calories, XP, progression, badges |
| POST | /api/session/:id/pause, /resume | Pause / resume |
| GET | /api/session/active | Current in-progress session |
| POST | /api/companion/message | Text chat with AI companion |
| POST | /api/companion/trigger | Proactive coaching triggers (7 types) |
| POST | /api/stt/transcribe | Deepgram STT |
| POST | /api/tts/stream | ElevenLabs TTS stream |
| GET | /api/dashboard | Aggregated home screen data (incl. `bundles_stale`) |
| POST | /api/daily-checkin | Energy + soreness (10 XP) |
| GET | /api/daily-checkin/today | Today's submission |
| GET | /api/progress/history, /weekly, /goal, /insights, /strength | Progress analytics |
| POST/GET | /api/progress/weight | Log / fetch weight history |
| WS | /ws/voice-live | Gemini Live real-time voice proxy |

---

## 7. Voice proxy specifics (`voiceLiveProxy.ts`)

- Auth via `?token=<firebaseIdToken>` query param (falls back to demo mode with any onboarded user if absent).
- Modes: `onboarding` | `workout` | `chat` — chosen from user + session state.
- **Deterministic actions via Gemini function calling** (replaced fragile phrase-matching): `start_workout`, `complete_set`, `next_exercise`, `skip_exercise`, `pause_workout`, `resume_workout`, `end_workout`, `report_pain`. Handlers update the session in Mongo and emit `workout_state` / `session_end` events to the client.
- **VAD tuning:** `realtimeInputConfig` with LOW start sensitivity to stop false barge-in (Kin was cutting off mid-sentence).
- **Onboarding never stalls:** defaults a field after 3 failed extractions; "just start" escape hatch completes with defaults.
- Loads recent text-chat history into the voice context so text ↔ voice continue seamlessly.

---

## 8. Key design decisions

- Rules Engine is deterministic; **AI never generates exercises** (safety, explainability).
- AI responses are **weight-stripped** (never prescribes specific kg/lb) and **markdown-stripped** (clean TTS).
- Gemini "thinking" budget disabled for the text companion (removed ~370 hidden tokens/reply → faster, no truncation).
- Seeded PRNG in bundle assembly for reproducible generation.
- Weight log lives on the User model (fewer joins).
- `p-retry` + graceful fallbacks on every external API.

---

## 9. Known open items (FRONTEND — no backend changes needed)

The backend voice pipeline (proxy, Gemini Live, TTS) is verified working on both local and the live deployment. Two open items are mobile-side:

1. **Live voice in the Android APK** — the app's voice code uses browser APIs (`getUserMedia` / Web `AudioContext`); no native audio path was wired up, so mic/playback don't work in the standalone APK (they work on web). Fix: native audio integration (e.g. `react-native-audio-api`) mirroring the web client, gated by `Platform.OS`. Needs a new dependency + EAS rebuild + device test.

2. **Google Sign-In on the APK** — client-side OAuth issue (works on web). `/api/auth/google` runs only after Firebase auth succeeds and shares the middleware that guest/email login use (both work), so the server side is fine. Fix plan and demo fallback (email/guest) are in [demo-and-handover.md](./demo-and-handover.md).

---

## 10. Post-demo / security follow-ups

- **Rotate credentials** shared during development: MongoDB password, Firebase admin private key, Gemini/Deepgram/ElevenLabs keys.
- Confirm Render is running the latest `dev` (includes the ElevenLabs `eleven_flash_v2_5` TTS fix — the old `eleven_monolingual_v1` was deprecated and returns 400).
- The `voice-demo` routes are unauthenticated (test-only) — remove or protect before any real production use.
- Clean up unused/orphaned Google OAuth clients from the old `com.anonymous.mobile` package (see apk-build-guide.md).

---

## 11. Status

Backend is **feature-complete, deployed, and verified end-to-end** as of 15 July 2026 — AI companion (text + voice), Rules Engine, sessions, gamification, and progress tracking all confirmed responding against the live deployment.
