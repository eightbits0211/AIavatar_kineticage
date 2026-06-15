export interface BundleExercise {
  exercise_id: string;
  name: string;
  sets: number;
  rep_min: number;
  rep_max: number;
  rest_seconds: number;
  instructions_text: string;
  image_url: string;
  muscle_groups: string[];
}

export interface ExerciseBundle {
  _id: string;
  user_id: string;
  title: string;
  is_recommended: boolean;
  estimated_duration_min: number;
  estimated_calorie_burn: { low: number; high: number };
  exercises: BundleExercise[];
  rationale: string;
  focus: string;
  generated_at: Date;
  generation_context: {
    persona_tags: string[];
    fitness_goal: string;
    workout_category: string;
    excluded_exercises: string[];
    recent_muscle_groups: string[];
  };
}

export interface BundleSet {
  bundles: ExerciseBundle[];
  generated_at: Date;
  active: boolean;
}
