# KineticAge — Demo Links & Handover (Backend)

**Owner:** Roshini Kotte (backend)
**Last verified:** 15 July 2026
**Live backend:** `https://aiavatar-kineticage.onrender.com` (Render, branch `dev`)

---

## 1. Live demo links (open in a browser)

These pages are served by the live backend and exercise the real production API — no install needed.

| What | Link |
|------|------|
| 🎙️ Voice coach (full live experience) | https://aiavatar-kineticage.onrender.com/voice-live.html |
| 💬 Text + voice quick demo | https://aiavatar-kineticage.onrender.com/voice-demo.html |
| 🏋️ Exercise library (animated GIFs) | https://aiavatar-kineticage.onrender.com/exercise-preview.html |
| ✅ Health check | https://aiavatar-kineticage.onrender.com/health |

**How to demo the voice coach:** open `voice-live.html` → sign in (Guest or Google) → allow microphone → talk to Kin.

> ⚠️ **Cold start:** the free-tier server sleeps when idle and the first request can take **up to ~90s** to wake. **Open the voice page or hit `/health` ~1–2 minutes before demoing** so it's warm. Once awake, responses are fast (~0.3s health, ~2s AI replies).

---

## 2. Live deployment verification (15 July 2026)

Tested against the live Render deployment:

| Path | Result |
|------|--------|
| `/health` (warm) | ✅ ok, ~0.27s |
| Text chat (Gemini 2.5 Flash) | ✅ complete reply, ~2.3s |
| Text-to-speech (ElevenLabs `eleven_flash_v2_5`) | ✅ audio returned |
| Voice (Gemini Live WebSocket proxy) | ✅ connects + responds |
| Demo pages (voice-live / voice-demo / exercise-preview) | ✅ HTTP 200 |

Backend is complete, deployed, and confirmed working end-to-end.

---

## 3. Known open item — Google Sign-In on the Android APK (frontend)

Google sign-in works on the **web**; it errors inside the standalone APK. This is a client-side OAuth issue, not backend. `/api/auth/google` runs only after Firebase auth succeeds and uses the same middleware as guest/email login (which work), so the server side is confirmed fine.

**Demo fallback that works today:** email/password and **Continue as Guest** login. Both exercise the full app.

### Fix plan (for the mobile owner)

**Step 0 — Capture the exact error first.**
`LoginScreen.tsx` already logs `clientId` and `redirectUri`. Reproduce on an Android device with logs (`adb logcat`) and note the error string (`invalid_client`, `DEVELOPER_ERROR`, `redirect_uri_mismatch`, etc.). The fix depends on which one it is.

**Step 1 — Verify config (no rebuild).**
- `androidClientId` in `mobile/src/config/google.ts` = `…s7bvo18…` (set).
- Firebase + Google Cloud for package `com.kineticage.app` must have the **SHA-1 of the keystore that actually signed the installed APK**. Check via `eas credentials` → Android → SHA-1, and confirm it matches. A stale/mismatched SHA is the most common cause.

**Step 2 — Likely real fix: switch to the native library.**
The app uses `expo-auth-session`'s Google provider (web-redirect flow), which is fragile in standalone APKs. Migrate to `@react-native-google-signin/google-signin`, which uses the Android OAuth client + SHA-1 directly (no web redirect).

This is a **small** change because `auth.ts`'s `signInWithGoogleIdToken(idToken)` already does the Firebase + backend work — only the token source changes:
```
await GoogleSignin.hasPlayServices();
const { idToken } = await GoogleSignin.signIn();
await signInWithGoogleIdToken(idToken);   // existing function, unchanged
```
1. Install `@react-native-google-signin/google-signin` (+ its Expo config plugin in `app.json`), configure with the **web** client ID.
2. Replace `useIdTokenAuthRequest` / `promptAsync` in `LoginScreen.tsx` with the snippet above.
3. Keep the SHA-1 registered for `com.kineticage.app`.
4. New EAS build (native dependency → rebuild required), then device-test.

`auth.ts` and the backend stay unchanged.

---

## 4. Known open item — Live voice in the APK (frontend)

Live voice works on the **web** but doesn't capture/play audio inside the Android APK: the mobile voice code uses browser audio APIs (`getUserMedia` / Web `AudioContext`), which don't exist natively, and no native audio path was wired up. Fix is a native audio integration (e.g. `react-native-audio-api`) mirroring the existing web client, gated by `Platform.OS`. **No backend changes** — the server voice proxy, Gemini Live, and TTS are all verified working.

---

## 5. Post-demo follow-ups (non-blocking)

- Rotate any API keys / credentials that were shared during development (MongoDB, Firebase admin, Gemini/Deepgram/ElevenLabs).
- Confirm Render auto-deploys the latest `dev` (includes the ElevenLabs `eleven_flash_v2_5` TTS fix).
