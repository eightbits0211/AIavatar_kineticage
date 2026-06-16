/**
 * RULES ENGINE — STAGE 2: CATEGORY
 *
 * Takes the filtered eligible exercises and applies goal-specific rules:
 * 1. Maps user's fitness goal → Workout Category
 * 2. Filters exercises to those tagged with the relevant category
 * 3. Applies category-specific set/rep/rest parameters to each exercise
 * 4. Applies exercise-type ratios (e.g., Hypertrophy: 60% compound, 40% isolation)
 *
 * Input: Eligible exercises + user's fitness goal
 * Output: Categorized exercises with parameterized sets/reps/rest
 */

import { IExercise } from '../../models/Exercise';

export type WorkoutCategory = 'strength' | 'hypertrophy' | 'mobility' | 'general_fitness' | 'weight_loss' | 'home_workout';

export interface CategorizedExercise {
  exercise: IExercise;
  sets: number;
  rep_min: number;
  rep_max: number;
  rest_seconds: number;
  is_compound: boolean;
}

export interface CategoryInput {
  eligible: IExercise[];
  fitnessGoal: WorkoutCategory;
}

export interface CategoryOutput {
  categorized: CategorizedExercise[];
  category: WorkoutCategory;
  stats: {
    eligible_input: number;
    categorized_output: number;
    compound_count: number;
    isolation_count: number;
  };
}

// Muscle groups that indicate compound movements
const COMPOUND_MUSCLE_INDICATORS = ['quadriceps', 'glutes', 'hamstrings', 'chest', 'upper_back', 'lats', 'full_body'];

/**
 * Determines if an exercise is compound based on primary muscle groups.
 * Compound = targets large muscle groups or multiple primary muscles.
 */
function isCompound(exercise: IExercise): boolean {
  const primaries = exercise.muscle_groups.primary;
  if (primaries.length >= 2) return true;
  return primaries.some(m => COMPOUND_MUSCLE_INDICATORS.includes(m));
}

export function categoryStage(input: CategoryInput): CategoryOutput {
  const { eligible, fitnessGoal } = input;

  // Filter to exercises tagged with this category
  const categoryExercises = eligible.filter(
    ex => ex.category_tags.includes(fitnessGoal)
  );

  // Apply category-specific parameters from each exercise's default_set_rep_range
  const categorized: CategorizedExercise[] = categoryExercises.map(exercise => {
    const categoryDefaults = exercise.default_set_rep_range[fitnessGoal];

    if (categoryDefaults) {
      return {
        exercise,
        sets: categoryDefaults.sets,
        rep_min: categoryDefaults.rep_min,
        rep_max: categoryDefaults.rep_max,
        rest_seconds: categoryDefaults.rest_seconds,
        is_compound: isCompound(exercise),
      };
    }

    // Fallback: use general_fitness defaults or hardcoded fallback
    const fallback = exercise.default_set_rep_range['general_fitness'] || {
      sets: 3,
      rep_min: 8,
      rep_max: 12,
      rest_seconds: 60,
    };

    return {
      exercise,
      sets: fallback.sets,
      rep_min: fallback.rep_min,
      rep_max: fallback.rep_max,
      rest_seconds: fallback.rest_seconds,
      is_compound: isCompound(exercise),
    };
  });

  const compoundCount = categorized.filter(c => c.is_compound).length;
  const isolationCount = categorized.filter(c => !c.is_compound).length;

  return {
    categorized,
    category: fitnessGoal,
    stats: {
      eligible_input: eligible.length,
      categorized_output: categorized.length,
      compound_count: compoundCount,
      isolation_count: isolationCount,
    },
  };
}
