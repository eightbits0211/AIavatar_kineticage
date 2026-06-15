import { Equipment, FitnessGoal, FitnessLevel, HealthCondition } from './user';

export interface Exercise {
  _id: string;
  name: string;
  description: string;
  target_muscles: string[];
  instructions: string[];
  difficulty: FitnessLevel;
  equipment_required: Equipment[];
  contraindications: HealthCondition[];
  image_url: string;
  goal_tags: FitnessGoal[];
  default_sets: number;
  default_reps: number;
  rest_seconds: number;
}
