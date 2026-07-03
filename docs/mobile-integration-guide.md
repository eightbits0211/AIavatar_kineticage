# Mobile Integration Guide — KineticAge

**For:** Pratham (Mobile Developer)  
**Backend URL (dev):** `http://localhost:3000`  
**Auth:** Every request needs `Authorization: Bearer {FIREBASE_ID_TOKEN}` header

---

## 1. Auth Flow

```
1. User opens app → check Firebase auth state
2. Not signed in → LoginScreen
   - Google: firebase.auth().signInWithCredential(googleCredential)
   - Guest: POST /api/auth/guest → returns { uid, token }
3. Get ID token: await auth().currentUser.getIdToken()
4. Store token in api.ts (setAuthToken)
5. Check profile: GET /api/profile
   - 404 → user hasn't onboarded yet → OnboardingStack
   - 200 → MainTabs
```

---

## 2. Onboarding Flow

```
1. User completes chat-style onboarding (collecting all fields)
2. Submit: POST /api/profile/create { name, age, height, weight, gender, ... }
3. Personalize: POST /api/personalize → returns { persona_tags, calculated_metrics }
4. Show HealthMetricsScreen (BMI, TDEE, MHR, target zone)
5. Navigate to MainTabs
```

---

## 3. Home Screen — Bundle Generation & Selection

```
1. On screen load: GET /api/dashboard → { greeting, todays_workout, streak, xp, badges }
2. If no active bundles: POST /api/bundles/generate → { bundles: [...] }
3. Display 3-4 bundle cards (title, focus, duration, calorie range)
4. User taps bundle → BundleDetailScreen (show exercises with GIF images)
5. User taps "Start Workout" → POST /api/session/start { bundle_id }
   → returns { session_id, exercises: [...with image_url...], greeting }
```

**Exercise images:** Each exercise has `image_url` — a direct URL to an animated GIF. Use in `<Image source={{ uri: exercise.image_url }} />`. No headers needed.

---

## 4. Workout Session (In-Session)

### State Machine
```
idle → session_starting → exercise_intro → set_active → set_complete → rest → (loop) → session_summary → idle
```

### During Workout
```
- Show current exercise (name, sets, reps, rest, GIF)
- User taps "Done" after a set:
    PUT /api/session/{session_id}/exercise
    Body: { exercise_id, set_index, status: "completed", feedback: "felt_normal" }

- User taps "Skip":
    PUT /api/session/{session_id}/exercise
    Body: { exercise_id, status: "skipped" }

- User taps "Pause":
    POST /api/session/{session_id}/pause

- End workout:
    POST /api/session/{session_id}/end
    → returns { summary, xp_awarded, streak, progression_flags, badges_earned }
```

### Proactive AI Messages (Triggers)
Call these at key moments to get contextual Kin messages:

```
POST /api/companion/trigger
Body: {
  trigger: "set_complete",   // or: session_start, exercise_intro, rest_start, exercise_complete, session_end, milestone
  session_id: "...",
  context: {
    exercise_name: "Barbell Squat",
    set_number: 2,
    total_sets: 4,
    feedback: "felt_hard"    // felt_easy | felt_normal | felt_hard | null
  }
}
Response: { message: "That's the spirit! Two down, two to go.", trigger: "set_complete" }
```

---

## 5. Voice Mode — PRIMARY (WebSocket)

### Connection
```typescript
const token = await auth().currentUser.getIdToken();
const ws = new WebSocket(
  `ws://localhost:3000/ws/voice-live?token=${token}&voice_style=friendly`
);
```

### Query Params
| Param | Required | Values |
|-------|----------|--------|
| token | Yes | Firebase ID token |
| session_id | No | If in active workout |
| bundle_id | No | If starting specific bundle |
| voice_style | No | calm / energetic / friendly / professional |

### What Happens on Connect
1. Server loads user profile, active session/bundle
2. You receive: `{ type: "context_loaded", mode: "workout"|"chat"|"onboarding" }`
3. If mode is "chat" with a bundle available → Kin will greet and ASK if user wants to start (won't auto-coach)
4. If mode is "workout" → Kin coaches the in-progress session

### Sending Audio
```typescript
// Record with expo-audio (PCM 16-bit, 16kHz, mono)
// Send raw audio frames as binary WebSocket messages
ws.send(audioBuffer); // binary
```

### Receiving Audio
```typescript
ws.onmessage = (event) => {
  if (typeof event.data === 'string') {
    // JSON message from server
    const msg = JSON.parse(event.data);
    // msg.type: "context_loaded" | "turn_complete" | "action_detected"
  } else {
    // Binary audio — play it directly
    playAudio(event.data);
  }
};
```

### Client Actions (send as JSON text)
```typescript
ws.send(JSON.stringify({ action: "done" }));     // Set complete
ws.send(JSON.stringify({ action: "skip" }));     // Skip exercise
ws.send(JSON.stringify({ action: "pause" }));    // Pause session
ws.send(JSON.stringify({ action: "resume" }));   // Resume
```

### Handling Disconnection
```typescript
ws.onclose = () => {
  // Fall back to REST STT+TTS (see section 6)
};
```

---

## 6. Voice Mode — FALLBACK (REST)

Use this if WebSocket fails or disconnects:

```
Step 1: Record audio → upload to STT
  POST /api/stt/transcribe
  Content-Type: multipart/form-data
  Body: { audio: <file> }
  Response: { transcript: "I'm done with this set", confidence: 0.95 }
  Error response: { transcript: "", fallback: true, error: "..." } → show text input

