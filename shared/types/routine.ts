export interface RoutineExercise {
  exercise_id: string;
  sets: number;
  target_reps: number;
  rest_seconds: number;
}

export interface RoutineDay {
  exercises: RoutineExercise[];
  estimated_duration: number;
  focus: string;
}

export type DayOfWeek =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

export interface RoutinePlan {
  [key: string]: RoutineDay;
}

export interface Routine {
  _id: string;
  user_id: string;
  active: boolean;
  generated_at: Date;
  plan: RoutinePlan;
  generation_context: {
    persona: string;
    fitness_level: string;
    goals: string[];
    excluded_exercises: string[];
  };
}
