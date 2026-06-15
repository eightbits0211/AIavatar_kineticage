import { create } from 'zustand';

interface GamificationStore {
  totalXp: number;
  level: number;
  currentStreak: number;
  longestStreak: number;

  setGamificationData: (data: {
    total_xp: number;
    level: number;
    current_streak: number;
    longest_streak: number;
  }) => void;
  addXp: (amount: number) => void;
  incrementStreak: () => void;
  resetStreak: () => void;
}

export const useGamificationStore = create<GamificationStore>((set, get) => ({
  totalXp: 0,
  level: 1,
  currentStreak: 0,
  longestStreak: 0,

  setGamificationData: (data) =>
    set({
      totalXp: data.total_xp,
      level: data.level,
      currentStreak: data.current_streak,
      longestStreak: data.longest_streak,
    }),

  addXp: (amount) => {
    const newTotal = get().totalXp + amount;
    const newLevel = Math.floor(newTotal / 500) + 1;
    set({ totalXp: newTotal, level: newLevel });
  },

  incrementStreak: () => {
    const newStreak = get().currentStreak + 1;
    const longest = Math.max(newStreak, get().longestStreak);
    set({ currentStreak: newStreak, longestStreak: longest });
  },

  resetStreak: () => set({ currentStreak: 0 }),
}));
