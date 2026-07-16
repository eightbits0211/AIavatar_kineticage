# Kinetic Age AI Companion

A voice + text AI companion for guided strength training. The companion announces exercises, motivates during sets, checks in between sets, adapts the session based on user feedback, and summarizes progress.

**No camera. No pose detection. Just conversation.**

## Tech Stack

- **Mobile:** React Native (Expo), TypeScript, Zustand, React Navigation
- **Backend:** Node.js, Express, TypeScript, Mongoose
- **Database:** MongoDB Atlas
- **Auth:** Firebase Auth
- **AI (text):** Google Gemini 2.5 Flash
- **AI (voice):** Google Gemini Live (real-time speech-to-speech, `gemini-3.1-flash-live-preview`)
- **STT:** Deepgram
- **TTS:** ElevenLabs (`eleven_flash_v2_5`, streaming)

## Project Structure

```
├── mobile/          ← React Native app
├── server/          ← Node.js + Express backend
├── shared/          ← Shared TypeScript types
├── docs/            ← Documentation
└── .kiro/           ← Specs and steering files
```

## Getting Started

### Server

```bash
cd server
npm install
cp .env.example .env   # Fill in your API keys
npm run dev
```

### Mobile

```bash
cd mobile
npm install
npx expo start
```

## Deployment

- **Live backend:** `https://aiavatar-kineticage.onrender.com` (Render, branch `dev`)
- **Health check:** `https://aiavatar-kineticage.onrender.com/health`
- **Try it in a browser** (runs against the live backend):
  - Voice coach: `https://aiavatar-kineticage.onrender.com/voice-live.html`
  - Text/voice demo: `https://aiavatar-kineticage.onrender.com/voice-demo.html`
  - Exercise library: `https://aiavatar-kineticage.onrender.com/exercise-preview.html`

> Free-tier note: the server sleeps when idle — the first request can take ~30–90s to wake. Warm it before demoing.

## Documentation

- [System Design](./system-design.md)
- [Development Workflow](./development-workflow.md)
- [Requirements](/.kiro/specs/ai-companion-workout/requirements.md)
- [Backend Handover](./docs/backend-handover.md) — architecture, endpoints, env, deploy, known issues
- [Demo Links & Handover Summary](./docs/demo-and-handover.md)
- [APK Build Guide](./docs/apk-build-guide.md)
- [Tech Stack Research](./ai-trainer-avatar-tech-stack-research.md) *(historical — see note; final AI choice is Gemini, not Claude)*
- [MVP Sprint Plan (Google Sheet)](https://docs.google.com/spreadsheets/d/1KPKkFdosmel64x8E4ffpjbLUP-zJZJdOKdf4kVfOGZM/edit?usp=sharing)
