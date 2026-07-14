# Kinetic Age — Test APK Build Guide

How to produce an installable Android APK that a manager can tap through, backed by a live deployment.

This is **Path B**: a real standalone build. The app is not self-contained — it talks to the backend over HTTP + WebSocket — so the backend must be publicly reachable *before* the APK is built.

---

## Status

- ✅ **Backend deployed and live:** `https://aiavatar-kineticage.onrender.com` (Render, branch `dev`). Health check passes, MongoDB connected, WebSocket voice proxy running.
- ✅ **App is URL-configurable:** `mobile/src/services/api.ts` reads `EXPO_PUBLIC_API_URL` (merged to `dev`).
- ⬜ **Remaining (Pratham):** set env, register Android OAuth SHA-1, build APK, test, share.

## TL;DR — the critical dependency

```
Roshini (backend)                 Pratham (mobile)
─────────────────                 ────────────────
Deploy server to a public URL  →  Point app at that URL
Set all server env vars           Fill mobile/.env
Verify /health responds           Register Android OAuth SHA-1
Hand over the base URL       ───▶ eas build -p android --profile preview
   ✅ DONE                          Test on a real device
                                  Share the link with the manager
```

The backend is live, so Pratham is unblocked. Live base URL: **`https://aiavatar-kineticage.onrender.com`**

---

## Owner split at a glance

| Step | Owner | Blocks whom |
|------|-------|-------------|
| 1. Deploy backend | Roshini | Blocks all of Pratham's testing |
| 2. Set server env vars | Roshini | — |
| 3. Verify `/health` + WebSocket | Roshini | — |
| 4. Hand over base URL | Roshini | Unblocks Pratham step 5 |
| 5. Point app at backend URL | Pratham | — |
| 6. Fill `mobile/.env` | Pratham | — |
| 7. EAS login + project access | Pratham | — |
| 8. Android OAuth SHA-1 | Pratham (needs Google/Firebase access) | Google login on APK |
| 9. Build APK | Pratham | — |
| 10. Test end-to-end | Pratham | — |
| 11. Share link | Pratham | — |

---

# PART 1 — ROSHINI (Backend)

The APK is useless until the backend it calls is live on the public internet. `localhost:3000` only means "this phone," so it will never work on the manager's device.

## 1.1 Choose a host that supports WebSockets

The voice coach uses a **WebSocket proxy** (`server/src/services/voiceLiveProxy.ts`) to relay audio to Gemini Live. The host must support long-lived WebSocket connections, not just plain HTTP.

Good options: **Render**, **Railway**, **Fly.io**. (All support WS on the free/hobby tiers.)

For a throwaway demo you *can* tunnel your local server with `cloudflared tunnel --url http://localhost:3000` or `ngrok http 3000`, but the URL changes each run and your laptop must stay awake — a real deploy is better for a manager handoff.

## 1.2 Build & start commands

The server is TypeScript compiled to `dist/`. On the host, configure:

- **Build command:** `npm install --include=dev && npm run build`
  - Note the `--include=dev`. With `NODE_ENV=production`, `npm install` skips `devDependencies` — but `typescript` and the `@types/*` packages live there and are needed to compile. Without the flag the build fails with `TS7016 / Could not find a declaration file for module 'express'`.
- **Start command:** `npm start`   (runs `node dist/index.js`)
- **Port:** the app reads `process.env.PORT`, which hosts set automatically. Don't hardcode 3000. (Render assigned 10000.)
- **Repo access:** grant Render access to the GitHub repo, otherwise it clones read-only and never receives push webhooks — so merges to `dev` won't auto-deploy and you must use Manual Deploy each time.

## 1.3 Set every server environment variable

From `server/src/config/env.ts`, the backend expects these. Set them in the host's dashboard (never commit them):

| Variable | Purpose | Required for demo? |
|----------|---------|--------------------|
| `MONGODB_URI` | Database connection | Yes |
| `FIREBASE_PROJECT_ID` | Verify client JWTs | Yes (auth) |
| `FIREBASE_PRIVATE_KEY` | Firebase admin (keep `\n` escaped) | Yes (auth) |
| `FIREBASE_CLIENT_EMAIL` | Firebase admin | Yes (auth) |
| `GEMINI_API_KEY` | Voice companion (Gemini Live) | Yes (voice) |
| `DEEPGRAM_API_KEY` | Speech-to-text | If voice used |
| `ELEVENLABS_API_KEY` | Text-to-speech | If voice used |
| `ELEVENLABS_VOICE_ID_MALE` / `_FEMALE` | Voice selection | If voice used |
| `ANTHROPIC_API_KEY` | Claude (fallback/features) | Optional |
| `GROQ_API_KEY` | Dev-tier LLM | Optional |
| `NODE_ENV` | Set to `production` | Recommended |

