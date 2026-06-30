import { Equipment, FitnessGoal, InjuryArea, WorkoutLocation } from './user';

export type WorkoutCategory =
  | 'strength'
  | 'hypertrophy'
  | 'mobility'
  | 'general_fitness'
  | 'weight_loss'
  | 'home_workout';

export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced';

export interface SetRepRange {
  sets: number;
  rep_min: number;
  rep_max: number;
  rest_seconds: number;
}

export interface Exercise {
  _id: string;
  exercise_id: string;
  name: string;
  category_tags: WorkoutCategory[];
  muscle_groups: {
    primary: string[];
    secondary: string[];
  };
  equipment_required: Equipment[];
  location_compatible: WorkoutLocation[];
  contraindications: InjuryArea[];
  substitution_group: string;
  default_set_rep_range: Record<WorkoutCategory, SetRepRange>;
  instructions_text: string;
  difficulty_level: DifficultyLevel;
  image_url: string;
  image_url_end: string;
}
