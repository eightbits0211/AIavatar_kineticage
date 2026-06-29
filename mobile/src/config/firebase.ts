import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeAuth,
  getAuth,
  browserLocalPersistence,
  // @ts-expect-error — getReactNativePersistence is exported at runtime but
  // missing from some firebase type bundles. Safe to use in React Native.
  getReactNativePersistence,
} from 'firebase/auth';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Firebase web SDK configuration.
 *
 * These values are NOT secret — the Firebase web config is shipped to clients
 * by design. They are hardcoded so anyone who clones the repo gets auth
 * working without needing a .env file.
 */
export const firebaseConfig = {
  apiKey: 'AIzaSyBDoRZHeb1OKP2KeVXmJ5xShp4yfV2i7ko',
  authDomain: 'aiavatar-de201.firebaseapp.com',
  projectId: 'aiavatar-de201',
  storageBucket: 'aiavatar-de201.firebasestorage.app',
  messagingSenderId: '443799818657',
  appId: '1:443799818657:web:091ba33b17c9bf45127be0',
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
 * Initialize Auth with the right persistence for the platform:
 *  - Web: browserLocalPersistence (getReactNativePersistence does not exist in
 *    the firebase web build and throws if called).
 *  - Native: AsyncStorage persistence so the session survives app restarts.
 * initializeAuth must run exactly once; if it has already been initialized
 * (e.g. fast refresh), fall back to getAuth.
 */
function createAuth() {
  try {
    return initializeAuth(app, {
      persistence:
        Platform.OS === 'web'
          ? browserLocalPersistence
          : getReactNativePersistence(AsyncStorage),
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