> Security: the Firebase **admin** service account (the JSON in Downloads) belongs ONLY on the server host. It must never go into the mobile app or git.

## 1.4 Seed the database

The rules engine throws if the exercise library is empty (`server/src/services/rulesEngine/index.ts`). Run the seed against the production MongoDB before demoing. Check `server/seeds/` for the seed script and run it pointed at the deployed `MONGODB_URI`.

## 1.5 Verify before handing off

From a browser (not your machine's localhost — the public URL):

```
https://<your-app>.onrender.com/health
→ { "status": "ok", "timestamp": "..." }
```

If that returns ok and you can create a test account, the backend is ready.

## 1.6 Deliver to Pratham

Send exactly one line:

```
API base URL: https://<your-app>.onrender.com
```

That's Roshini's whole job for the build. Everything else is Pratham's.

---

# PART 2 — PRATHAM (Mobile / APK)

You drive the actual build. Do steps 2.1–2.2 only after Roshini gives you the backend URL.

## 2.1 Point the app at the live backend

Currently `mobile/src/services/api.ts` has a placeholder for production:

```ts
export const API_BASE_URL = __DEV__
  ? 'http://localhost:3000'
  : 'https://your-production-url.com';   // ← must change
```

Make it env-driven so builds don't need code edits (recommended):

```ts
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  (__DEV__ ? 'http://localhost:3000' : 'https://your-production-url.com');
```

The `WS_BASE_URL` for voice is derived automatically (`http→ws`, `https→wss`), so pointing `API_BASE_URL` at an `https://` URL gives you `wss://` for free. No separate change needed.

## 2.2 Create `mobile/.env`

Copy `mobile/.env.example` → `mobile/.env` and fill in real values. Expo inlines `EXPO_PUBLIC_*` at build time, so these must be present when you run the build.

```dotenv
# Backend (live)
EXPO_PUBLIC_API_URL=https://aiavatar-kineticage.onrender.com

# Firebase WEB config (public — Firebase console → Project settings → Web app)
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=...
EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=...
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
EXPO_PUBLIC_FIREBASE_APP_ID=...

# Google OAuth client IDs (Google Cloud → Credentials → OAuth client IDs)
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=...
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=...
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=...
```

> These Firebase web values are safe to ship in a client (unlike the admin key). But still keep `mobile/.env` out of git — it's already gitignored.

## 2.3 Install EAS CLI and log in

```bash
npm install -g eas-cli
eas login
```

The Expo project already exists — `app.json` has `extra.eas.projectId = 938c521e-11d3-4f63-95f7-82741f068139`. You must be a member of the Expo account/org that owns it. If it's under Roshini's account, get invited or agree on whose account owns builds.

## 2.4 Register the Android OAuth SHA-1 (the step everyone forgets)

Google Sign-In works in Expo Go but **breaks in a standalone APK** unless the build's signing certificate fingerprint is registered with Google.

1. Let EAS manage the Android keystore (default on first build), then read the fingerprint:
   ```bash
   eas credentials
   ```
   Select Android → view the **SHA-1** of the keystore EAS uses.
2. Add that SHA-1 to:
   - **Google Cloud Console** → Credentials → your Android OAuth client.
   - **Firebase Console** → Project settings → your Android app → Add fingerprint.
3. If the Android OAuth client doesn't exist yet, create one with package name `com.anonymous.mobile` (from `app.json`) and the SHA-1 above.

Skip this and login will fail only on the installed APK, which is confusing to debug — so do it before building.

## 2.4b Google OAuth clients — current state (READ THIS)

Google client IDs are **hardcoded** in `mobile/src/config/google.ts`, not read from `.env`. The login screen (`LoginScreen.tsx`) uses `Google.useIdTokenAuthRequest` with `webClientId`, `iosClientId`, and `androidClientId`.

Current state in the `aiavatar-de201` Google Cloud project (owner: Roshini):

| Client | Client ID | Status |
|--------|-----------|--------|
| Web | `443799818657-ikqj1p75h7pufai69s36er4d0di6kedk...` | ✅ set in `google.ts` |
| iOS | `443799818657-h1kp18v1d7oo2el5qccn6qd22atdghc0...` | ✅ set in `google.ts`, Bundle ID `com.anonymous.mobile` |
| Android | `443799818657-dri1v2f7u85seos2sf0q7lrlm4k0shqm...` | ❌ misconfigured — package name field holds the iOS client ID instead of `com.anonymous.mobile`; `androidClientId` is empty in `google.ts` |

**Why Google Sign-In will fail in the APK until this is fixed:** `androidClientId` is empty → `useIdTokenAuthRequest` gets `undefined` → no valid Android OAuth client for the standalone build.

**The blocker:** a correct Android client needs package name `com.anonymous.mobile` + the **SHA-1 of the keystore that signs the APK** (the EAS-managed keystore). Editing the broken client to `com.anonymous.mobile` + the old SHA-1 `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25` fails with "Requested entity already exists" — a soft-deleted client (restorable ~30 days) still holds that package+SHA-1 combo.

**Resolution (needs Pratham's SHA-1 first):**
1. Pratham runs `eas credentials` (Android) → reports the EAS keystore **SHA-1**.
2. If it equals `5E:8F:...:F6:25` → restore the soft-deleted Android client; use its Client ID.
3. If it differs (most likely) → create a fresh Android client: package `com.anonymous.mobile` + that SHA-1 (unique combo, saves clean). Delete the two junk Android entries afterward.
4. Roshini also adds the same SHA-1 to Firebase → Project settings → Android app → Add fingerprint.
5. Put the resulting Android Client ID into `mobile/src/config/google.ts` as `androidClientId`, commit via PR to `dev`.
6. Pratham rebuilds and tests Google Sign-In on the installed APK.

> Since the manager is on Android, only the Android client matters for this APK. The iOS client is irrelevant to the demo.

## 2.5 Build the APK

Your `eas.json` already defines a `preview` profile with `distribution: internal` — exactly right for a manager handoff:

```bash
cd mobile
npx eas build -p android --profile preview
```

EAS builds in the cloud (a few minutes) and prints a **download URL + QR code**. The `preview` profile produces an installable artifact you can sideload without the Play Store.

## 2.6 Test end-to-end before sharing

Install on a real Android device and run the whole flow against Roshini's deployed backend:

- Sign up / Google login succeeds
- Onboarding chat completes
- Voice coach connects and responds (confirms WS + Gemini/Deepgram/ElevenLabs work)
- A workout bundle loads and a session can be completed

Only proceed once this works. A broken APK in front of a manager is worse than a recorded demo.

## 2.7 Share with the manager

Send the EAS build link (or QR). On their Android device they:
1. Open the link, download the APK.
2. Allow "install from unknown sources" if prompted.
3. Install and open.

Include a one-line note: "Requires Android; allow install from unknown sources. Backend is a test deployment."

---

# Common failure modes

| Symptom | Cause | Fix |
|---------|-------|-----|
| App opens, login/API does nothing | `API_BASE_URL` still placeholder, or `.env` missing | Steps 2.1 / 2.2 |
| Google login works in Expo Go, fails in APK | SHA-1 not registered | Step 2.4 |
| Voice coach never connects | Host doesn't support WebSockets, or Gemini/Deepgram/ElevenLabs keys unset | Steps 1.1 / 1.3 |
| "Exercise library is empty" | DB not seeded | Step 1.4 |
| 401 on every request | Firebase admin env vars wrong on server (check `\n` in private key) | Step 1.3 |
| Backend sleeps / URL changes | Free tier cold start or ngrok tunnel | Use a persistent host (1.1) |
| Build fails: `TS7016 Could not find declaration file for 'express'` | `NODE_ENV=production` made npm skip devDeps (`@types/*`, `typescript`) | Build command `npm install --include=dev && npm run build` |
| Build fails: `TS5102 Option 'baseUrl' has been removed` | Newer TypeScript dropped standalone `baseUrl` | Already fixed in `server/tsconfig.json` (removed unused `baseUrl`/`paths`) |
| Merge to `dev` doesn't auto-deploy | Render lacks GitHub repo access (no webhooks) | Grant repo access, or use Manual Deploy |

---

# Decisions to make together first

1. **Whose Expo account** owns the build (affects EAS access in 2.3).
2. **Whose Firebase / Google Cloud project** the OAuth client lives in (affects who can do 2.4).
3. **Which host** for the backend, and who pays for / owns the deployment.
