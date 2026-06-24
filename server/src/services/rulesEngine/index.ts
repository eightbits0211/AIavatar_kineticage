/**
 * RULES ENGINE — Main Entry Point
 *
 * Orchestrates all 4 stages to produce exercise bundles from a user profile.
 * This is a DETERMINISTIC system — no LLM involved.
 *
 * Usage:
 *   const bundles = await generateBundles(user);
 *
 * The AI companion generates rationale text AFTER this runs,
 * using only the structured bundle data as input.
 */

import { Exercise, IExercise } from '../../models/Exercise';
import { IUser } from '../../models/User';
import { filterStage, FilterOutput } from './filterStage';
import { categoryStage, CategoryOutput, WorkoutCategory } from './categoryStage';
import { personaModifierStage, PersonaModifierOutput } from './personaModifier';
import { bundleAssemblyStage, BundleAssemblyOutput, AssembledBundle } from './bundleAssembly';

export interface GenerateBundlesOptions {
  user: IUser;
  recentMuscleGroups?: string[];
}

export interface GenerateBundlesResult {
  bundles: AssembledBundle[];
  pipeline: {
    filter: { eligible: number; excluded: number };
    category: { exercises: number };
    persona: { additions: string[]; adjustments: string[] };
    assembly: { total_bundles: number };
  };
}

/**
 * Main function: generates 3-4 exercise bundles for a user.
 * Loads exercises from MongoDB, runs the 4-stage pipeline.
 */
export async function generateBundles(options: GenerateBundlesOptions): Promise<GenerateBundlesResult> {
  const { user, recentMuscleGroups = [] } = options;

  // Load full exercise library from database
  const allExercises = await Exercise.find({}).lean() as unknown as IExercise[];

  if (allExercises.length === 0) {
    throw new Error('Exercise library is empty. Run the seed script first.');
  }

  // Stage 1: Filter
  const filterResult: FilterOutput = filterStage({
    exercises: allExercises,
    user,
  });

  // Fallback: if too few exercises pass filter, use a minimal baseline
  if (filterResult.eligible.length < 3) {
    // Use all bodyweight, no-equipment exercises as fallback
    const fallback = allExercises.filter(
      ex => ex.equipment_required.includes('none') || ex.equipment_required.length === 0
    );
    filterResult.eligible.push(...fallback.filter(
      ex => !filterResult.eligible.some(e => e.exercise_id === ex.exercise_id)
    ));
  }

  // Stage 2: Category
  const fitnessGoal = (user.fitness_goal || 'general_fitness') as WorkoutCategory;
  const categoryResult: CategoryOutput = categoryStage({
    eligible: filterResult.eligible,
    fitnessGoal,
  });

  // If category yields too few, fall back to general_fitness
  let categorizedExercises = categoryResult.categorized;
  if (categorizedExercises.length < 3 && fitnessGoal !== 'general_fitness') {
    const fallbackCategory = categoryStage({
      eligible: filterResult.eligible,
      fitnessGoal: 'general_fitness',
    });
    categorizedExercises = fallbackCategory.categorized;
  }

  // Stage 3: Persona Modifier
  const personaResult: PersonaModifierOutput = personaModifierStage({
    categorized: categorizedExercises,
    personaTags: user.persona_tags || [],
    allEligibleExercises: filterResult.eligible,
    userInjuries: (user.injuries || []).filter(i => i !== 'none'),
  });

  // Stage 4: Bundle Assembly
  const workoutDuration = (user.workout_duration || 30) as 15 | 30 | 45 | 60;
  const bmiCategory = user.calculated_metrics?.bmi_category || '';
  const assemblyResult: BundleAssemblyOutput = bundleAssemblyStage({
    modified: personaResult.modified,
    workoutDuration,
    recentMuscleGroups,
    bmiCategory,
  });

  return {
    bundles: assemblyResult.bundles,
    pipeline: {
      filter: {
        eligible: filterResult.stats.eligible,
        excluded: filterResult.stats.total - filterResult.stats.eligible,
      },
      category: { exercises: categorizedExercises.length },
      persona: {
        additions: personaResult.additions,
        adjustments: personaResult.adjustments,
      },
      assembly: { total_bundles: assemblyResult.stats.total_bundles },
    },
  };
}

// Re-export types for use in routes
export type { AssembledBundle } from './bundleAssembly';
export type { FilterOutput } from './filterStage';
export type { CategoryOutput, WorkoutCategory } from './categoryStage';
