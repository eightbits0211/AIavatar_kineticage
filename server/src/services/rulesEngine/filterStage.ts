/**
 * RULES ENGINE — STAGE 1: FILTER
 *
 * Filters the full exercise library down to eligible exercises based on:
 * 1. Equipment — exclude if exercise requires equipment the user doesn't have
 * 2. Location — exclude if exercise is not compatible with user's workout location
 * 3. Injuries — exclude if exercise is contraindicated for user's reported injuries
 * 4. MHR Intensity Zone — exclude if exercise intensity exceeds user's safe MHR zone
 * 5. Fitness Level — exclude/deprioritize exercises above user's stated fitness level
 *
 * Priority order (from PRD): Injury exclusions > Equipment/Location filters > MHR > Fitness Level
 *
 * Input: Full exercise library + user profile
 * Output: Filtered set of eligible exercises
 */

import { IExercise, IntensityZone } from '../../models/Exercise';
import { IUser } from '../../models/User';

export interface FilterInput {
  exercises: IExercise[];
  user: IUser;
}

export interface FilterOutput {
  eligible: IExercise[];
  excluded: Array<{
    exercise: IExercise;
    reason: 'injury' | 'equipment' | 'location' | 'intensity' | 'fitness_level';
  }>;
  stats: {
    total: number;
    eligible: number;
    excluded_injury: number;
    excluded_equipment: number;
    excluded_location: number;
    excluded_intensity: number;
    excluded_fitness_level: number;
  };
}

/**
 * Determines the maximum allowed intensity zone based on the user's MHR and age.
 *
 * Rules:
 * - Age >= 60 OR MHR < 140: max zone = moderate (no high/very_high)
 * - Age >= 50 OR MHR < 155: max zone = high (no very_high)
 * - Otherwise: all zones allowed
 *
 * This is a safety gate — the PRD says MHR should prevent exercises
 * that exceed the user's safe heart rate zone.
 */
function getMaxAllowedIntensityZone(user: IUser): IntensityZone {
  const mhr = user.calculated_metrics?.max_heart_rate || (220 - (user.age || 30));

  if (user.age >= 60 || mhr < 140) {
    return 'moderate';
  }
  if (user.age >= 50 || mhr < 155) {
    return 'high';
  }
  return 'very_high';
}

/**
 * Returns numeric rank for intensity zones (for comparison).
 */
function intensityRank(zone: IntensityZone): number {
  const ranks: Record<IntensityZone, number> = {
    low: 0,
    moderate: 1,
    high: 2,
    very_high: 3,
  };
  return ranks[zone] ?? 1;
}

/**
 * Determines the maximum allowed difficulty level based on user's fitness_level.
 *
 * - beginner: only beginner exercises
 * - intermediate: beginner + intermediate
 * - advanced: all levels allowed
 *
 * Exception: warm_up and cool_down phase exercises are never filtered by fitness level
 * (they're typically safe regardless of experience).
 */
function getMaxAllowedDifficulty(user: IUser): string[] {
  const level = user.fitness_level || 'beginner';
  switch (level) {
    case 'beginner':
      return ['beginner'];
    case 'intermediate':
      return ['beginner', 'intermediate'];
    case 'advanced':
      return ['beginner', 'intermediate', 'advanced'];
    default:
      return ['beginner', 'intermediate'];
  }
}

export function filterStage(input: FilterInput): FilterOutput {
  const { exercises, user } = input;

  const eligible: IExercise[] = [];
  const excluded: FilterOutput['excluded'] = [];

  let excludedInjury = 0;
  let excludedEquipment = 0;
  let excludedLocation = 0;
  let excludedIntensity = 0;
  let excludedFitnessLevel = 0;

  const maxIntensityZone = getMaxAllowedIntensityZone(user);
  const maxIntensityRank = intensityRank(maxIntensityZone);
  const allowedDifficulties = getMaxAllowedDifficulty(user);

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

    // 4. MHR INTENSITY ZONE CHECK
    // Exclude exercises whose intensity zone exceeds the user's max safe zone.
    // Only apply if the exercise has an intensity_zone field set.
    const exerciseIntensity = exercise.intensity_zone || 'moderate';
    if (intensityRank(exerciseIntensity) > maxIntensityRank) {
      excluded.push({ exercise, reason: 'intensity' });
      excludedIntensity++;
      continue;
    }

    // 5. FITNESS LEVEL CHECK
    // Exclude exercises above the user's stated fitness level.
    // Exception: warm_up and cool_down exercises are never excluded by fitness level.
    const isStructuralPhase = exercise.workout_phase?.some(
      p => p === 'warm_up' || p === 'cool_down'
    );
    if (!isStructuralPhase && !allowedDifficulties.includes(exercise.difficulty_level)) {
      excluded.push({ exercise, reason: 'fitness_level' });
      excludedFitnessLevel++;
      continue;
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
      excluded_intensity: excludedIntensity,
      excluded_fitness_level: excludedFitnessLevel,
    },
  };
}
