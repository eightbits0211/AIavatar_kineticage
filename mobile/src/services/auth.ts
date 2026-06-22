import {
  signInWithCustomToken,
  signInWithCredential,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  GoogleAuthProvider,
  onIdTokenChanged,
  signOut,
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
 * Safe to call once a valid auth token is set.
 */
export async function hydrateUserProfile(): Promise<void> {
  try {
    const profile = await apiGet<UserProfile>('/api/profile');
    useUserStore.getState().setUser(profile);
  } catch (error) {
    // A brand-new user may not have a profile row yet; that's fine — onboarding
    // will create/complete it. Don't crash auth on a missing profile.
    if (__DEV__) console.warn('hydrateUserProfile failed:', error);
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
 * flow (expo-auth-session). Exchanges it for a Firebase credential, then
 * creates/fetches the backend profile.
 */
export async function signInWithGoogleIdToken(idToken: string): Promise<GoogleAuthResponse> {
  const credential = GoogleAuthProvider.credential(idToken);
  const result = await signInWithCredential(auth, credential);

  // Ensure the API token is set before calling our backend.
  await getFreshToken();

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
 * Email/password registration. Creates the Firebase user, sets the display
 * name, then creates the backend profile.
 */
export async function registerWithEmail(
  name: string,
  email: string,
  password: string
): Promise<void> {
  const result = await createUserWithEmailAndPassword(auth, email.trim(), password);

  if (name.trim()) {
    await updateProfile(result.user, { displayName: name.trim() });
  }

  await getFreshToken();

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
