import { create } from 'zustand';
import type { 
  FitnessGoal, 
  ActivityLevel, 
  Gender, 
  WorkoutLocation, 
  Equipment, 
  InjuryArea,
  WorkoutDuration,
  Talkativeness 
} from '../../../shared/types';

export type OnboardingStep = 
  | 'welcome'
  | 'name' 
  | 'age'
  | 'height'
  | 'weight'
  | 'fitness_level'
  | 'goals'
  | 'activity_level' 
  | 'location'
  | 'equipment'
  | 'injuries'
  | 'duration'
  | 'experience'
  | 'preferences'
  | 'complete';

export interface ChatMessage {
  id: string;
  role: 'kin' | 'user';
  content: string;
  timestamp: Date;
}

export interface OnboardingData {
  name: string;
  age: number | null;
  height_cm: number | null;
  weight_kg: number | null;
  fitness_level: 'beginner' | 'intermediate' | 'advanced' | null;
  fitness_goal: FitnessGoal | null;
  activity_level: ActivityLevel | null;
  workout_location: WorkoutLocation | null;
  equipment: Equipment[];
  injuries: InjuryArea[];
  injury_notes: string;
  workout_duration: WorkoutDuration | null;
  prior_program_experience: boolean | null;
  talkativeness: Talkativeness | null;
}

interface OnboardingStore {
  currentStep: OnboardingStep;
  messages: ChatMessage[];
  data: OnboardingData;
  isProcessing: boolean;

  // Actions
  setStep: (step: OnboardingStep) => void;
  addMessage: (role: 'kin' | 'user', content: string) => void;
  updateData: (field: keyof OnboardingData, value: any) => void;
  nextStep: () => void;
  setProcessing: (processing: boolean) => void;
  reset: () => void;
}

const initialData: OnboardingData = {
  name: '',
  age: null,
  height_cm: null,
  weight_kg: null,
  fitness_level: null,
  fitness_goal: null,
  activity_level: null,
  workout_location: null,
  equipment: [],
  injuries: [],
  injury_notes: '',
  workout_duration: null,
  prior_program_experience: null,
  talkativeness: null,
};

const stepOrder: OnboardingStep[] = [
  'welcome',
  'name',
  'age', 
  'height',
  'weight',
  'fitness_level',
  'goals',
  'activity_level',
  'location',
  'equipment',
  'injuries',
  'duration',
  'experience',
  'preferences',
  'complete'
];

export const useOnboardingStore = create<OnboardingStore>((set, get) => ({
  currentStep: 'welcome',
  messages: [],
  data: initialData,
  isProcessing: false,

  setStep: (step) => set({ currentStep: step }),

  addMessage: (role, content) => {
    const message: ChatMessage = {
      id: Date.now().toString(),
      role,
      content,
      timestamp: new Date(),
    };
    set(state => ({ messages: [...state.messages, message] }));
  },

  updateData: (field, value) => {
    set(state => ({
      data: { ...state.data, [field]: value }
    }));
  },

  nextStep: () => {
    const { currentStep } = get();
    const currentIndex = stepOrder.indexOf(currentStep);
    const nextIndex = currentIndex + 1;
    
    if (nextIndex < stepOrder.length) {
      set({ currentStep: stepOrder[nextIndex] });
    }
  },

  setProcessing: (processing) => set({ isProcessing: processing }),

  reset: () => set({
    currentStep: 'welcome',
    messages: [],
    data: initialData,
    isProcessing: false,
  }),
}));