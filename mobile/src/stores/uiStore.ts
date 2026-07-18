import { create } from 'zustand';

interface UIStore {
  /** When true, the floating tab bar is hidden (e.g. during an active workout focus mode). */
  hideTabBar: boolean;
  setHideTabBar: (value: boolean) => void;

  /**
   * Cross-tab request to open the workout History drawer. The drawer lives in
   * HomeScreen (AI Coach tab), so the Profile tab's "Workouts" stat sets this
   * flag and navigates to the AI Coach tab; HomeScreen consumes it on focus and
   * opens the drawer, then clears the flag.
   */
  pendingOpenHistory: boolean;
  setPendingOpenHistory: (value: boolean) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  hideTabBar: false,
  setHideTabBar: (value) => set({ hideTabBar: value }),

  pendingOpenHistory: false,
  setPendingOpenHistory: (value) => set({ pendingOpenHistory: value }),
}));
