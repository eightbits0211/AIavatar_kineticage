# Workout Screen — Frontend Connection Plan

**For:** Pratham (Mobile)  
**Date:** July 2026

---

## The Rule

**The workout screen visibility is driven by ONE thing: does a session exist with status `in_progress`?**

Not by Kin speaking. Not by the user tapping "Start Workout". Not by a voice command. Those are just *triggers* that create the session — but the **screen state** follows the session.

---

## How to detect session state (2 sources)

**Source 1: REST (on app load / tab focus)**
```typescript
// Call this on app open + on HomeScreen focus
const session = await apiGet('/api/session/active');
if (session) {
  // Session exists → show WorkoutDeck with session.exercises
  showWorkoutScreen(session.session_id, session.exercises);
}
```

**Source 2: WebSocket (real-time, during voice)**
```typescript
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  
  if (msg.type === 'session_started') {
    // Backend created a session (via voice or any other trigger)
    showWorkoutScreen(msg.session_id, msg.exercises);
  }
  
  if (msg.type === 'workout_state') {
    // Backend advanced the workout (set done, exercise skipped, etc.)
    updateCard(msg.current_exercise_index, msg.current_set_index);
  }
};
```

---

## Flow: How the workout screen appears

```
USER DOES ANYTHING THAT STARTS A SESSION:
  - Taps "Start Workout" button → calls POST /api/session/start → show deck
  - Says "start" via voice → proxy auto-creates session → sends session_started → show deck
  - App opens with in-progress session → GET /api/session/active returns it → show deck

ALL THREE LEAD TO THE SAME RESULT:
  → WorkoutDeck visible with exercises array
```

**Frontend logic (pseudocode):**
```typescript
// In HomeScreen state:
const [activeSession, setActiveSession] = useState(null);

// On mount + focus:
useFocusEffect(() => {
  const session = await apiGet('/api/session/active');
  if (session) setActiveSession(session);
});

// On WebSocket event:
if (msg.type === 'session_started') {
  setActiveSession({ session_id: msg.session_id, exercises: msg.exercises });
}

// In render:
{activeSession && <WorkoutDeck session={activeSession} />}
```

---

## Flow: How exercises advance

**There is ONE source of truth: the `workout_state` event from the backend.**

| User action | What happens | Who advances the card |
|-------------|-------------|----------------------|
| Taps "Done" button (text mode) | Frontend calls `PUT /api/session/:id/exercise` | Frontend advances card locally |
| Taps "Done" button (voice mode) | Frontend sends `ws.send({ action: 'complete_set', actual_reps: 12 })` | Backend sends `workout_state` → frontend updates card from event |
| Says "done" via voice | Gemini responds → proxy detects → marks set complete | Backend sends `workout_state` → frontend updates card from event |
| Says "I did 6 reps" via voice | Same as above | Same — `workout_state` event drives the card |

**Frontend logic:**
```typescript
// Listen for workout_state on WebSocket
if (msg.type === 'workout_state') {
  setCurrentExerciseIndex(msg.current_exercise_index);
  setCurrentSetIndex(msg.current_set_index);
  // Card automatically shows the right exercise
}
```

---

## Flow: How the workout screen disappears

```
USER ENDS SESSION:
  - Taps "End Workout" → POST /api/session/:id/end → show summary → hide deck
  - All exercises complete → proxy detects → frontend gets final workout_state
  
FRONTEND:
  const endResponse = await apiPost(`/api/session/${id}/end`);
  setActiveSession(null);  // Hides WorkoutDeck
  showSummaryModal(endResponse);  // Shows report
```

---

## Summary: What the frontend needs to do

1. **Show WorkoutDeck when** `activeSession !== null`
2. **Set activeSession from** `GET /api/session/active` (on mount) OR `session_started` WebSocket event
3. **Update card position from** `workout_state` WebSocket events (never advance manually during voice)
4. **Clear activeSession when** session ends (`POST /api/session/:id/end`)

That's it. The backend handles all the complexity (auto-starting sessions, detecting voice commands, advancing state). The frontend just **reacts to events**.

---

## It's NOT a backend issue because:

- `GET /api/session/active` ✅ returns the in-progress session
- `session_started` event ✅ fires when voice creates a session  
- `workout_state` event ✅ fires on every set/exercise change
- `POST /api/session/:id/end` ✅ ends the session and returns the report

All backend events are already being sent. The frontend just needs to listen and react.

---

## Backend events reference

| Event | When it fires | Key fields |
|-------|---------------|------------|
| `session_started` | Voice proxy auto-creates session | `session_id`, `bundle_id`, `exercises[]` |
| `workout_state` (set_complete) | Set marked done | `current_exercise_index`, `current_set_index`, `actual_reps` |
| `workout_state` (exercise_complete) | All sets done, next exercise | `current_exercise_index`, `exercise_id` |
| `workout_state` (skipped) | Exercise skipped | `current_exercise_index`, `exercise_id` |
| `workout_state` (pain) | Pain reported | `current_exercise_index`, `body_area` |

---

## Text mode vs Voice mode

| | Text mode (no WebSocket) | Voice mode (WebSocket active) |
|---|---|---|
| Start session | `POST /api/session/start` | Proxy sends `session_started` event |
| Advance exercise | `PUT /api/session/:id/exercise` | Listen for `workout_state` event |
| Done button | Calls REST + advances card locally | Sends `ws.send({ action: 'complete_set' })` + card follows `workout_state` |
| Skip button | Calls REST + advances card | Sends `ws.send({ action: 'skip_exercise' })` + card follows `workout_state` |
| End session | `POST /api/session/:id/end` | Same — always REST |

**KEY RULE: During voice mode, NEVER call REST exercise update endpoints. The proxy is the sole DB writer. Card follows `workout_state` events only.**
