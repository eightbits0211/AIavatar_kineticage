# Kinetic Age — Frontend Handover Guide

A complete, in-depth reference for the **mobile frontend** (`mobile/`) of the Kinetic Age
AI fitness‑companion app. This document is written for a team taking the project over cold.
It explains the architecture, every folder and file that matters, how data flows, how to run
and build the app, the backend contract the app depends on, and the traps you will hit.

> **TL;DR** — It's an [Expo](https://expo.dev/) (React Native) app written in TypeScript.
> Entry point is `mobile/index.ts` → `mobile/App.tsx`. State lives in Zustand stores
> (`src/stores`). All network I/O goes through `src/services/api.ts`. Auth is Firebase
> (`src/services/auth.ts`). The AI coach "Kin" talks to the user via a real‑time voice
> WebSocket proxy on the backend. To run: `cd mobile && npm install && npm start`.

---

## Table of contents

1. [What this app is](#1-what-this-app-is)
2. [Tech stack](#2-tech-stack)
3. [Prerequisites](#3-prerequisites)
4. [Getting started (run it locally)](#4-getting-started-run-it-locally)
5. [Project structure](#5-project-structure)
6. [Configuration & environment variables](#6-configuration--environment-variables)
7. [App bootstrap & entry point](#7-app-bootstrap--entry-point)
8. [Navigation architecture](#8-navigation-architecture)
9. [State management (Zustand stores)](#9-state-management-zustand-stores)
10. [Services layer](#10-services-layer)
11. [Screens](#11-screens)
12. [Components reference](#12-components-reference)
13. [Design system / theming](#13-design-system--theming)
14. [Shared types](#14-shared-types)
15. [Backend API contract](#15-backend-api-contract)
16. [Voice architecture (deep dive)](#16-voice-architecture-deep-dive)
17. [Authentication flows (deep dive)](#17-authentication-flows-deep-dive)
18. [Building & releasing](#18-building--releasing)
19. [Rebuild vs redeploy](#19-rebuild-vs-redeploy)
20. [Troubleshooting](#20-troubleshooting)
21. [Known limitations & follow-ups](#21-known-limitations--follow-ups)
22. [Conventions & how to extend](#22-conventions--how-to-extend)
23. [Glossary](#23-glossary)

---

## 1. What this app is

Kinetic Age is a personalized fitness app built around an AI coach named **Kin**. The user
onboards through a chat/voice conversation, the backend builds a personalized workout plan
(“bundles”), and Kin coaches the user through workouts — by text, by press‑to‑talk voice, or
by a fully hands‑free real‑time voice‑to‑voice conversation. Progress is tracked with XP,
levels, streaks, badges, and body metrics (BMI, TDEE, heart‑rate zones).

The frontend is a **thin client**: almost all business logic (personalization, the rules
engine, progression, gamification, AI prompts, voice) lives on the backend. The app’s job is
UI, navigation, local session/UI state, capturing audio, and calling the backend.

### High-level user flow

```
Welcome ─► Auth (signup / login / Google / guest)
        └─► Onboarding chat (collect profile, by text or voice)
              └─► /api/personalize → Health Metrics summary
                    └─► Main app (bottom tabs):
                          • AI Coach (Home)  – chat + voice + workout deck
                          • Progress (Dashboard) – graphs, history, weight log
                          • Profile – settings, edit profile, preferences
```

`RootNavigator` decides which of these three phases to show based on auth + onboarding state.
See [Navigation](#8-navigation-architecture).

---

## 2. Tech stack

| Area | Choice | Notes |
|------|--------|-------|
| Framework | **Expo SDK ~56** + React Native 0.85 | Managed workflow (`/ios` & `/android` are gitignored / generated) |
| Language | **TypeScript** (`strict: true`) | Extends `expo/tsconfig.base` |
| UI runtime | React 19.2 | `react-dom` + `react-native-web` for web target |
| Navigation | **React Navigation v7** | Native stack + bottom tabs |
| State | **Zustand v5** | Small stores, no Redux |
| Auth | **Firebase JS SDK v12** | Email/password, Google, guest (anonymous) |
| Google sign-in | `expo-auth-session` (web) + `@react-native-google-signin` (native) | Two paths, one shared handler |
| Audio | `expo-audio` (press‑to‑talk) + `react-native-audio-api` (native live) + Web Audio API (web live) | Real‑time PCM streaming |
| Fonts | `@expo-google-fonts/inter` | Inter 400/500/600/700 |
| Graphics | `react-native-svg`, `expo-linear-gradient`, `expo-blur` | Custom icons drawn as SVG |
| Animations | `react-native-reanimated` v4, `react-native-gesture-handler` | |
| Storage | `@react-native-async-storage/async-storage` | Firebase persistence + avatar choice |
| Build/CI | **EAS Build** | `eas.json` profiles: development / preview / production |

Package manifest: `mobile/package.json`. Expo/app config: `mobile/app.json`. Build config:
`mobile/eas.json`. TypeScript config: `mobile/tsconfig.json`.

---

## 3. Prerequisites

- **Node.js** 18+ (LTS recommended) and npm.
- **Expo CLI** via `npx` (no global install needed) and **EAS CLI** for builds:
  `npm install -g eas-cli`.
- A device or emulator:
  - Physical device with the **Expo Go** app (fastest for dev), or
  - Android emulator / iOS simulator, or
  - a web browser (`npm run web`).
- Access to the shared cloud accounts to do real builds and change auth:
  - **Expo/EAS** account that owns the project (`app.json` → `extra.eas.projectId`).
  - **Firebase** project `aiavatar-de201`.
  - **Google Cloud** OAuth clients (same project).
- The **backend** must be reachable. Locally that's `http://localhost:3000`; for device
  builds it's the deployed URL (see [Configuration](#6-configuration--environment-variables)).

---

## 4. Getting started (run it locally)

```bash
# from the repo root
cd mobile
npm install

# copy env template and fill in values (see section 6)
copy .env.example .env      # Windows (cmd)
# cp .env.example .env      # macOS/Linux

npm start                   # starts the Expo dev server (Metro)
```

Then:

- Press **`a`** to open Android, **`i`** for iOS simulator, **`w`** for web, or scan the QR
  code with Expo Go on a physical device.
- Convenience scripts (`mobile/package.json`):
  - `npm start` → `expo start`
  - `npm run android` → `expo run:android` (native build)
  - `npm run ios` → `expo run:ios` (native build)
  - `npm run web` → `expo start --web`

> **Important — the backend.** In dev the app points at `http://localhost:3000`. If you run
> the app on a **physical phone**, `localhost` means the phone, not your computer. Either run
> the backend on a reachable host and set `EXPO_PUBLIC_API_URL`, or use a tunnel. The web
> target and emulators can usually reach `localhost` on the host machine.

> **Voice features** need microphone permission and a backend with the AI/voice keys
> configured (Gemini, Deepgram, ElevenLabs). Without them, text chat still works.

---

## 5. Project structure

```
mobile/
├── App.tsx                # Root React component: fonts, providers, auth listener
├── index.ts               # registerRootComponent(App) — the real entry point
├── app.json               # Expo config: name, icons, permissions, plugins, EAS project id
├── eas.json               # EAS Build profiles (development / preview / production)
├── tsconfig.json          # TS config (extends expo base, strict)
├── package.json           # deps + scripts
├── .env / .env.example    # EXPO_PUBLIC_* env vars (gitignored / template)
├── assets/                # app icons, splash, images
├── android/               # generated native project (gitignored in practice)
├── dist/                  # web export output
└── src/
    ├── config/            # firebase.ts, google.ts (SDK init + client IDs)
    ├── navigation/        # RootNavigator + stacks/tabs
    ├── screens/           # one file per screen
    ├── components/        # reusable UI (cards, icons, modals, inputs)
    ├── services/          # api, auth, voice engines
    ├── stores/            # Zustand state
    └── theme/             # colors, spacing, typography, helpers

shared/
└── types/                 # TypeScript types shared between mobile & server
                           # imported as ../../../shared/types
```

> **Note on `shared/types`.** Screens and stores import types via relative paths like
> `../../../shared/types`. This resolves to the repo‑level `shared/types` folder (NOT inside
> `mobile/`). Keep that folder in place; if you relocate `mobile/`, fix these imports.

---

## 6. Configuration & environment variables

### 6.1 How env vars work in Expo

Expo inlines any variable prefixed **`EXPO_PUBLIC_`** into the JS bundle **at build time**.
They are therefore **not secret** — treat them as public client config. The template is
`mobile/.env.example`; copy it to `mobile/.env` for local dev. `mobile/.env` is gitignored.

```dotenv
# Backend base URL (optional locally; required for device/standalone builds)
EXPO_PUBLIC_API_URL=https://aiavatar-kineticage.onrender.com

# Firebase WEB config (public — from Firebase console → Project settings → Web app)
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=

# Google OAuth client IDs (Google Cloud → Credentials → OAuth client IDs)
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=
```

### 6.2 The API base URL

Defined in `src/services/api.ts`:

```ts
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  (__DEV__ ? 'http://localhost:3000' : 'https://your-production-url.com');

export const WS_BASE_URL = API_BASE_URL.replace(/^http/, 'ws'); // http→ws, https→wss
```

- Priority: explicit `EXPO_PUBLIC_API_URL` → dev localhost → a production placeholder.
- `WS_BASE_URL` (used for the voice WebSocket) is **derived automatically**, so setting an
  `https://` API URL gives you `wss://` for free. Don't set it separately.
- ⚠️ The production fallback is still the literal placeholder
  `https://your-production-url.com`. Always set `EXPO_PUBLIC_API_URL` for real builds.

### 6.3 Firebase config — `src/config/firebase.ts`

The Firebase **web** config is currently **hardcoded** in this file (project `aiavatar-de201`)
so the repo works out of the box. These values are not secret (they ship to every client).
The file:

- Initializes the Firebase app singleton (reusing an existing one on fast refresh).
- Chooses auth persistence per platform: `browserLocalPersistence` on web,
  `getReactNativePersistence(AsyncStorage)` on native (session survives restarts).
- Warns in `__DEV__` if any config value looks like a placeholder.

> If you rotate Firebase projects, update `firebaseConfig` here (and/or wire it to the
> `EXPO_PUBLIC_FIREBASE_*` vars). The **admin** service account key must NEVER live in the
> app — it belongs only on the server.

### 6.4 Google OAuth — `src/config/google.ts`

Three client IDs (web / iOS / Android) are **hardcoded** here for project `aiavatar-de201`.
They ship in every binary and are not secret. `LoginScreen` uses these directly. If you
change the Android package name or iOS bundle ID, you must create matching OAuth clients and
update this file (see the [APK build guide](./apk-build-guide.md) for the full saga).

### 6.5 Native config — `app.json`

Highlights you may need to change:

- `android.package` = `com.kineticage.app`, `ios.bundleIdentifier` = `com.anonymous.mobile`
  (⚠️ intentionally **out of sync** — see [Known limitations](#21-known-limitations--follow-ups)).
- `scheme` = `kineticage` (deep‑link / OAuth redirect scheme).
- Microphone permission strings and Android audio/foreground‑service permissions (needed for
  live voice).
- `plugins`: `expo-audio`, `react-native-audio-api` (background/mic config), `expo-asset`,
  `expo-web-browser`, `expo-font`, `@react-native-google-signin/google-signin`.
- `extra.eas.projectId` ties the app to the EAS project.

---

## 7. App bootstrap & entry point

**`mobile/index.ts`** registers the root component:

```ts
import { registerRootComponent } from 'expo';
import App from './App';
registerRootComponent(App);
```

**`mobile/App.tsx`** does four things:

1. Loads the Inter font family via `useFonts`. While fonts load, it renders `LoadingScreen`.
2. Calls `initAuthListener()` once on mount (in a `useEffect`) and unsubscribes on unmount.
   This wires Firebase auth → the Zustand user store and keeps the API token fresh.
3. Wraps the tree in `SafeAreaProvider` and `NavigationContainer`.
4. Renders `RootNavigator` and a dark `StatusBar`.

```tsx
export default function App() {
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  useEffect(() => initAuthListener(), []); // returns unsubscribe
  if (!fontsLoaded) return <LoadingScreen />;
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}
```

---

## 8. Navigation architecture

All navigators live in `src/navigation/`. Uses React Navigation v7 (native stacks + bottom
tabs). Headers are hidden globally (`headerShown: false`) — screens draw their own headers.

### `RootNavigator.tsx` — the top-level gate

Reads three flags from the user store and picks a phase:

```
isInitializing            → LoadingScreen        (resolving Firebase auth)
!isAuthenticated          → AuthStack            (welcome / login / signup / guest)
isAuthenticated && !onboarded → OnboardingStack  (guided setup)
isAuthenticated && onboarded  → MainTabs         (the app)
```

### `AuthStack.tsx`
Native stack: `Welcome` → `Auth` (the `LoginScreen`, which handles both signup and login via a
`mode` route param).

### `OnboardingStack.tsx`
Native stack: `OnboardingChat` → `HealthMetrics`. The chat collects all profile data (typed or
by voice); once `/api/personalize` returns, the metrics summary is shown.

### `MainTabs.tsx` — the floating bottom tab bar
Bottom‑tab navigator with three tabs:

| Tab name | Component | Label |
|----------|-----------|-------|
| `AICoach` | `HomeStack` | AI Coach |
| `Progress` | `DashboardScreen` | Progress |
| `Profile` | `ProfileScreen` | Profile |

Design notes baked in here:
- A **floating pill** tab bar (`position: absolute`, rounded, translucent dark) centered on
  screen (`TAB_WIDTH = 300`). Content flows behind it.
- Active tint is the brand green `rgb(166, 250, 4)`.
- The tab bar hides entirely during a workout “focus mode” via `useUIStore().hideTabBar`.
- Tab icons come from `TabBarIcon`.

### `HomeStack.tsx` (the AI Coach tab)
`Home` → `BundleSelection` → `BundleDetail` → `WorkoutSession`.

### `WorkoutStack.tsx`
An alternative stack (`BundleSelection` → `BundleDetail` → `WorkoutSession`) — same screens as
the Home stack’s workout portion. Present in the codebase; the primary workout entry today is
through `HomeStack`.

> **Navigation type safety:** navigators are currently untyped (`useNavigation<any>()`).
> A good early improvement is to add a typed param list per stack.

---

## 9. State management (Zustand stores)

Six small stores in `src/stores/`. Each is a `create<Store>()` with state + actions. Read a
single slice with a selector, e.g. `useUserStore((s) => s.user)`. None are persisted to disk
except via Firebase (auth) and AsyncStorage (the profile avatar, done in the screen).

### `userStore.ts`
The auth/session source of truth consumed by `RootNavigator`.

| State | Meaning |
|-------|---------|
| `user: UserProfile \| null` | MongoDB profile (hydrated from backend) |
| `firebaseUid` | Firebase UID of current user |
| `isAuthenticated` | true once Firebase has a signed‑in user |
| `isOnboarded` | derived from `user.onboarding_completed` |
| `isInitializing` | true until the first Firebase auth state resolves |

Key action: `setUser(user)` also sets `isOnboarded = !!user.onboarding_completed`.
`logout()` clears everything. Set by `src/services/auth.ts`.

### `onboardingStore.ts`
Drives the onboarding chat. Holds `currentStep` (a `stepOrder` array of ~17 steps), the chat
`messages`, the collected `data` (`OnboardingData`), plus `metrics` + `personaTags` returned by
`/api/personalize`. Actions: `setStep`, `addMessage`, `updateData`, `nextStep`,
`setProcessing`, `setPersonalization`, `reset`.

### `chatStore.ts`
A generic chat message list (`ChatMessage[]` with role `user | companion`) + `isLoading`.
Actions: `addMessage`, `setLoading`, `clearMessages`. (Note: `HomeScreen` also keeps its own
local chat state; this store is available for shared chat needs.)

### `sessionStore.ts`
A workout **state machine** for a live session. `currentState: SessionState`
(`idle | session_starting | exercise_intro | set_active | set_complete | check_in | rest |
session_summary`) plus `sessionId`, `exercises`, `currentExerciseIndex`, `currentSetIndex`.
Actions: `startSession`, `nextExercise`, `nextSet`, `completeSet`, `endSession`, `reset`.

### `gamificationStore.ts`
`totalXp`, `level`, `currentStreak`, `longestStreak`. Actions: `setGamificationData` (from the
backend), `addXp` (recomputes level as `floor(xp/500)+1`), `incrementStreak`, `resetStreak`.

### `uiStore.ts`
Just `hideTabBar: boolean` + `setHideTabBar`. Used to hide the floating tab bar during a
workout.

---

## 10. Services layer

Everything in `src/services/` is framework‑agnostic logic (no JSX).

### 10.1 `api.ts` — HTTP client
The single choke point for backend calls.

- `API_BASE_URL` / `WS_BASE_URL` (see [6.2](#62-the-api-base-url)).
- **Auth token:** an in‑module `authToken` is attached as `Authorization: Bearer <token>` to
  every request. `setAuthToken()` sets it (called by the auth service).
- **401 auto‑retry:** if a request returns 401 and a `tokenRefresher` is registered
  (`registerTokenRefresher`, wired to `getFreshToken` in auth), the client force‑refreshes the
  Firebase ID token once and retries. Avoids a circular import between `api.ts` and `auth.ts`.
- Core function `api<T>(endpoint, { method, body, headers })` → JSON, throws `Error` on non‑OK
  with the server’s `message` if present.
- Convenience: `apiGet`, `apiPost`, `apiPut`.
- `apiUploadAudio<T>(endpoint, file)` — multipart upload for speech‑to‑text. On web it appends
  a real `Blob`/`File`; on native a `{ uri, name, type }` descriptor. It deliberately does
  **not** set `Content-Type` so fetch adds the multipart boundary.
- `apiFetchSpeech(text, voiceStyle?)` — POSTs to `/api/tts/stream`, returns a base64 **data
  URI** playable by `expo-audio`, or `null` if the backend fell back to text‑only.

### 10.2 `auth.ts` — Firebase auth + profile hydration
Bridges Firebase auth ↔ the user store ↔ the backend. See the full flow in
[section 17](#17-authentication-flows-deep-dive). Key exports:

- `initAuthListener()` — registers `onIdTokenChanged`; on sign‑in it refreshes the token, sets
  the store, and calls `hydrateUserProfile()`; on sign‑out it clears state. Returns unsubscribe.
- `getFreshToken(forceRefresh?)` — returns/sets a fresh Firebase ID token.
- `hydrateUserProfile()` — `GET /api/profile`; if missing, self‑heals by
  `POST /api/profile/create` then re‑fetches.
- Sign‑in flows: `signInAsGuest`, `signInWithGoogleIdToken`, `signInWithEmail`,
  `registerWithEmail`, `signOutCurrentUser`.
- `friendlyAuthError(error)` — maps Firebase error codes to human messages.

### 10.3 Voice services
Four files implement the AI voice pipeline. See [section 16](#16-voice-architecture-deep-dive)
for the full picture.

- `voiceLive.ts` — **platform factory**. `createVoiceLive(opts)` returns a `VoiceLive`
  (`isActive / start / stop / sendAction`). Web → `WebVoiceLive`; native → lazily‑required
  `NativeVoiceLive`. Also defines `VoiceLivePhase = idle | connecting | listening | speaking`.
- `webVoiceLive.ts` — browser engine using `getUserMedia` + Web Audio API, streaming 16 kHz PCM
  up and playing 24 kHz PCM down over the `/ws/voice-live` WebSocket.
- `nativeVoiceLive.ts` — the native counterpart using `react-native-audio-api` (same protocol,
  same audio formats). Includes hand‑rolled base64 helpers (no browser `atob`/`btoa`).
- `webPushToTalk.ts` — minimal browser one‑utterance recorder used as the **REST fallback**
  when the live WebSocket is unavailable (record → `/api/stt/transcribe` → chat → TTS).

---

## 11. Screens

One file per screen in `src/screens/`. All are default‑exported React components.

| Screen | Route | Purpose |
|--------|-------|---------|
| `LoadingScreen` | — | Brand + spinner. Shown while fonts/auth resolve. |
| `WelcomeScreen` | `Welcome` | Marketing intro; “Continue” → `Auth` (signup mode). |
| `LoginScreen` (exported as `AuthScreen`) | `Auth` | Combined signup/login with tab switcher, email/password, Google, Apple (stub), guest. |
| `OnboardingChatScreen` | `OnboardingChat` | Chat‑style profile collection (typed **or** voice). Saves via `PUT /api/profile`, then `POST /api/personalize`. |
| `HealthMetricsScreen` | `HealthMetrics` | Shows BMI/TDEE/HR‑zone + persona tags from personalization; finishes onboarding. |
| `HomeScreen` | `Home` | The AI Coach hub: dashboard header, Ask‑Kin chat, mic/voice, in‑chat workout deck, daily check‑in, history drawer, settings sheet, summary modal. **The biggest screen.** |
| `BundleSelectionScreen` | `BundleSelection` | Lists generated workout bundles (recommended first). Regenerate + pick. |
| `BundleDetailScreen` | `BundleDetail` | A bundle’s exercises/details; entry to a session. |
| `WorkoutSessionScreen` | `WorkoutSession` | Standalone guided session (start/complete sets/skip/pause) via `/api/session/*`. |
| `DashboardScreen` | `Progress` (tab) | Progress graphs: weekly activity, weight, strength, goal, insights; log weight. |
| `ProfileScreen` | `Profile` (tab) | Profile summary, edit profile, preferences (talkativeness/voice), badges/levels, avatar, logout. |
| `CompanionScreen` | — | **Placeholder stub** (renders “Companion Screen”). Not wired into navigation. |

### HomeScreen — the core screen (worth studying)

`HomeScreen.tsx` is large and orchestrates most of the app’s interactive behavior. Key pieces:

- **Dashboard data** — loads `GET /api/dashboard` (greeting, persona, today’s workout state,
  streak, XP, badges) and bundles (`/api/bundles/active`, generating via `/api/bundles/generate`
  if empty/stale).
- **Ask Kin chat** — local message list; `sendMessage()` → `POST /api/companion/message`
  (passing `session_id` when a workout is live so Kin has context). Handles an
  `action_intent: update_injuries` by prompting the user to confirm an injury area, then
  `PUT /api/profile` + regenerating bundles.
- **Proactive coaching** — `coach(trigger, sessionId, context)` → `POST /api/companion/trigger`
  at workout moments (`session_start`, `exercise_intro`, `session_end`, milestones), shown as a
  Kin bubble and spoken via TTS.
- **Voice input** — three modes selected by platform/fallback in `onMicPress()`:
  - **Native press‑to‑talk** (`expo-audio`): tap to record, tap to send → `/api/stt/transcribe`.
  - **Continuous live voice** (`createVoiceLive`): hands‑free real‑time via `/ws/voice-live`.
  - **REST fallback** (`WebPushToTalk`): used if the live WebSocket fails.
- **In‑chat workout deck** — a `WorkoutDeck` renders the current exercise. During **live voice**
  the proxy is the sole DB writer; the client mirrors `session_started` / `workout_state`
  events. Outside voice, the client drives `/api/session/*` (start, complete sets/exercise,
  skip, pause, end) and shows a `WorkoutSummaryModal`.
- **Resume / active session** — polls `/api/session/active` to offer resuming an in‑progress
  workout, and guards double‑ending with `finishedSessionRef`.

If you only read one screen to understand the app, read this one.

---

## 12. Shared types

`shared/types/` (repo root, imported as `../../../shared/types`) is the single source of truth
for data shapes shared with the backend. Files:

- `user.ts` — `UserProfile`, enums (`FitnessGoal`, `ActivityLevel`, `Gender`, `Equipment`,
  `InjuryArea`, `WorkoutLocation`, `WorkoutDuration`, `Talkativeness`, `PersonaTag`),
  `CalculatedMetrics`, `Gamification`, preferences.
- `session.ts` — `Session`, `SessionExercise`, `SessionExerciseSet`, `SessionState` (matches the
  session store’s state machine), `InputMode`.
- `bundle.ts` — `ExerciseBundle`, `BundleExercise`, `BundleSet`.
- `exercise.ts`, `routine.ts`, `api.ts` — exercise library, routines, API request/response
  shapes (e.g. `PersonalizeResponse`).
- `index.ts` — re‑exports everything (`export * from './user'`, etc.).

Keep frontend and backend in sync by editing these types in one place. If a backend response
changes shape, update the type here and TypeScript will flag every affected call site.

---

## 13. Backend API contract

The frontend talks to the backend entirely through `src/services/api.ts`. Below is every
endpoint the app calls today, grouped by area. All are prefixed with `API_BASE_URL` and (except
the guest bootstrap) require the `Authorization: Bearer <firebase-id-token>` header, which the
API client attaches automatically.

### Auth & profile
| Method | Endpoint | Used by | Purpose |
|--------|----------|---------|---------|
| POST | `/api/auth/guest` | `signInAsGuest` | Creates anonymous user, returns a custom token |
| POST | `/api/auth/google` | `signInAndFetchGoogleProfile` | Create/fetch profile after Google sign‑in |
| POST | `/api/auth/upgrade` | guest→full upgrade | Promote a guest account to a full one |
| POST | `/api/profile/create` | `hydrateUserProfile`, `registerWithEmail` | Create the MongoDB profile row |
| GET | `/api/profile` | `hydrateUserProfile`, Profile/Dashboard | Fetch the user profile |
| PUT | `/api/profile` | onboarding, settings, edit profile, weight log, injury update | Update profile (recalculates persona tags + metrics) |

### Onboarding & personalization
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/personalize` | Compute metrics + persona tags from the saved profile |

### Bundles (workout plans)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/bundles/active` | Fetch the current set of bundles |
| POST | `/api/bundles/generate` | Generate a fresh set of bundles |

### Sessions (live workouts)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/session/start` | Start a session for a bundle → `session_id` |
| PUT | `/api/session/:id/exercise` | Log `complete_set` / `complete_exercise` / `skip` |
| POST | `/api/session/:id/pause` | Pause (30‑min resume window) |
| POST | `/api/session/:id/end` | End session → summary (progression, XP, streak, badges) |
| GET | `/api/session/active` | Check for an in‑progress session (for resume) |

### Companion (AI coach)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/companion/message` | Send a chat message → `{ reply, action_intent }` |
| POST | `/api/companion/trigger` | Request a proactive coaching line at a workout moment |

### Voice (STT / TTS)
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/stt/transcribe` | Multipart audio upload → transcript |
| POST | `/api/tts/stream` | Text → spoken audio (base64 data URI) |
| WS | `/ws/voice-live` | Real‑time voice‑to‑voice proxy (Gemini Live) |

### Progress & dashboard
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/dashboard` | Home header data (greeting, today’s workout, streak, XP, badges) |
| GET | `/api/progress/weekly?range=` | Weekly activity graph |
| GET | `/api/progress/weight?range=` | Weight history graph |
| POST | `/api/progress/weight` | Log a weight entry |
| GET | `/api/progress/history?limit=` | Workout history list |
| GET | `/api/progress/goal` | Goal progress |
| GET | `/api/progress/strength` | Strength progress |
| GET | `/api/progress/insights` | Text insights |

### Daily check-in
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/daily-checkin/today` | Whether the user checked in today |
| POST | `/api/daily-checkin` | Submit energy + soreness |

> **Health check:** the backend also exposes `GET /health` (used to verify deploys / warm cold
> starts). Not called by the app.

---

## 14. Voice architecture (deep dive)

Voice is the most complex part of the frontend. There are **two generations** of voice, and the
app falls back gracefully between them.

### 14.1 Real-time voice-to-voice (preferred)
A continuous, hands‑free conversation. The client streams microphone PCM to the backend’s
**Gemini Live proxy** over a WebSocket and plays the model’s spoken reply back in real time.

```
mic (16 kHz PCM) ──► /ws/voice-live proxy ──► Gemini Live
speaker (24 kHz PCM) ◄── /ws/voice-live proxy ◄── Gemini Live
```

- **Factory:** `createVoiceLive(opts)` in `voiceLive.ts` returns the right engine per platform.
- **Web engine** (`webVoiceLive.ts`): `getUserMedia` + two `AudioContext`s (16 kHz capture,
  24 kHz playback) + a `ScriptProcessor` that encodes PCM16 → base64 and sends
  `{ realtimeInput: { audio: { data, mimeType } } }`.
- **Native engine** (`nativeVoiceLive.ts`): `react-native-audio-api` `AudioRecorder`
  (`onAudioReady` gives raw PCM frames) + an `AudioContext` for playback. Same JSON protocol.
- **Options** (`VoiceLiveOptions`): `wsBaseUrl`, `token` (Firebase ID token), optional
  `sessionId` / `bundleId` (to ground the AI in a live workout), `voiceStyle`, and callbacks
  `onPhase`, `onTranscript`, `onNotice`, `onError`, `onEvent`.
- **Phases** drive UI feedback: `idle → connecting → listening → speaking`.
- **Half‑duplex echo guard:** while Kin’s audio is still scheduled to play, the client stops
  streaming the mic. On speakers the model’s own voice leaks back into the mic and Gemini Live
  treats it as the user “barging in,” cutting Kin off. Muting the mic during playback prevents
  that echo loop. (Both engines implement this via `nextPlayTime`.)
- **Proxy is the DB writer during voice.** While live voice is active, the backend proxy owns
  all session writes; the client just mirrors authoritative events it emits:
  - `session_started` → open the workout deck.
  - `workout_state` (with `action` / `current_exercise_index`) → advance/pause/resume/end the
    deck. The client never advances the card or writes REST itself in this mode.
  - Onboarding events: `onboarding_progress`, `onboarding_type_fallback`,
    `onboarding_complete`, `onboarding_error` (used by voice onboarding in
    `OnboardingChatScreen`).
- **Explicit start:** the client can also `sendAction('start_workout', { bundle_id })` (and
  `complete_set`, `skip_exercise`, `report_pain`, …) to command the proxy deterministically.

### 14.2 REST fallback (older loop)
If the live WebSocket fails (`onError`), the app drops to a tap‑to‑talk loop:

```
record → /api/stt/transcribe → /api/companion/message → /api/tts/stream → play
```

- **Native** uses `expo-audio` (`useAudioRecorder`, `RecordingPresets.HIGH_QUALITY`).
- **Web** uses `WebPushToTalk` (`MediaRecorder` → `Blob`).
- Transcripts run through the same `sendMessage()` path as typed messages, so TTS +
  `action_intent` handling are shared.

### 14.3 Permissions
Microphone permission strings and Android audio/foreground‑service permissions are declared in
`app.json`. At runtime, native requests permission via `AudioManager.requestRecordingPermissions`
(live) or `requestRecordingPermissionsAsync` (press‑to‑talk); web via `getUserMedia`. Denials
surface a friendly Kin message.

---

## 15. Authentication flows (deep dive)

Firebase is the identity provider; the backend keeps a MongoDB profile keyed by
`firebase_uid`. `src/services/auth.ts` orchestrates everything.

### The listener (single source of truth)
`initAuthListener()` (called once in `App.tsx`) registers `onIdTokenChanged`:

- **User present** → get ID token → `setAuthToken(token)` → set `firebaseUid` + `authenticated`
  → `hydrateUserProfile()` → set `isInitializing = false`.
- **No user** → clear token + `logout()` → `isInitializing = false`.

It also registers `getFreshToken` as the API client’s `tokenRefresher` so 401s auto‑retry.

### Sign-in paths
- **Guest:** `POST /api/auth/guest` returns a Firebase **custom token** →
  `signInWithCustomToken`. The listener hydrates the profile.
- **Email/password login:** `signInWithEmailAndPassword`; listener hydrates.
- **Email/password register:** if a guest is signed in, the email credential is **linked** to
  the anonymous account (preserving `firebase_uid` and all data) and the backend record is
  upgraded (`/api/auth/upgrade`). Otherwise a new user is created and `/api/profile/create`
  runs.
- **Google:** `LoginScreen` obtains an `id_token` (web via `expo-auth-session`
  `useIdTokenAuthRequest`; native via `@react-native-google-signin`), then
  `signInWithGoogleIdToken(idToken)`:
  - If a **guest** is active → link the Google credential to the anonymous account and
    `/api/auth/upgrade` (data preserved). If Google already owns another account
    (`auth/credential-already-in-use`) → fall back to signing into that account.
  - Otherwise → `signInWithCredential` + `POST /api/auth/google`.
- **Apple:** stubbed (`handleApple` shows an alert). Needs an Apple Developer account +
  `expo-apple-authentication` to wire up.

### Profile hydration & self-heal
`hydrateUserProfile()` fetches `GET /api/profile`. If none exists (e.g. auth succeeded but the
profile row is missing), it creates one via `POST /api/profile/create` and re‑fetches — so
onboarding’s `PUT /api/profile` always has a row to update.

### Errors
`friendlyAuthError()` maps Firebase codes (`auth/invalid-email`, `auth/email-already-in-use`,
`auth/weak-password`, `auth/invalid-credential`, `auth/network-request-failed`,
`auth/too-many-requests`, …) to user‑facing text.

---

## 16. Building & releasing

The authoritative, battle‑tested walkthrough is **[`docs/apk-build-guide.md`](./apk-build-guide.md)**
(it documents the exact OAuth/keystore saga and the current deployment). Summary below.

### Local / dev
- `npm start` (Expo Go / emulator / web). No build needed.
- `npm run android` / `npm run ios` create native dev builds (needs Xcode/Android SDK).

### Cloud builds (EAS)
Profiles in `eas.json`: `development` (dev client, internal), `preview` (internal, sideloadable
APK), `production` (auto‑increment). Typical manager‑handoff APK:

```bash
npm install -g eas-cli
eas login                       # must be a member of the Expo org that owns the project
cd mobile
npx eas build -p android --profile preview
```

EAS builds in the cloud and returns a download URL + QR. The `preview` profile produces an
installable artifact (no Play Store).

### ⚠️ Critical build gotchas (from the build guide)
1. **`mobile/.env` is NOT uploaded to EAS.** For cloud builds you must register the
   `EXPO_PUBLIC_*` values as **EAS environment variables** for the target environment
   (e.g. `preview`), or the APK ships with no API URL / Firebase config and login silently
   fails.
2. **Set `EXPO_PUBLIC_API_URL`** to the live backend, or the app hits the placeholder URL.
3. **Android Google Sign‑In needs the build’s SHA‑1 registered** in Google Cloud + Firebase
   for package `com.kineticage.app`. Email/guest login are the reliable fallbacks.
4. **Backend must be live and seeded** (the rules engine errors on an empty exercise library),
   and must support **WebSockets** for voice.
5. Free‑tier hosts **cold‑start** (~30–50s) — warm the backend before a live demo.

### Web export
`expo start --web` for dev; `dist/` holds a web export. `react-native-web` powers the web
target; note some voice code branches on `Platform.OS === 'web'`.

---

## 17. Rebuild vs redeploy

A useful mental model when shipping changes:

- **`server/` changes → backend redeploy, NO app rebuild.** The app calls the backend over the
  network, so AI/voice/prompt/route changes take effect once the backend redeploys — the
  existing installed app picks them up automatically.
- **`mobile/` changes → new build required.** Anything baked in at build time (screens, client
  IDs, package name, `EXPO_PUBLIC_*` values) only changes with a fresh `eas build`.

---

## 18. Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| App opens but login/API does nothing | `API_BASE_URL` still placeholder, or `.env`/EAS env vars missing | Set `EXPO_PUBLIC_API_URL` locally and as an EAS env var |
| Everything 401s | Backend Firebase admin env wrong, or clock/token issue | Check server env; the client already auto‑retries once on 401 |
| Google login works in Expo Go, fails in APK | Build SHA‑1 not registered with Google/Firebase | Register the EAS keystore SHA‑1 (see build guide §2.4) |
| Voice never connects | Host lacks WebSocket support, or Gemini/Deepgram/ElevenLabs keys unset | Use a WS‑capable host; set server keys |
| “Exercise library is empty” | Production DB not seeded | Seed the DB against the deployed `MONGODB_URI` |
| Mic does nothing / permission loop | Permission denied | Grant mic permission; strings are in `app.json` |
| Kin cuts himself off mid‑sentence on speaker | Echo leaking into mic | Expected without echo cancellation; the half‑duplex guard mitigates it — use headphones for demos |
| Firebase “placeholder” warning in console | `firebaseConfig` not filled | Update `src/config/firebase.ts` (or the `EXPO_PUBLIC_FIREBASE_*` vars) |
| Fonts look wrong / flashes | Inter fonts still loading | `App.tsx` shows `LoadingScreen` until `useFonts` resolves |
| Backend first request very slow | Free‑tier cold start | Warm with `GET /health` before demos |

For deeper build issues, the failure‑modes table in
[`docs/apk-build-guide.md`](./apk-build-guide.md) is the most complete reference.

---

## 19. Known limitations & follow-ups

- **iOS bundle ID out of sync.** `ios.bundleIdentifier` is still `com.anonymous.mobile` while
  Android is `com.kineticage.app`. Left intentionally (changing it would orphan the iOS OAuth
  client). Align when iOS becomes a real target — see the build guide’s follow‑ups.
- **Production API fallback is a placeholder** (`https://your-production-url.com`). Always set
  `EXPO_PUBLIC_API_URL`.
- **Google client IDs & Firebase web config are hardcoded** in `src/config/`. Fine for now (not
  secret) but consider moving to env vars for multi‑environment support.
- **`CompanionScreen` is a stub** — not wired into navigation. Remove or implement.
- **Navigation is untyped** (`useNavigation<any>()`). Add typed param lists for safety.
- **Two chat states coexist** — `chatStore` and `HomeScreen`’s local chat state. Consolidate if
  you extend chat.
- **Apple Sign‑In is stubbed.**
- **Brand green is a literal** in several places rather than a theme token.
- **No test suite** is present in the mobile app. Consider adding one before large refactors.
- **Orphaned/legacy OAuth clients** exist in Google Cloud from the package rename (harmless,
  untidy) — see build guide follow‑ups.

---

## 20. Conventions & how to extend

- **Language/style:** TypeScript `strict`. Functional components + hooks. `StyleSheet.create`
  for styles. Pull design values from `src/theme` (colors/spacing/typography/borderRadius).
- **State:** prefer a small Zustand store for cross‑screen state; local `useState` for
  screen‑local state. Read stores with selectors to limit re‑renders.
- **Network:** never call `fetch` directly in a screen — go through `api.ts`
  (`apiGet/apiPost/apiPut/apiUploadAudio/apiFetchSpeech`). It handles auth + 401 retry.
- **Types:** put shapes shared with the backend in `shared/types` and import them; don’t
  redefine locally.
- **Adding a screen:** create it in `src/screens`, register it in the appropriate navigator
  in `src/navigation`, keep `headerShown: false` and draw your own header if needed.
- **Adding a component:** typed props interface, theme tokens, `StyleSheet.create`, keep it
  presentational (data/logic via props or a store).
- **Voice:** don’t branch on platform in screens — use `createVoiceLive`. Both engines speak
  the same protocol, so add features to both `webVoiceLive.ts` and `nativeVoiceLive.ts`.
- **New backend endpoint:** add the call in the relevant service/screen via `api.ts`, add/adjust
  the type in `shared/types`, and update [section 15](#15-backend-api-contract) of this doc.

---

## 21. Glossary

- **Kin** — the AI coach persona the user talks to.
- **Bundle** — a generated workout plan (a set of exercises). See `ExerciseBundle`.
- **Session** — a live/logged workout instance. Has a state machine (`SessionState`).
- **Persona tags** — backend‑assigned labels (e.g. `complete_beginner`) driving personalization.
- **Personalize** — `POST /api/personalize`: computes metrics (BMI/TDEE/HR) + persona tags.
- **Voice Live / proxy** — the backend WebSocket relay to Gemini Live for real‑time
  voice‑to‑voice (`/ws/voice-live`).
- **Press‑to‑talk / REST fallback** — the older record→STT→chat→TTS loop used when live voice
  is unavailable.
- **`action_intent`** — a hint the companion API returns (e.g. `update_injuries`) that the
  client acts on.
- **Focus mode** — during a workout the floating tab bar hides (`uiStore.hideTabBar`).

---

*Maintained alongside the code. When you change the frontend — new screens, endpoints,
stores, or build steps — update the relevant section here so the next team stays oriented.
Companion docs: [`apk-build-guide.md`](./apk-build-guide.md), plus the repo‑root `README.md`
and `system-design.md`.*
