import { create } from 'zustand';
import { UserProfile } from '../../../shared/types';

interface UserStore {
  /** The MongoDB user profile (null until hydrated from the backend). */
  user: UserProfile | null;
  /** Firebase UID of the currently signed-in user. */
  firebaseUid: string | null;
  /** True once Firebase has a signed-in user. */
  isAuthenticated: boolean;
  /** True once the user has finished onboarding (persona + metrics assigned). */
  isOnboarded: boolean;
  /** True while the initial Firebase auth state is being resolved on app launch. */
  isInitializing: boolean;

  setUser: (user: UserProfile | null) => void;
  setFirebaseUid: (uid: string | null) => void;
  setAuthenticated: (value: boolean) => void;
  setOnboarded: (value: boolean) => void;
  setInitializing: (value: boolean) => void;
  logout: () => void;
}

export const useUserStore = create<UserStore>((set) => ({
  user: null,
  firebaseUid: null,
  isAuthenticated: false,
  isOnboarded: false,
  isInitializing: true,

  setUser: (user) =>
    set({
      user,
      isOnboarded: !!user?.onboarding_completed,
    }),
  setFirebaseUid: (firebaseUid) => set({ firebaseUid }),
  setAuthenticated: (value) => set({ isAuthenticated: value }),
  setOnboarded: (value) => set({ isOnboarded: value }),
  setInitializing: (value) => set({ isInitializing: value }),
  logout: () =>
    set({
      user: null,
      firebaseUid: null,
      isAuthenticated: false,
      isOnboarded: false,
    }),
}));
