# Kinetic Age AI Companion

A voice + text AI companion for guided strength training. The companion announces exercises, motivates during sets, checks in between sets, adapts the session based on user feedback, and summarizes progress.

**No camera. No pose detection. Just conversation.**

## Tech Stack

- **Mobile:** React Native (Expo), TypeScript, Zustand, React Navigation
- **Backend:** Node.js, Express, TypeScript, Mongoose
- **Database:** MongoDB Atlas
- **Auth:** Firebase Auth
- **AI (text):** Google Gemini 2.5 Flash
- **AI (voice):** Google Gemini Live (real-time speech-to-speech)
- **STT:** Deepgram
- **TTS:** ElevenLabs (streaming)

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

## Documentation

- [Tech Stack](./ai-trainer-avatar-tech-stack-research.md)
- [System Design](./system-design.md)
- [Development Workflow](./development-workflow.md)
- [Requirements](/.kiro/specs/ai-companion-workout/requirements.md)
- [MVP Sprint Plan (Google Sheet)](https://docs.google.com/spreadsheets/d/1KPKkFdosmel64x8E4ffpjbLUP-zJZJdOKdf4kVfOGZM/edit?usp=sharing)

> Note: Full documentation (backend handover, demo links, up-to-date design) lives on the `dev` branch, which has the latest work.
