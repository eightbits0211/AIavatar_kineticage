import { create } from 'zustand';
import { SessionState, SessionExercise, SessionExerciseSet } from '../../../shared/types';

interface SessionStore {
  // State machine
  currentState: SessionState;
  setState: (state: SessionState) => void;

  // Session data
  sessionId: string | null;
  exercises: SessionExercise[];
  currentExerciseIndex: number;
  currentSetIndex: number;

  // Actions
  startSession: (sessionId: string, exercises: SessionExercise[]) => void;
  nextExercise: () => void;
  nextSet: () => void;
  completeSet: (data: Partial<SessionExerciseSet>) => void;
  endSession: () => void;
  reset: () => void;
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  // Initial state
  currentState: 'idle',
  sessionId: null,
  exercises: [],
  currentExerciseIndex: 0,
  currentSetIndex: 0,

  setState: (state) => set({ currentState: state }),

  startSession: (sessionId, exercises) =>
    set({
      sessionId,
      exercises,
      currentState: 'session_starting',
      currentExerciseIndex: 0,
      currentSetIndex: 0,
    }),

  nextExercise: () => {
    const { currentExerciseIndex, exercises } = get();
    if (currentExerciseIndex < exercises.length - 1) {
      set({
        currentExerciseIndex: currentExerciseIndex + 1,
        currentSetIndex: 0,
        currentState: 'exercise_intro',
      });
    } else {
      set({ currentState: 'session_summary' });
    }
  },

  nextSet: () => {
    const { currentSetIndex, exercises, currentExerciseIndex } = get();
    const currentExercise = exercises[currentExerciseIndex];
    if (currentExercise && currentSetIndex < currentExercise.sets.length - 1) {
      set({
        currentSetIndex: currentSetIndex + 1,
        currentState: 'set_active',
      });
    } else {
      // All sets done for this exercise
      const { currentExerciseIndex: idx, exercises: exs } = get();
      if (idx < exs.length - 1) {
        set({ currentState: 'exercise_intro' });
      } else {
        set({ currentState: 'session_summary' });
      }
    }
  },

  completeSet: (data) => {
    const { exercises, currentExerciseIndex, currentSetIndex } = get();
    const updated = [...exercises];
    if (updated[currentExerciseIndex]) {
      updated[currentExerciseIndex].sets[currentSetIndex] = {
        ...updated[currentExerciseIndex].sets[currentSetIndex],
        ...data,
        completed_at: new Date(),
      };
    }
    set({ exercises: updated });
  },

  endSession: () =>
    set({
      currentState: 'session_summary',
    }),

  reset: () =>
    set({
      currentState: 'idle',
      sessionId: null,
      exercises: [],
      currentExerciseIndex: 0,
      currentSetIndex: 0,
    }),
}));
