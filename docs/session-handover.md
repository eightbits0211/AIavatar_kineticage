# Kinetic Age Mobile — Session Handover

_Last updated: 2026-07-16. Owner: Pratham. Scope: `mobile/` (Expo/React Native)._

This is the running handover for the mobile app. Read this first in any new
chat. It captures what's done, what's in flight, current issues, preferences,
and the hard rules (git, build, keystore).

---

## 1. Project facts (memorize)

- **Monorepo root:** `AIavatar_kineticage/` (workspace opens one level up at `AI Avatar/`).
- **App:** `mobile/` — Expo SDK 56, RN 0.85.3. Package `com.kineticage.app`.
- **Backend:** `server/` — LIVE at `https://aiavatar-kineticage.onrender.com` (owned by Roshini). Free tier → ~50s cold start after idle.
- **Firebase project:** `aiavatar-de201`.
- **EAS project:** `@losttadpole/mobile` (`938c521e-11d3-4f63-95f7-82741f068139`). Owned by Pratham's **losttadpole EAS account** — this is SEPARATE from and unrelated to the (removed) GitHub fork. EAS = fine to use; GitHub losttadpole = never touch.
- **Android keystore (stable):** `n6g-sM9Orq`, SHA-1 `A5:8A:82:DF:F6:CE:2D:08:52:42:AC:50:DE:73:E5:2E:AA:26:D1:0A`. Registered by Roshini on the `com.kineticage.app` Android OAuth client. Do NOT let EAS rotate it — always confirm this keystore is used after a build.

---

## 2. Git rules (STRICT — from `docs/development-workflow.md`)

- **One remote only:** `origin = https://github.com/eightbits0211/AIavatar_kineticage.git`. The old losttadpole fork remote was removed. Never reference losttadpole for git.
- Never commit on `dev` directly. Branch off `dev`; rebase feature branch onto `dev`; `git push --force-with-lease`; open PRs → `dev`.
- **Current working branch: `build_1`** (tracks `origin/build_1`).
- Open PRs: #70 (`fix/final-bug-fixing` → `dev`) — was open, verify state.
- **Do NOT commit:** the gitignored `.expo/` cache, or the stray `Exercise Recommendation Logic text.txt`. When told "commit everything", stage only real source/doc changes explicitly.
- "commit and push everything and pull latest" = commit real work → push → fetch `dev` → rebase branch → force-push-with-lease.

---

## 3. Build & OTA (EAS)

- **Build cmd:** `eas build --platform android --profile preview --non-interactive --message "..."` — run with `cwd = mobile/`.
- Native builds ~15–20 min. Poll: `eas build:view <id> --json > bs.json` then read `.status`.
- `eas.json` profiles: `preview` (`distribution: internal`, `channel: preview`), `production` (`autoIncrement`, `channel: production`).
- **After every build, confirm the log says `Using Keystore ... n6g-sM9Orq`** so Google Sign-In SHA-1 stays valid.
- **EAS env vars:** all 7 `EXPO_PUBLIC_*` are set on the `preview` environment on EAS.

### OTA (EAS Update) — NOW ENABLED
- `expo-updates` installed. `app.json` has `runtimeVersion: { policy: "appVersion" }` (currently `1.0.0`) and `updates.url = https://u.expo.dev/938c521e-11d3-4f63-95f7-82741f068139`.
- The build `f64c5de8-...` (from `build_1`) is the **OTA baseline** — it created the `preview` channel/branch.
- **Push JS/asset-only changes without rebuilding:** `eas update --branch preview --message "..."` (run in `mobile/`). Applies to devices running a build with the same runtimeVersion (`1.0.0`).
- **Rebuild required** for: native module changes, `app.json` native config, SDK bumps, or bumping `version` (changes runtimeVersion → old builds stop receiving updates).
- Both the mic/voice logic AND the UI fixes are JS → OTA-updatable once devices run an OTA-capable build.

### Terminal quirks (Windows cmd)
- `execute_pwsh` prepends `cd "path" ;`. Reliable pattern: pass `cwd = ...\mobile`.
- Avoid piping build output through `more` (it blocks). Redirect to a temp file and `type` it, then delete the temp file.
- EAS build log files use non-standard compression — can't decode locally. To reproduce Metro/bundle errors locally: `npx expo export --platform android --output-dir dist-verify` (then delete the dir). This is the pre-build sanity check.

---

## 4. Issue status

### Issue 1 — Google Sign-In on APK — RESOLVED (config-side)
- Native lib `@react-native-google-signin/google-signin` wired; `signInWithGoogleIdToken(idToken)` in `auth.ts` unchanged. Web redirect flow kept as fallback.
- SHA-1 (keystore `n6g-sM9Orq`) registered on `com.kineticage.app`. `androidClientId` `443799818657-s7bvo18...` in `mobile/src/config/google.ts`.
- Email/guest login is the safe demo fallback either way.

