/**
 * RULES ENGINE — STAGE 3: PERSONA MODIFIER
 *
 * Applies additive modifications based on active persona tags.
 * Persona effects are cumulative — a user with multiple tags gets all applicable modifications.
 *
 * Priority order (from PRD): Injury exclusions (already handled in Filter) > Equipment/Location (already filtered) > Goal-based category (already applied) > Persona-based additions (THIS STAGE)
 *
 * Modifications per persona:
 * - Complete Beginner: reduce volume (fewer sets), prefer beginner-difficulty exercises
 * - Regular Gym-Goer: no modifications (full library, standard progression)
 * - Weight Loss Seeker: (already handled by category — no additional modifier needed)
 * - Home Workout User: (already handled by filter + category)
 * - Office Professional: add 1 posture-focused mobility exercise if not already included
 * - Injury Recovery User: add 1 mobility exercise for affected area (rehab-friendly)
 * - AI Companion Seeker: no workout modifications (only affects AI tone)
 * - Inconsistent Enthusiast: no workout modifications (only affects AI behavior)
 *
 * Input: Categorized exercises + user persona tags + full exercise library (for additions)
 * Output: Modified exercise set
 */

import { IExercise } from '../../models/Exercise';
import { CategorizedExercise } from './categoryStage';

export interface PersonaModifierInput {
  categorized: CategorizedExercise[];
  personaTags: string[];
  allEligibleExercises: IExercise[];
  userInjuries: string[];
}

export interface PersonaModifierOutput {
  modified: CategorizedExercise[];
  additions: string[];
  adjustments: string[];
}

export function personaModifierStage(input: PersonaModifierInput): PersonaModifierOutput {
  const { categorized, personaTags, allEligibleExercises, userInjuries } = input;

  let modified = [...categorized];
  const additions: string[] = [];
  const adjustments: string[] = [];

  // COMPLETE BEGINNER: reduce volume, prefer beginner exercises
  if (personaTags.includes('complete_beginner')) {
    modified = modified.map(item => ({
      ...item,
      // Reduce sets by 1 (min 2)
      sets: Math.max(2, item.sets - 1),
    }));
    adjustments.push('Reduced sets by 1 for beginner-friendly volume');

    // Prefer beginner-difficulty exercises — move advanced ones to the back
    modified.sort((a, b) => {
      const diffOrder = { beginner: 0, intermediate: 1, advanced: 2 };
      const aOrder = diffOrder[a.exercise.difficulty_level] || 1;
      const bOrder = diffOrder[b.exercise.difficulty_level] || 1;
      return aOrder - bOrder;
    });
    adjustments.push('Prioritized beginner-difficulty exercises');
  }

  // OFFICE PROFESSIONAL: add a posture/mobility exercise if not present
  if (personaTags.includes('office_professional')) {
    const hasPostureExercise = modified.some(
      item => item.exercise.muscle_groups.primary.some(
        m => ['thoracic_spine', 'hip_flexors', 'neck', 'upper_back'].includes(m)
      ) && item.exercise.category_tags.includes('mobility')
    );

    if (!hasPostureExercise) {
      // Find a posture-focused mobility exercise from eligible set
      const postureExercise = allEligibleExercises.find(
        ex => ex.category_tags.includes('mobility') &&
          ex.muscle_groups.primary.some(m => ['thoracic_spine', 'hip_flexors', 'neck', 'upper_back'].includes(m)) &&
          !modified.some(item => item.exercise.exercise_id === ex.exercise_id)
      );

      if (postureExercise) {
        const defaults = postureExercise.default_set_rep_range['mobility'] || { sets: 2, rep_min: 8, rep_max: 12, rest_seconds: 20 };
        modified.push({
          exercise: postureExercise,
          sets: defaults.sets,
          rep_min: defaults.rep_min,
          rep_max: defaults.rep_max,
          rest_seconds: defaults.rest_seconds,
          is_compound: false,
        });
        additions.push(`Added posture exercise: ${postureExercise.name}`);
      }
    }
  }

  // INJURY RECOVERY USER: add 1 mobility exercise for affected area
  if (personaTags.includes('injury_recovery_user')) {
    const injuredAreas = userInjuries.filter(i => i !== 'none');

    for (const area of injuredAreas) {
      // Map injury areas to relevant mobility muscle groups
      const injuryMobilityMap: Record<string, string[]> = {
        knee: ['quadriceps', 'hamstrings', 'hip_flexors'],
        lower_back: ['spine', 'core', 'hip_flexors'],
        shoulder: ['rotator_cuff', 'upper_back', 'thoracic_spine'],
        wrist: ['forearms'],
        ankle: ['calves'],
        neck: ['neck', 'upper_back'],
      };

      const relevantMuscles = injuryMobilityMap[area] || [];

      // Find a mobility exercise targeting the relevant area that ISN'T contraindicated
      const rehabExercise = allEligibleExercises.find(
        ex => ex.category_tags.includes('mobility') &&
          ex.muscle_groups.primary.some(m => relevantMuscles.includes(m)) &&
          !ex.contraindications.includes(area) && // Must not be contraindicated for this injury
          !modified.some(item => item.exercise.exercise_id === ex.exercise_id) // Not already included
      );

      if (rehabExercise) {
        const defaults = rehabExercise.default_set_rep_range['mobility'] || { sets: 2, rep_min: 8, rep_max: 12, rest_seconds: 20 };
        modified.push({
          exercise: rehabExercise,
          sets: defaults.sets,
          rep_min: defaults.rep_min,
          rep_max: defaults.rep_max,
          rest_seconds: defaults.rest_seconds,
          is_compound: false,
        });
        additions.push(`Added rehab mobility for ${area}: ${rehabExercise.name}`);
      }
    }
  }

  return { modified, additions, adjustments };
}
