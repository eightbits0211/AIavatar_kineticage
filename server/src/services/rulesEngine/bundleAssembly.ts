/**
 * RULES ENGINE — STAGE 4: BUNDLE ASSEMBLY
 *
 * Assembles 3-4 workout bundles following a FIXED exercise sequence:
 *   1. Warm-up (1 exercise)
 *   2. Primary Goal (2 exercises)
 *   3. BMI Targeting (1 exercise)
 *   4. Core (1 exercise)
 *   5. Cardio Finisher / Balance Mobility (1 exercise)
 *   6. Cool-down Stretch (1 exercise)
 *
 * Total: 7 exercises per bundle (standard). Adjusted for shorter durations.
 *
 * Each bundle differentiates by selecting DIFFERENT exercises for the same slots
 * (e.g., different warm-ups, different primary exercises, different finishers).
 *
 * Rules:
 * - 3-4 bundles per generation
 * - Exactly 1 flagged is_recommended = true
 * - No specific weight values anywhere
 * - BMI Targeting slot uses user's BMI category to choose appropriate exercises
 * - Exercise count adjusted for duration (15min=4-5, 30min=6-7, 45min=7, 60min=7-8)
 */

import { CategorizedExercise } from './categoryStage';
import { WorkoutPhase } from '../../models/Exercise';

export interface BundleExerciseOutput {
  exercise_id: string;
  name: string;
  workout_phase: WorkoutPhase;
  sets: number;
  rep_min: number;
  rep_max: number;
  rest_seconds: number;
  instructions_text: string;
  image_url: string;
  image_url_end: string;
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
  bmiCategory?: string;
  /** Optional seed for deterministic shuffle. If provided, same inputs produce same outputs. */
  seed?: string;
}

export interface BundleAssemblyOutput {
  bundles: AssembledBundle[];
  stats: {
    total_bundles: number;
    exercises_per_bundle: number[];
  };
}

/**
 * The enforced sequence template.
 * For shorter durations, we trim from the middle (reduce primary slots).
 */
interface SlotTemplate {
  phase: WorkoutPhase;
  count: number;
}

function getSlotTemplate(duration: number): SlotTemplate[] {
  switch (duration) {
    case 15:
      // Compressed: warm-up, 1 primary, core, cool-down
      return [
        { phase: 'warm_up', count: 1 },
        { phase: 'primary', count: 1 },
        { phase: 'core', count: 1 },
        { phase: 'cool_down', count: 1 },
      ];
    case 30:
      // Standard minus BMI targeting
      return [
        { phase: 'warm_up', count: 1 },
        { phase: 'primary', count: 2 },
        { phase: 'core', count: 1 },
        { phase: 'cardio_finisher', count: 1 },
        { phase: 'cool_down', count: 1 },
      ];
    case 45:
      // Full sequence
      return [
        { phase: 'warm_up', count: 1 },
        { phase: 'primary', count: 2 },
        { phase: 'bmi_targeting', count: 1 },
        { phase: 'core', count: 1 },
        { phase: 'cardio_finisher', count: 1 },
        { phase: 'cool_down', count: 1 },
      ];
    case 60:
    default:
      // Full sequence with extra primary
      return [
        { phase: 'warm_up', count: 1 },
        { phase: 'primary', count: 2 },
        { phase: 'bmi_targeting', count: 1 },
        { phase: 'core', count: 1 },
        { phase: 'cardio_finisher', count: 1 },
        { phase: 'cool_down', count: 1 },
      ];
  }
}

/**
 * BMI category → preferred exercise characteristics for the BMI slot.
 * - Underweight: focus on strength/muscle building
 * - Normal: balanced — any compound movement
 * - Overweight: lower impact cardio/metabolic
 * - Obese: low-impact, bodyweight-friendly
 */
function getBmiPreference(bmiCategory: string): {
  preferredTags: string[];
  preferDifficulty: string[];
} {
  switch (bmiCategory) {
    case 'underweight':
      return { preferredTags: ['strength', 'hypertrophy'], preferDifficulty: ['beginner', 'intermediate'] };
    case 'normal':
      return { preferredTags: ['general_fitness', 'strength'], preferDifficulty: ['beginner', 'intermediate', 'advanced'] };
    case 'overweight':
      return { preferredTags: ['weight_loss', 'general_fitness'], preferDifficulty: ['beginner', 'intermediate'] };
    case 'obese':
      return { preferredTags: ['weight_loss', 'home_workout', 'general_fitness'], preferDifficulty: ['beginner'] };
    default:
      return { preferredTags: ['general_fitness'], preferDifficulty: ['beginner', 'intermediate'] };
  }
}

