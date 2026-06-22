import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeAuth,
  getAuth,
  // @ts-expect-error — getReactNativePersistence is exported at runtime but
  // missing from some firebase type bundles. Safe to use in React Native.
  getReactNativePersistence,
} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Firebase web SDK configuration.
 *
 * These values are NOT secret — the Firebase web config is shipped to clients
 * by design. They are read from EXPO_PUBLIC_* env vars (inlined at build time)
 * so they stay out of source control. See mobile/.env.example.
 *
 * To run auth locally, create a mobile/.env file with the values from the
 * Firebase console → Project settings → Your apps → Web app config.
 */
export const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? '',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? '',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '',
};

// Check for placeholder values in development
if (__DEV__) {
  const hasPlaceholders = Object.values(firebaseConfig).some(
    (value) => !value || value.includes('placeholder')
  );
  
  if (hasPlaceholders) {
    console.warn(
      '🔥 Firebase config contains placeholders. Auth features will not work.\n' +
      'To fix: Update mobile/.env with real Firebase config values from the Firebase console.'
    );
  }
}

// Initialize (or reuse) the Firebase app singleton.
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

/**
 * Initialize Auth with AsyncStorage persistence so the user stays signed in
 * across app restarts. initializeAuth must run exactly once; if it has already
 * been initialized (e.g. fast refresh), fall back to getAuth.
 */
function createAuth() {
  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch (error) {
    if (__DEV__) {
      console.warn('initializeAuth failed, falling back to getAuth:', error);
    }
    return getAuth(app);
  }
}

export const auth = createAuth();
export default app;
