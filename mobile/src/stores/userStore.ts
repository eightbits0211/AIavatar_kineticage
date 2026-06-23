import { create } from 'zustand';
import { UserProfile } from '../../../shared/types';

interface UserStore {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isOnboarded: boolean;

  setUser: (user: UserProfile) => void;
  setAuthenticated: (value: boolean) => void;
  setOnboarded: (value: boolean) => void;
  logout: () => void;
}

export const useUserStore = create<UserStore>((set) => ({
  user: null,
  isAuthenticated: false,
  isOnboarded: false,

  setUser: (user) => set({ user, isOnboarded: user.onboarding_completed }),
  setAuthenticated: (value) => set({ isAuthenticated: value }),
  setOnboarded: (value) => set({ isOnboarded: value }),
  logout: () => set({ user: null, isAuthenticated: false, isOnboarded: false }),
}));