// Seeded PRNG (mulberry32) for deterministic shuffle when seed is provided.
// If no seed, falls back to Math.random() for per-generation variety.
function createRng(seed?: string): () => number {
  if (!seed) return Math.random;

  // Hash string seed to a 32-bit integer
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
  }

  // mulberry32
  return () => {
    h |= 0; h = h + 0x6D2B79F5 | 0;
    let t = Math.imul(h ^ h >>> 15, 1 | h);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

let _rng: () => number = Math.random;

// Shuffle array (Fisher-Yates) using the module-level RNG
function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(_rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Estimate calorie burn based on exercise count and duration
function estimateCalories(exerciseCount: number, durationMin: number): { low: number; high: number } {
  const low = Math.round(durationMin * 5);
  const high = Math.round(durationMin * 8);
  return { low, high };
}

// Convert a CategorizedExercise into a BundleExerciseOutput with assigned phase
function toBundleExercise(item: CategorizedExercise, phase: WorkoutPhase): BundleExerciseOutput {
  return {
    exercise_id: item.exercise.exercise_id,
    name: item.exercise.name,
    workout_phase: phase,
    sets: item.sets,
    rep_min: item.rep_min,
    rep_max: item.rep_max,
    rest_seconds: item.rest_seconds,
    instructions_text: item.exercise.instructions_text,
    image_url: item.exercise.image_url,
    image_url_end: item.exercise.image_url_end || '',
    muscle_groups: item.exercise.muscle_groups.primary,
  };
}

/**
 * Select exercises for a given phase from the pool.
 * Returns `count` exercises, avoiding those in `usedIds`.
 * Falls back to any available exercise for that phase if strict match fails.
 */
function selectForPhase(
  pool: CategorizedExercise[],
  phase: WorkoutPhase,
  count: number,
  usedIds: Set<string>,
  bmiCategory?: string,
): CategorizedExercise[] {
  // Filter pool to exercises tagged with this workout_phase
  let candidates = pool.filter(
    item => item.exercise.workout_phase?.includes(phase) && !usedIds.has(item.exercise.exercise_id)
  );

  // For BMI targeting, apply additional preference scoring
  if (phase === 'bmi_targeting' && bmiCategory) {
    const prefs = getBmiPreference(bmiCategory);
    candidates.sort((a, b) => {
      const aScore = (
        a.exercise.category_tags.some(t => prefs.preferredTags.includes(t)) ? 2 : 0
      ) + (
        prefs.preferDifficulty.includes(a.exercise.difficulty_level) ? 1 : 0
      );
      const bScore = (
        b.exercise.category_tags.some(t => prefs.preferredTags.includes(t)) ? 2 : 0
      ) + (
        prefs.preferDifficulty.includes(b.exercise.difficulty_level) ? 1 : 0
      );
      return bScore - aScore;
    });
  } else {
    // Shuffle for variety between bundles
    candidates = shuffle(candidates);
  }

  // Select up to count, preferring different substitution groups
  const selected: CategorizedExercise[] = [];
  const usedGroups = new Set<string>();

  for (const item of candidates) {
    if (selected.length >= count) break;
    if (usedGroups.has(item.exercise.substitution_group)) continue;
    selected.push(item);
    usedGroups.add(item.exercise.substitution_group);
  }

  // If we need more and ran out of unique substitution groups, allow repeats
  if (selected.length < count) {
    for (const item of candidates) {
      if (selected.length >= count) break;
      if (!selected.includes(item)) {
        selected.push(item);
      }
    }
  }

  return selected;
}

/**
 * Fallback phase mapping: if a slot can't be filled, which phase to try next.
 * This ensures we always produce a complete bundle even with limited exercise pools.
 */
const PHASE_FALLBACKS: Record<WorkoutPhase, WorkoutPhase[]> = {
  warm_up: ['balance_mobility', 'cool_down'],
  primary: ['bmi_targeting'],
  bmi_targeting: ['primary', 'cardio_finisher'],
  core: ['primary', 'balance_mobility'],
  cardio_finisher: ['balance_mobility', 'primary'],
  balance_mobility: ['cardio_finisher', 'cool_down'],
  cool_down: ['balance_mobility', 'warm_up'],
};

/**
 * Generate bundle titles based on the primary exercises selected.
 */
function generateTitle(exercises: BundleExerciseOutput[], bundleIndex: number): string {
  const primaryMuscles = exercises
    .filter(e => e.workout_phase === 'primary')
    .flatMap(e => e.muscle_groups);

  const muscleSet = new Set(primaryMuscles);

  if (muscleSet.has('chest') || muscleSet.has('triceps') || muscleSet.has('front_delts')) {
    return 'Push Power';
  }
  if (muscleSet.has('lats') || muscleSet.has('upper_back') || muscleSet.has('biceps')) {
    return 'Pull Strength';
  }
  if (muscleSet.has('quadriceps') || muscleSet.has('glutes') || muscleSet.has('hamstrings')) {
    return 'Lower Body';
  }
  if (muscleSet.has('full_body')) {
    return 'Full Body Blast';
  }

  const titles = ['Balanced Workout', 'Mixed Training', 'Total Body', 'Functional Fitness'];
  return titles[bundleIndex % titles.length];
}

export function bundleAssemblyStage(input: BundleAssemblyInput): BundleAssemblyOutput {
  const { modified, workoutDuration, recentMuscleGroups = [], bmiCategory, seed } = input;

  // Initialize RNG — deterministic if seed provided, random otherwise
  _rng = createRng(seed);

  const slotTemplate = getSlotTemplate(workoutDuration);
  const bundles: AssembledBundle[] = [];

  // Track globally used exercise IDs across bundles for maximum variety
  // Only PRIMARY exercises need global uniqueness — warm-up/cool-down can repeat
  const globalUsedPrimaryIds = new Set<string>();

  // Generate 3-4 bundles
  const targetBundleCount = modified.length >= 20 ? 4 : 3;

  for (let bundleIdx = 0; bundleIdx < targetBundleCount; bundleIdx++) {
    const bundleExercises: BundleExerciseOutput[] = [];
    // For primary/bmi_targeting, avoid repeats across bundles
    // For warm-up/cool-down/core/cardio, allow reuse across bundles but not within same bundle
    const bundleUsedIds = new Set<string>();

    for (const slot of slotTemplate) {
      // For primary slots, also exclude globally used primaries
      const excludeIds = slot.phase === 'primary' || slot.phase === 'bmi_targeting'
        ? new Set([...bundleUsedIds, ...globalUsedPrimaryIds])
        : bundleUsedIds;

      let selected = selectForPhase(modified, slot.phase, slot.count, excludeIds, bmiCategory);

      // Fallback: try alternative phases if we can't fill this slot
      if (selected.length < slot.count) {
        const fallbacks = PHASE_FALLBACKS[slot.phase] || [];
        for (const fallbackPhase of fallbacks) {
          if (selected.length >= slot.count) break;
          const additional = selectForPhase(
            modified, fallbackPhase, slot.count - selected.length, excludeIds, bmiCategory
          );
          selected.push(...additional);
        }
      }

      // NO "last resort" random pick — if we can't fill a slot properly, skip it
      // This prevents putting heavy lifts in warm-up/cool-down slots

      // Add to bundle
      for (const item of selected) {
        bundleExercises.push(toBundleExercise(item, slot.phase));
        bundleUsedIds.add(item.exercise.exercise_id);
        // Track primary exercises globally for variety across bundles
        if (slot.phase === 'primary' || slot.phase === 'bmi_targeting') {
          globalUsedPrimaryIds.add(item.exercise.exercise_id);
        }
      }
    }

    if (bundleExercises.length < 3) continue; // Skip if too few exercises

    const title = generateTitle(bundleExercises, bundleIdx);

    bundles.push({
      title,
      focus: bundleExercises
        .filter(e => e.workout_phase === 'primary')
        .flatMap(e => e.muscle_groups)[0] || 'general',
      is_recommended: false,
      estimated_duration_min: workoutDuration,
      estimated_calorie_burn: estimateCalories(bundleExercises.length, workoutDuration),
      exercises: bundleExercises,
    });
  }

  // Cap at 4 bundles
  const finalBundles = bundles.slice(0, 4);

  // SCORE & RECOMMEND: pick the bundle targeting least recently trained muscle groups
  let bestScore = -1;
  let bestIdx = 0;

  for (let i = 0; i < finalBundles.length; i++) {
    let score = 0;
    const bundleMuscles = finalBundles[i].exercises.flatMap(e => e.muscle_groups);

    for (const muscle of bundleMuscles) {
      if (!recentMuscleGroups.includes(muscle)) {
        score += 2;
      }
    }

    const uniqueMuscles = new Set(bundleMuscles);
    score += uniqueMuscles.size;

    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }

  if (finalBundles.length > 0) {
    finalBundles[bestIdx].is_recommended = true;
  }

  return {
    bundles: finalBundles,
    stats: {
      total_bundles: finalBundles.length,
      exercises_per_bundle: finalBundles.map(b => b.exercises.length),
    },
  };
}
