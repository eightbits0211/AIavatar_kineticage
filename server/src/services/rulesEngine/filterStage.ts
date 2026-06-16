/**
 * RULES ENGINE — STAGE 1: FILTER
 *
 * Filters the full exercise library down to eligible exercises based on:
 * 1. Equipment — exclude if exercise requires equipment the user doesn't have
 * 2. Location — exclude if exercise is not compatible with user's workout location
 * 3. Injuries — exclude if exercise is contraindicated for user's reported injuries
 *
 * Priority order (from PRD): Injury exclusions > Equipment/Location filters
 *
 * Input: Full exercise library + user profile
 * Output: Filtered set of eligible exercises
 */

import { IExercise } from '../../models/Exercise';
import { IUser } from '../../models/User';

export interface FilterInput {
  exercises: IExercise[];
  user: IUser;
}

export interface FilterOutput {
  eligible: IExercise[];
  excluded: Array<{
    exercise: IExercise;
    reason: 'injury' | 'equipment' | 'location';
  }>;
  stats: {
    total: number;
    eligible: number;
    excluded_injury: number;
    excluded_equipment: number;
    excluded_location: number;
  };
}

export function filterStage(input: FilterInput): FilterOutput {
  const { exercises, user } = input;

  const eligible: IExercise[] = [];
  const excluded: FilterOutput['excluded'] = [];

  let excludedInjury = 0;
  let excludedEquipment = 0;
  let excludedLocation = 0;

  for (const exercise of exercises) {
    // 1. INJURY CHECK (highest priority)
    // If user has injuries and exercise is contraindicated for any of them
    const userInjuries = (user.injuries || []).filter(i => i !== 'none');
    if (userInjuries.length > 0 && exercise.contraindications.length > 0) {
      const hasContraindication = exercise.contraindications.some(
        contra => userInjuries.includes(contra)
      );
      if (hasContraindication) {
        excluded.push({ exercise, reason: 'injury' });
        excludedInjury++;
        continue;
      }
    }

    // 2. LOCATION CHECK
    // Exercise must be compatible with user's workout location
    if (!exercise.location_compatible.includes(user.workout_location)) {
      // "hybrid" location means user can do both gym and home exercises
      if (user.workout_location === 'hybrid') {
        // Hybrid users can access all location-compatible exercises — skip this filter
      } else {
        excluded.push({ exercise, reason: 'location' });
        excludedLocation++;
        continue;
      }
    }

    // 3. EQUIPMENT CHECK
    // If exercise requires equipment, user must have at least one of the required items
    // "none" in equipment_required means bodyweight — always available
    if (exercise.equipment_required.length > 0) {
      const requiresEquipment = !exercise.equipment_required.includes('none');

      if (requiresEquipment) {
        const userHasEquipment = exercise.equipment_required.some(
          eq => user.equipment.includes(eq)
        );
        if (!userHasEquipment) {
          excluded.push({ exercise, reason: 'equipment' });
          excludedEquipment++;
          continue;
        }
      }
    }

    // Passed all filters
    eligible.push(exercise);
  }

  return {
    eligible,
    excluded,
    stats: {
      total: exercises.length,
      eligible: eligible.length,
      excluded_injury: excludedInjury,
      excluded_equipment: excludedEquipment,
      excluded_location: excludedLocation,
    },
  };
}
