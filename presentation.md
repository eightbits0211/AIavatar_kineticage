---
marp: true
theme: gaia
paginate: true
backgroundColor: #fff
color: #333
style: |
  section {
    font-size: 22px;
    padding: 40px 50px;
  }
  h1 {
    color: #2d3436;
    font-size: 2em;
    border-bottom: 3px solid #6C63FF;
    padding-bottom: 8px;
  }
  h2 {
    color: #6C63FF;
    font-size: 1.3em;
  }
  strong {
    color: #6C63FF;
  }
  table {
    font-size: 18px;
    width: 100%;
  }
  th {
    background: #6C63FF;
    color: white;
    padding: 10px 14px;
  }
  td {
    padding: 8px 14px;
    color: #333;
    border: 1px solid #ddd;
  }
  pre {
    background: #2d3436;
    color: #dfe6e9;
    border-radius: 8px;
    padding: 14px;
    font-size: 13px;
  }
  code {
    background: #f0f0f0;
    color: #6C63FF;
    padding: 2px 6px;
    border-radius: 4px;
  }
  pre code {
    background: none;
    color: #dfe6e9;
  }
  blockquote {
    border-left: 4px solid #6C63FF;
    padding-left: 14px;
    color: #636e72;
  }
  li {
    margin-bottom: 6px;
  }
  section.lead h1 {
    font-size: 2.8em;
    color: #6C63FF;
    border: none;
    text-align: center;
  }
  section.lead h2 {
    color: #636e72;
    text-align: center;
    font-weight: 300;
  }
  section.lead p {
    text-align: center;
  }
---

<!-- _class: lead -->

# KineticAge
## AI-Powered Fitness Companion

Your intelligent workout partner — voice + text coaching,
personalized plans, and real-time motivation.

*Made by Roshini Kotte*

---

# The Problem

- Generic workout apps don't adapt to YOU
- Personal trainers are expensive ($50-150/session)
- Existing fitness apps feel like static catalogs
- Users lose motivation without accountability
- No app combines safe workout generation with natural conversation

---

# Our Solution

An AI companion that feels like having a knowledgeable, supportive training partner — available anytime.

**Two brains working together:**

| Rules Engine | AI Companion (Claude) |
|---|---|
| Generates safe, trainer-approved workouts | Explains, motivates, coaches |
| Deterministic — predictable & explainable | Conversational — natural & adaptive |
| Never hallucinates exercises | Never prescribes weights or exercises |

---

# Key Features

- **Personalized Workout Bundles** — 3-4 options generated per session
- **Voice + Text Coaching** — talk to your companion mid-workout
- **Smart Progression** — tracks per-exercise performance over time
- **Persona-Based Adaptation** — injury recovery, beginner, office professional, etc.
- **Gamification** — XP, streaks, badges, levels
- **Daily Check-ins** — energy and soreness tracking
- **Post-Workout Summaries** — AI-generated performance insights

---

# How It Works — User Flow

```
Onboarding → Persona Assignment → Bundle Generation → Workout Session → Progress Tracking
```

1. User completes onboarding (goals, equipment, injuries, preferences)
2. System assigns persona tags + calculates fitness metrics
3. Rules Engine generates 3-4 personalized workout bundles
4. User selects a bundle and starts a guided session
5. AI companion coaches through each exercise via voice/text
6. Session data feeds back into progression and gamification

---

# Architecture Overview

```
┌─────────────────────────────────────────────────┐
│          Mobile App (React Native + Expo)         │
│   Voice Input │ Chat UI │ Bundle Selection │ Session │
└───────────────────────────┬─────────────────────┘
                            │ REST API (HTTPS)
┌───────────────────────────┼─────────────────────┐
│          Backend (Node.js + Express + TypeScript) │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │  RULES ENGINE (deterministic, no LLM)       │ │
│  │  Filter → Category → Persona → Assembly     │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │  AI SERVICE (Claude — explain & motivate)   │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│  • Progression Service (per-exercise tracking)   │
│  • Gamification Service (XP, streak, badges)     │
│  • Persona Service (assignment + re-evaluation)  │
│  • Retry layer (p-retry) on all external calls   │
└───────────┬──────────────┬───────────────┬───────┘
            │              │               │
      MongoDB Atlas    Claude API    Deepgram + ElevenLabs
```

---

# The Rules Engine — 4-Stage Pipeline

**Stage 1: Filter**
Exclude exercises based on equipment, location, injuries

**Stage 2: Category**
Apply goal-specific set/rep/rest rules (Strength, Hypertrophy, Mobility, etc.)

**Stage 3: Persona Modifier**
Additive tweaks based on persona tags (injury recovery, beginner, office worker)

**Stage 4: Bundle Assembly**
Produce 3-4 distinct bundles differentiated by focus, duration, and intensity.
Score each against planned focus, recent muscle groups, recovery status.
Mark highest-scoring as recommended.

> Priority order: Injury > Equipment > Goal > Persona

---

# AI Companion — Claude's Role

Claude is strictly: **explain, motivate, answer, coach.**

- Generates rationale text for bundles
- Provides exercise form explanations from library data
- Motivational messaging tied to real events (streaks, PRs, milestones)
- Post-workout summaries
- Adapts tone to persona tags and user preferences

**Safety guardrails:**
- Never invents exercises
- Never prescribes specific weights
- Defers medical questions
- Redirects off-plan queries to current workout

---

# Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile | React Native (Expo), TypeScript, Zustand, React Navigation |
| Backend | Node.js, Express, TypeScript, Mongoose |
| Database | MongoDB Atlas |
| Auth | Firebase Authentication |
| AI | Anthropic Claude API (claude-sonnet-4) |
| Speech-to-Text | Deepgram (streaming) |
| Text-to-Speech | ElevenLabs (streaming) |
| Retry/Resilience | p-retry (3x exponential backoff) |

---

# Progression & Gamification

**Smart Progression:**
- Tracks per-exercise performance across sessions
- Auto-progresses when user hits top of rep range 2x consecutively
- Deloads when exercises are skipped or marked hard
- Substitutes from same substitution group when deprioritizing

**Gamification:**
- XP for workouts, check-ins, streaks, milestones
- Leveling system with badges
- Grace-day model — no punishment for rest days
- "Comeback" badge for returning after breaks

---

# Voice Pipeline

```
User speaks → Deepgram (STT) → Claude (AI response) → ElevenLabs (TTS) → Audio plays
```

- **Latency target:** < 4 seconds end-to-end
- **Streaming:** Audio starts playing before full response is ready
- **Fallback:** Text chat always available
- **Mode:** Press-to-talk (not always listening)
- **Retry:** All external API calls wrapped with p-retry (3x, exponential backoff)

---

# Key Differentiators

1. **Safe by design** — Rules Engine guarantees trainer-approved content
2. **Feels human** — Claude provides natural, adaptive conversation
3. **Voice-first** — like talking to a real trainer mid-set
4. **Truly personalized** — persona tags, injury awareness, progressive overload
5. **Affordable** — fraction of a personal trainer's cost
6. **Accessible** — works for all fitness levels, no special equipment required

---

<!-- _class: lead -->

# Thank You

## KineticAge — Your AI Training Partner

---