Step 2: Send transcript to AI
  POST /api/companion/message
  Body: { message: "I'm done with this set", input_mode: "voice", session_id: "..." }
  Response: { reply: "Nice work! Take 60 seconds rest.", action_intent: null }

Step 3: Convert reply to audio
  POST /api/tts/stream
  Body: { text: "Nice work! Take 60 seconds rest." }
  Response: audio/mpeg binary → play it
  Error response: { fallback: true, text: "..." } → show text instead
```

---

## 7. Voice Style Selection

**Save user's preference:**
```
PUT /api/profile
Body: { "companion_preferences": { "voice_style": "energetic" } }
```

**Options:** calm, energetic, friendly, professional

The saved preference is automatically used by both WebSocket and TTS — no need to pass it every time.

---

## 8. Pain/Injury Detection

When Kin detects the user reporting pain, the response includes `action_intent: "update_injuries"`.

**Mobile should:**
```
1. Detect action_intent === "update_injuries" in companion response
2. Show confirmation: "Kin noticed you mentioned knee pain. Should we update your profile to avoid exercises that stress your knee?"
3. If user confirms:
   - PUT /api/profile { injuries: [...existing, "knee"] }
   - POST /api/bundles/generate (regenerates with new filter)
   - Show new bundles
```

---

## 9. Progress & Gamification

```
GET /api/progress/history?page=1&limit=10  → paginated session history
GET /api/progress/weekly?range=week        → weekly activity chart data
GET /api/progress/goal                     → consistency rate, sessions/week
GET /api/progress/insights                 → automated trend observations
GET /api/progress/strength                 → per-exercise strength changes
GET /api/progress/weight?range=month       → weight trend data
POST /api/progress/weight { weight_kg: 72.5 }  → log weight entry

GET /api/dashboard → { streak, xp, level, badges, todays_workout }
POST /api/daily-checkin { energy_level: "medium", soreness: [...] }
GET /api/daily-checkin/today → check if already submitted today
```

---

## 10. Profile & Settings

```
GET /api/profile → full user profile
PUT /api/profile → update any field (auto-recalculates metrics if body stats change)

Companion preferences (PUT /api/profile):
{
  "companion_preferences": {
    "voice_style": "calm",           // calm | energetic | friendly | professional
    "talkativeness": "balanced",     // minimal | balanced | high
    "in_session_verbosity": "standard"  // quiet | standard | detailed
  }
}
```

---

## 11. Key API Response Patterns

**Success:** `{ data... }` with 200 status  
**Errors:** `{ error: "Bad Request", message: "details" }` with 4xx status  
**AI fallback:** `{ reply: "...", fallback: true }` — AI was unavailable, generic response used  
**TTS fallback:** `{ text: "...", fallback: true }` — couldn't generate audio, show text  
**STT fallback:** `{ transcript: "", fallback: true }` — couldn't transcribe, show text input

---

## 12. Shared Types

Import from `../../../shared/types`:
- `ExerciseBundle`, `BundleExercise` — bundle data
- `SessionState`, `SessionExercise` — session state machine
- `CompanionMessageRequest/Response` — chat API
- `StartSessionResponse`, `EndSessionResponse` — session lifecycle

---

## Quick Reference: What Calls What

| User Action | Mobile Calls | Response |
|-------------|-------------|----------|
| App opens | GET /api/dashboard | Streak, XP, today's workout |
| Generate workouts | POST /api/bundles/generate | 3-4 bundle options |
| Start workout | POST /api/session/start { bundle_id } | Session with exercises |
| Complete set | PUT /api/session/:id/exercise | Updated exercise status |
| End workout | POST /api/session/:id/end | XP, badges, streak, progressions |
| Send text message | POST /api/companion/message | AI reply + action_intent |
| Voice connect | WebSocket /ws/voice-live?token=... | Bidirectional audio |
| Log weight | POST /api/progress/weight { weight_kg } | Confirmation |
| Daily check-in | POST /api/daily-checkin { energy, soreness } | 10 XP awarded |
| Update profile | PUT /api/profile { ... } | Updated profile |
