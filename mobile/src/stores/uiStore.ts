import { create } from 'zustand';

interface UIStore {
  /** When true, the floating tab bar is hidden (e.g. during an active workout focus mode). */
  hideTabBar: boolean;
  setHideTabBar: (value: boolean) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  hideTabBar: false,
  setHideTabBar: (value) => set({ hideTabBar: value }),
}));
