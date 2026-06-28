import {
  signInWithCustomToken,
  signInWithCredential,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  linkWithCredential,
  updateProfile,
  EmailAuthProvider,
  GoogleAuthProvider,
  onIdTokenChanged,
  signOut,
  type AuthCredential,
  type User as FirebaseUser,
} from 'firebase/auth';

import { auth } from '../config/firebase';
import { apiGet, apiPost, setAuthToken } from './api';
import { useUserStore } from '../stores/userStore';
import type { UserProfile } from '../../../shared/types';

// ─────────────────────────────────────────────────────────────
// Backend response shapes (auth routes)
// ─────────────────────────────────────────────────────────────

interface GuestResponse {
  token: string;
  uid: string;
  is_guest: boolean;
  message: string;
}

interface GoogleAuthResponse {
  user: UserProfile;
  is_new: boolean;
}

interface UpgradeResponse {
  message: string;
  user: UserProfile;
}

// ─────────────────────────────────────────────────────────────
// Token management
// ─────────────────────────────────────────────────────────────

/**
 * Returns a fresh Firebase ID token for the current user, forcing a refresh
 * when requested. Firebase auto-refreshes tokens, but this is useful before a
 * critical request. Returns null if no user is signed in.
 */
export async function getFreshToken(forceRefresh = false): Promise<string | null> {
  const current = auth.currentUser;
  if (!current) return null;
  const token = await current.getIdToken(forceRefresh);
  setAuthToken(token);
  return token;
}

/**
 * Fetches the MongoDB user profile from the backend and stores it.
 * If no profile exists yet for the signed-in Firebase user (e.g. the account
 * was created but the profile row is missing), it self-heals by creating one,
 * then re-fetching. This guarantees onboarding's PUT /api/profile has a row to
 * update. Safe to call once a valid auth token is set.
 */
export async function hydrateUserProfile(): Promise<void> {
  try {
    const profile = await apiGet<UserProfile>('/api/profile');
    useUserStore.getState().setUser(profile);
  } catch {
    // No profile row yet — create one for this Firebase user, then re-fetch.
    try {
      const current = auth.currentUser;
      await apiPost('/api/profile/create', {
        name: current?.displayName ?? '',
        email: current?.email ?? '',
      });
      const profile = await apiGet<UserProfile>('/api/profile');
      useUserStore.getState().setUser(profile);
    } catch (createError) {
      if (__DEV__) console.warn('hydrateUserProfile: could not create profile:', createError);
    }
  }
}

/**
 * Registers the global Firebase auth listener. Keeps the API auth token fresh
 * and syncs the Zustand user store with Firebase auth state. Call once at app
 * startup. Returns an unsubscribe function.
 */
export function initAuthListener(): () => void {
  const store = useUserStore.getState();

  try {
    return onIdTokenChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        const token = await firebaseUser.getIdToken();
        setAuthToken(token);
        store.setFirebaseUid(firebaseUser.uid);
        store.setAuthenticated(true);
        await hydrateUserProfile();
      } else {
        setAuthToken(null);
        store.logout();
      }
      store.setInitializing(false);
    });
  } catch (error) {
    // Firebase config error (likely placeholder values)
    if (__DEV__) {
      console.error('Firebase auth initialization failed:', error);
    }
    
    // Set not initializing so app doesn't hang on loading screen
    store.setInitializing(false);
    
    // Return no-op unsubscribe
    return () => {};
  }
}

// ─────────────────────────────────────────────────────────────
// Sign-in flows
// ─────────────────────────────────────────────────────────────

/**
 * Guest sign-in. The backend creates an anonymous Firebase user + MongoDB
 * profile and returns a custom token, which we exchange for a session.
 */
export async function signInAsGuest(): Promise<void> {
  const { token } = await apiPost<GuestResponse>('/api/auth/guest', {});
  await signInWithCustomToken(auth, token);
  // onIdTokenChanged will set the token and hydrate the profile.
}

/**
 * Completes Google sign-in using an ID token obtained from the Google OAuth
 * flow (expo-auth-session).
 *
 * If a guest (anonymous) user is currently signed in, the Google credential is
 * *linked* to that existing Firebase account so its `firebase_uid` — and all
 * the MongoDB data keyed to it (onboarding, sessions, progress) — is preserved.
 * The backend record is then upgraded from guest to a full account.
 *
 * Otherwise (no active session, or a non-anonymous user), it performs a normal
 * Google sign-in and creates/fetches the backend profile.
 */