### Issue 3 — Voice/audio (native) — FIX SHIPPED, needs device confirmation
- Root cause of original silence: voice path was web-only (`webVoiceLive.ts`). Added native path.
- **Files:** `mobile/src/services/nativeVoiceLive.ts` (uses `react-native-audio-api`), `voiceLive.ts` (platform factory), wired into `HomeScreen.tsx` + `OnboardingChatScreen.tsx`.
- Native deps: `react-native-audio-api@0.13.1` + `react-native-gesture-handler` + `react-native-reanimated` (last two required transitively or Metro bundling fails).
- **Verified locally against the installed lib's types:** `AudioRecorder.onAudioReady(opts, cb)` delivers `event.buffer` as an `AudioBuffer` with `.sampleRate` + `.getChannelData(0)` — exactly what the code uses. Protocol (JSON `realtimeInput.audio` frames, PCM16, `serverContent` handling) matches `webVoiceLive.ts` byte-for-byte.
- **Key fix:** mic hardware delivers 44.1/48 kHz; code now reads actual `buffer.sampleRate` and `resampleTo16k()` before sending (Gemini Live needs 16 kHz). Playback at 24 kHz with try/catch fallback + `resume()`.
- **On-screen diagnostics (via `opts.onNotice`)** to pinpoint device behavior on next test:
  - `🎙️ mic capturing at N Hz` — capture is flowing. If this NEVER shows → `onAudioReady` isn't firing (try RecorderAdapterNode/graph mode).
  - `🔊 receiving Kin audio…` — model audio arriving. Shows but silent → output/playback issue. Never shows (but mic did) → still an input-format issue.
- Cannot be device-tested from here. Next device test + these two messages will localize any remaining problem.

### Issue 2 — (backend/preferences) — parked
- Backend confirmed healthy by Roshini (Gemini text, ElevenLabs TTS, Gemini Live WS all work on local + Render). Not a server outage.

---

## 5. Frontend responsive work — DONE (this session) + principles

Cross-device fixes (dynamic, not fixed dimensions):
- **Tab bar** (`MainTabs.tsx`): `useWindowDimensions()` (reactive) instead of module-level `Dimensions.get()`.
- **Squashed numbers:** `DashboardScreen.tsx` MetricTile + SummaryCard, and `components/MetricCard.tsx` values → `numberOfLines={1} adjustsFontSizeToFit minimumFontScale`. MetricCard value row uses `flexShrink` so value+unit don't overflow (e.g. "1800 – 2200 kcal/day").
- **Name/email overflow:** `HomeScreen.tsx` greeting name, `ProfileScreen.tsx` name+email hardened.
- **Keyboard covering input:** HomeScreen (both normal + focus layouts) wrapped in `KeyboardAvoidingView`. Onboarding + Login already had it. (Dashboard "today's weight" input still NOT wrapped — minor, optional.)
- `app.json` locks `orientation: portrait`, so module-level `Dimensions.get()` in `SettingsSheet.tsx`, `EditProfileModal.tsx`, `HistoryDrawer.tsx` is SAFE (can't rotate).

Still open / optional:
- Wrap Dashboard weight input in `KeyboardAvoidingView`.
- **BMI shows 207.3 — real CALCULATION bug** (valid BMI ~18–30, likely height cm-vs-metres units). Display is hardened but the number is wrong. Not yet fixed. Separate from squashing.
- Broader sweep of fixed heights that could clip on very small screens.

**Cross-device principle (explained to user):** design in relative/flex units, use `useWindowDimensions`, `adjustsFontSizeToFit`/`numberOfLines` for text, `KeyboardAvoidingView` for inputs, safe-area insets, and test on multiple aspect ratios — web looking fine ≠ device fine because of DPI/aspect/keyboard differences.

---

## 6. How to distribute for testing (answer to "how do others test it")

- **Internal distribution build** (current `preview` profile): the EAS build page gives an install link + QR:
  `https://expo.dev/accounts/losttadpole/projects/mobile/builds/<id>`
  Anyone on Android opens that link → downloads/installs the APK directly. No Play Store needed.
- Latest build to share: `f64c5de8-3ffb-4e4c-bfec-fea27bba95e7`.
- **Roshini / testers:** send them the build link. For repeat testers, after this baseline you can push JS fixes via `eas update --branch preview` and they get them on next app launch (no reinstall).
- Warm the backend first (open app or hit `/health`) to avoid the ~50s Render cold start on first connect.

---

## 7. Current repo state (end of session)

- Branch `build_1`, pushed to `origin/build_1`.
- Latest commits: `6a8c58c` (EAS Update + responsive text hardening), `37487f9` (mic resample + diagnostics), `e1db461` (keyboard/tab-bar/numbers).
- Build `f64c5de8-...` succeeded (OTA baseline, keystore `n6g-sM9Orq`).
- `npx expo export` bundled clean (1622 modules) before build — no Metro errors.

## 8. Immediate next steps for a new chat
1. Device-test build `f64c5de8`: check the two voice diagnostics to localize any remaining audio issue; confirm Google Sign-In works.
2. If voice still fails, act on which diagnostic appeared (see Issue 3).
3. Fix the BMI 207.3 calculation (units) bug.
4. For any JS-only fix after this: `eas update --branch preview` instead of a full rebuild.
5. Keep following the git rules in §2.
