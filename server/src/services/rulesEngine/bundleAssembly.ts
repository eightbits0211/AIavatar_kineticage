/**
 * RULES ENGINE — STAGE 4: BUNDLE ASSEMBLY
 *
 * Takes modified exercises and assembles 3-4 distinct workout bundles.
 * Each bundle is a complete, ready-to-do workout.
 *
 * Differentiation strategies:
 * - Movement focus (e.g., "Push Focus" vs "Pull Focus" vs "Full Body")
 * - Intensity (e.g., "Standard" vs "Lighter Recovery Day")
 * - Duration variant (based on user's preferred duration)
 *
 * Scoring for is_recommended:
 * - Muscle groups not recently trained (from recent history)
 * - Alignment with weekly split plan
 * - Variety from last session
 *
 * Rules:
 * - 3-4 bundles per generation
 * - Exactly 1 flagged is_recommended = true
 * - No specific weight values anywhere
 * - Exercise count based on user's preferred duration (15min=3-4, 30min=5-6, 45min=6-8, 60min=8-10)
 * - Each bundle includes: title, estimated duration, calorie burn range, exercise list
 */

import { CategorizedExercise } from './categoryStage';

export interface BundleExerciseOutput {
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

export interface AssembledBundle {
  title: string;
  focus: string;
  is_recommended: boolean;
  estimated_duration_min: number;
  estimated_calorie_burn: { low: number; high: number };
  exercises: BundleExerciseOutput[];
}

export interface BundleAssemblyInput {
  modified: CategorizedExercise[];
  workoutDuration: 15 | 30 | 45 | 60;
  recentMuscleGroups?: string[];
}

export interface BundleAssemblyOutput {
  bundles: AssembledBundle[];
  stats: {
    total_bundles: number;
    exercises_per_bundle: number[];
  };
}

// Movement focus groupings
const FOCUS_GROUPS: Record<string, string[]> = {
  push: ['chest', 'front_delts', 'side_delts', 'triceps'],
  pull: ['upper_back', 'lats', 'biceps', 'rear_delts'],
  legs: ['quadriceps', 'glutes', 'hamstrings', 'calves'],
  core: ['core', 'hip_flexors', 'spine'],
  full_body: ['full_body'],
};

// Exercise count by duration
function getExerciseCount(duration: number): { min: number; max: number } {
  switch (duration) {
    case 15: return { min: 3, max: 4 };
    case 30: return { min: 5, max: 6 };
    case 45: return { min: 6, max: 8 };
    case 60: return { min: 8, max: 10 };
    default: return { min: 5, max: 6 };
  }
}

// Estimate calorie burn per exercise (rough heuristic)
function estimateCalories(exercises: BundleExerciseOutput[], durationMin: number): { low: number; high: number } {
  // Rough estimate: 5-8 calories per minute of exercise
  const low = Math.round(durationMin * 5);
  const high = Math.round(durationMin * 8);
  return { low, high };
}

// Get primary focus of an exercise
function getPrimaryFocus(muscleGroups: string[]): string {
  for (const [focus, muscles] of Object.entries(FOCUS_GROUPS)) {
    if (muscleGroups.some(m => muscles.includes(m))) {
      return focus;
    }
  }
  return 'full_body';
}

// Shuffle array (Fisher-Yates)
function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Select N exercises from pool with variety
function selectExercises(
  pool: CategorizedExercise[],
  count: number,
  preferFocus?: string
): CategorizedExercise[] {
  let sorted = [...pool];

  // If we have a preferred focus, prioritize those exercises
  if (preferFocus && preferFocus !== 'full_body') {
    const focusMuscles = FOCUS_GROUPS[preferFocus] || [];
    sorted.sort((a, b) => {
      const aMatch = a.exercise.muscle_groups.primary.some(m => focusMuscles.includes(m)) ? 0 : 1;
      const bMatch = b.exercise.muscle_groups.primary.some(m => focusMuscles.includes(m)) ? 0 : 1;
      return aMatch - bMatch;
    });
  } else {
    sorted = shuffle(sorted);
  }

  // Select up to count, ensuring substitution group variety (no two from same group)
  const selected: CategorizedExercise[] = [];
  const usedGroups = new Set<string>();

  for (const item of sorted) {
    if (selected.length >= count) break;

    // Skip if we already have an exercise from this substitution group
    if (usedGroups.has(item.exercise.substitution_group)) continue;

    selected.push(item);
    usedGroups.add(item.exercise.substitution_group);
  }

  // If we still need more (limited substitution groups), allow duplicates
  if (selected.length < count) {
    for (const item of sorted) {
      if (selected.length >= count) break;
      if (!selected.includes(item)) {
        selected.push(item);
      }
    }
  }

  return selected;
}

// Convert CategorizedExercise to BundleExerciseOutput
function toBundleExercise(item: CategorizedExercise): BundleExerciseOutput {
  return {
    exercise_id: item.exercise.exercise_id,
    name: item.exercise.name,
    sets: item.sets,
    rep_min: item.rep_min,
    rep_max: item.rep_max,
    rest_seconds: item.rest_seconds,
    instructions_text: item.exercise.instructions_text,
    image_url: item.exercise.image_url,
    muscle_groups: item.exercise.muscle_groups.primary,
  };
}

export function bundleAssemblyStage(input: BundleAssemblyInput): BundleAssemblyOutput {
  const { modified, workoutDuration, recentMuscleGroups = [] } = input;
  const { min: minExercises, max: maxExercises } = getExerciseCount(workoutDuration);
  const targetCount = Math.min(Math.floor((minExercises + maxExercises) / 2), modified.length);

  const bundles: AssembledBundle[] = [];

  // Determine which focus areas are available
  const availableFocuses: string[] = [];
  const exercisesByFocus: Record<string, CategorizedExercise[]> = {};

  for (const item of modified) {
    const focus = getPrimaryFocus(item.exercise.muscle_groups.primary);
    if (!exercisesByFocus[focus]) exercisesByFocus[focus] = [];
    exercisesByFocus[focus].push(item);
    if (!availableFocuses.includes(focus)) availableFocuses.push(focus);
  }

  // BUNDLE 1: Push Focus (or first available focus)
  const pushExercises = selectExercises(modified, targetCount, 'push');
  if (pushExercises.length >= minExercises) {
    bundles.push({
      title: 'Push Day',
      focus: 'push',
      is_recommended: false,
      estimated_duration_min: workoutDuration,
      estimated_calorie_burn: estimateCalories(pushExercises.map(toBundleExercise), workoutDuration),
      exercises: pushExercises.map(toBundleExercise),
    });
  }

  // BUNDLE 2: Pull Focus
  const pullExercises = selectExercises(modified, targetCount, 'pull');
  if (pullExercises.length >= minExercises) {
    bundles.push({
      title: 'Pull Day',
      focus: 'pull',
      is_recommended: false,
      estimated_duration_min: workoutDuration,
      estimated_calorie_burn: estimateCalories(pullExercises.map(toBundleExercise), workoutDuration),
      exercises: pullExercises.map(toBundleExercise),
    });
  }

  // BUNDLE 3: Legs Focus
  const legExercises = selectExercises(modified, targetCount, 'legs');
  if (legExercises.length >= minExercises) {
    bundles.push({
      title: 'Leg Day',
      focus: 'legs',
      is_recommended: false,
      estimated_duration_min: workoutDuration,
      estimated_calorie_burn: estimateCalories(legExercises.map(toBundleExercise), workoutDuration),
      exercises: legExercises.map(toBundleExercise),
    });
  }

  // BUNDLE 4: Full Body (mixed)
  const fullBodyExercises = selectExercises(shuffle(modified), targetCount);
  if (fullBodyExercises.length >= minExercises) {
    bundles.push({
      title: 'Full Body',
      focus: 'full_body',
      is_recommended: false,
      estimated_duration_min: workoutDuration,
      estimated_calorie_burn: estimateCalories(fullBodyExercises.map(toBundleExercise), workoutDuration),
      exercises: fullBodyExercises.map(toBundleExercise),
    });
  }

  // If we have fewer than 3 bundles (limited exercise pool), create variants
  while (bundles.length < 3 && modified.length >= minExercises) {
    const variant = selectExercises(shuffle(modified), targetCount);
    bundles.push({
      title: `Workout Option ${bundles.length + 1}`,
      focus: 'mixed',
      is_recommended: false,
      estimated_duration_min: workoutDuration,
      estimated_calorie_burn: estimateCalories(variant.map(toBundleExercise), workoutDuration),
      exercises: variant.map(toBundleExercise),
    });
  }

  // Cap at 4 bundles
  const finalBundles = bundles.slice(0, 4);

  // SCORE & RECOMMEND: pick the bundle that targets muscle groups least recently trained
  let bestScore = -1;
  let bestIdx = 0;

  for (let i = 0; i < finalBundles.length; i++) {
    let score = 0;
    const bundleMuscles = finalBundles[i].exercises.flatMap(e => e.muscle_groups);

    // Score higher if the bundle targets muscles NOT in recent history
    for (const muscle of bundleMuscles) {
      if (!recentMuscleGroups.includes(muscle)) {
        score += 2;
      }
    }

    // Bonus for full body variety
    const uniqueMuscles = new Set(bundleMuscles);
    score += uniqueMuscles.size;

    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }

  finalBundles[bestIdx].is_recommended = true;

  return {
    bundles: finalBundles,
    stats: {
      total_bundles: finalBundles.length,
      exercises_per_bundle: finalBundles.map(b => b.exercises.length),
    },
  };
}