export async function signInWithGoogleIdToken(idToken: string): Promise<GoogleAuthResponse> {
  const credential = GoogleAuthProvider.credential(idToken);
  const current = auth.currentUser;

  // Guest upgrade path: link Google to the existing anonymous account.
  if (current?.isAnonymous) {
    try {
      const result = await linkWithCredential(current, credential);

      // Token now reflects the upgraded (non-anonymous) user.
      await getFreshToken(true);

      const response = await apiPost<UpgradeResponse>('/api/auth/upgrade', {
        name: result.user.displayName ?? '',
        email: result.user.email ?? '',
      });

      useUserStore.getState().setUser(response.user);
      return { user: response.user, is_new: false };
    } catch (error: any) {
      // The Google identity already owns a separate Firebase account, so it
      // can't be merged into this guest. Fall back to signing in to that
      // existing account. The guest's data stays under the old uid — that's
      // unavoidable, since two distinct accounts already exist.
      if (error?.code === 'auth/credential-already-in-use') {
        return signInAndFetchGoogleProfile(credential);
      }
      throw error;
    }
  }

  // No guest session — straightforward Google sign-in.
  return signInAndFetchGoogleProfile(credential);
}

/**
 * Signs in with a Google credential (replacing any current session) and
 * creates or fetches the backend profile via POST /api/auth/google.
 */
async function signInAndFetchGoogleProfile(
  credential: AuthCredential
): Promise<GoogleAuthResponse> {
  const result = await signInWithCredential(auth, credential);

  // Ensure the API token is set before calling our backend.
  await getFreshToken(true);

  const response = await apiPost<GoogleAuthResponse>('/api/auth/google', {
    name: result.user.displayName ?? '',
    email: result.user.email ?? '',
  });

  useUserStore.getState().setUser(response.user);
  return response;
}

/**
 * Email/password sign-in. Profile hydration is handled by the auth listener.
 */
export async function signInWithEmail(email: string, password: string): Promise<void> {
  await signInWithEmailAndPassword(auth, email.trim(), password);
}

/**
 * Email/password registration.
 *
 * If a guest (anonymous) user is currently signed in, the email/password
 * credential is *linked* to that account so the existing `firebase_uid` — and
 * all the data keyed to it — is preserved, then the backend record is upgraded
 * from guest to a full account.
 *
 * Otherwise, it creates a brand-new Firebase user and backend profile.
 */
export async function registerWithEmail(
  name: string,
  email: string,
  password: string
): Promise<void> {
  const current = auth.currentUser;

  // Guest upgrade path: link the email credential to the existing anonymous
  // account instead of creating a fresh one.
  if (current?.isAnonymous) {
    const credential = EmailAuthProvider.credential(email.trim(), password);

    // Throws auth/email-already-in-use if the email already owns an account;
    // friendlyAuthError surfaces a sensible message to the caller.
    const result = await linkWithCredential(current, credential);

    if (name.trim()) {
      await updateProfile(result.user, { displayName: name.trim() });
    }

    await getFreshToken(true);

    await apiPost<UserProfile>('/api/auth/upgrade', {
      name: name.trim(),
      email: email.trim(),
    });
    // Listener will hydrate the upgraded profile.
    return;
  }

  const result = await createUserWithEmailAndPassword(auth, email.trim(), password);

  if (name.trim()) {
    await updateProfile(result.user, { displayName: name.trim() });
  }

  await getFreshToken(true);

  await apiPost<UserProfile>('/api/profile/create', {
    name: name.trim(),
    email: email.trim(),
  });
  // Listener will hydrate the freshly created profile.
}

/**
 * Signs the current user out of Firebase and clears local state.
 */
export async function signOutCurrentUser(): Promise<void> {
  await signOut(auth);
  setAuthToken(null);
  useUserStore.getState().logout();
}

/**
 * Maps Firebase auth error codes to friendly, user-facing messages.
 */
export function friendlyAuthError(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code: unknown }).code)
      : '';

  switch (code) {
    case 'auth/invalid-email':
      return 'That email address looks invalid.';
    case 'auth/email-already-in-use':
      return 'An account already exists with that email.';
    case 'auth/weak-password':
      return 'Please choose a password with at least 6 characters.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Incorrect email or password.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.';
    default:
      return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
  }
}
