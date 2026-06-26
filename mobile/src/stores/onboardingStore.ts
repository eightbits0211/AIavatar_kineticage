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
  | 'gender'
  | 'goals'
  | 'activity_level' 
  | 'location'
  | 'equipment'
  | 'injuries'
  | 'duration'
  | 'fitness_level'
  | 'experience'
  | 'preferences'
  | 'summary'
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
  gender: Gender | null;
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

/** The calculated metrics returned by POST /api/personalize. */
export interface CalculatedMetrics {
  bmi: number;
  bmi_category: string;
  tdee: number;
  tdee_range: { low: number; high: number };
  max_heart_rate: number;
  target_zone: { low: number; high: number };
}

interface OnboardingStore {
  currentStep: OnboardingStep;
  messages: ChatMessage[];
  data: OnboardingData;
  isProcessing: boolean;
  /** Metrics + persona tags from the backend, shown on the Health Metrics screen. */
  metrics: CalculatedMetrics | null;
  personaTags: string[];

  // Actions
  setStep: (step: OnboardingStep) => void;
  addMessage: (role: 'kin' | 'user', content: string) => void;
  updateData: (field: keyof OnboardingData, value: any) => void;
  nextStep: () => void;
  setProcessing: (processing: boolean) => void;
  setPersonalization: (metrics: CalculatedMetrics, personaTags: string[]) => void;
  reset: () => void;
}

const initialData: OnboardingData = {
  name: '',
  age: null,
  height_cm: null,
  weight_kg: null,
  gender: null,
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
  'gender',
  'goals',
  'activity_level',
  'location',
  'equipment',
  'injuries',
  'duration',
  'fitness_level',
  'experience',
  'preferences',
  'summary',
  'complete'
];

export const useOnboardingStore = create<OnboardingStore>((set, get) => ({
  currentStep: 'welcome',
  messages: [],
  data: initialData,
  isProcessing: false,
  metrics: null,
  personaTags: [],

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

  setPersonalization: (metrics, personaTags) => set({ metrics, personaTags }),

  reset: () => set({
    currentStep: 'welcome',
    messages: [],
    data: initialData,
    isProcessing: false,
    metrics: null,
    personaTags: [],
  }),
}));