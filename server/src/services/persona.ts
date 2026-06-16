import { IUser } from '../models/User';

type PersonaTag =
  | 'complete_beginner'
  | 'regular_gym_goer'
  | 'weight_loss_seeker'
  | 'home_workout_user'
  | 'office_professional'
  | 'injury_recovery_user'
  | 'ai_companion_seeker'
  | 'inconsistent_enthusiast';

/**
 * Assigns persona tags based on user profile attributes.
 * Rules from PRD Section 3.2:
 * - Complete Beginner: Sedentary + no prior program
 * - Regular Gym-Goer: Moderate/Very Active + Gym + prior program
 * - Weight Loss Seeker: Goal = Weight Loss
 * - Home Workout User: Location = Home + None/minimal equipment
 * - Office Professional: Sedentary/Light activity + 15 or 30 min duration
 * - Injury Recovery User: Injuries ≠ None
 * - AI Companion Seeker: Talkativeness = High (behavioral in first week, but assigned on High setting at onboarding)
 * - Inconsistent Enthusiast: Behavioral — applied after 2 weeks (not at onboarding)
 *
 * A user typically carries 2-4 tags simultaneously. Tags are NOT mutually exclusive.
 */
export function assignPersonaTags(user: IUser): PersonaTag[] {
  const tags: PersonaTag[] = [];

  // Complete Beginner: Sedentary + no prior structured program
  if (
    user.activity_level === 'sedentary' &&
    user.prior_program_experience === false
  ) {
    tags.push('complete_beginner');
  }

  // Regular Gym-Goer: Moderate/Very Active + Gym + prior program experience
  if (
    (user.activity_level === 'moderately_active' || user.activity_level === 'very_active') &&
    user.workout_location === 'gym' &&
    user.prior_program_experience === true
  ) {
    tags.push('regular_gym_goer');
  }

  // Weight Loss Seeker: Goal = Weight Loss (regardless of other signals)
  if (user.fitness_goal === 'weight_loss') {
    tags.push('weight_loss_seeker');
  }

  // Home Workout User: Location = Home + None or minimal equipment (bands/dumbbells only)
  const minimalEquipment = ['none', 'dumbbells', 'resistance_bands', 'exercise_mat'];
  if (
    user.workout_location === 'home' &&
    user.equipment.every(eq => minimalEquipment.includes(eq))
  ) {
    tags.push('home_workout_user');
  }

  // Office Professional: Sedentary/Light activity + short duration (15 or 30 min)
  if (
    (user.activity_level === 'sedentary' || user.activity_level === 'lightly_active') &&
    (user.workout_duration === 15 || user.workout_duration === 30)
  ) {
    tags.push('office_professional');
  }

  // Injury Recovery User: Any injury reported (excluding "none")
  if (
    user.injuries &&
    user.injuries.length > 0 &&
    !user.injuries.every(i => i === 'none')
  ) {
    tags.push('injury_recovery_user');
  }

  // AI Companion Seeker: Talkativeness set to High during onboarding
  if (user.companion_preferences?.talkativeness === 'high') {
    tags.push('ai_companion_seeker');
  }

  // Inconsistent Enthusiast: NOT assigned at onboarding
  // This is a behavioral persona applied after 2 weeks of usage
  // when workout completion rate < 50% of stated target.
  // See: evaluateBehavioralPersonas() below

  return tags;
}

/**
 * Evaluates behavioral personas that require usage history.
 * Called weekly by a scheduled job or on-demand.
 *
 * Inconsistent Enthusiast criteria:
 * - User has completed onboarding and at least one workout
 * - Workout frequency drops below 50% of stated target over a rolling 2-week window
 */
export function evaluateInconsistentEnthusiast(
  statedDaysPerWeek: number,
  completedSessionsLast14Days: number
): boolean {
  const expectedSessions = statedDaysPerWeek * 2; // 2-week window
  const completionRate = completedSessionsLast14Days / expectedSessions;
  return completionRate < 0.5;
}

/**
 * Calculates user metrics from profile data.
 * Called after onboarding submission and whenever profile is updated.
 *
 * Formulas from PRD Section 2.2:
 * - BMI = weight(kg) / height(m)²
 * - BMR (Mifflin-St Jeor): Male = (10×weight) + (6.25×height) − (5×age) + 5
 *                           Female = (10×weight) + (6.25×height) − (5×age) − 161
 *                           Other = average of male and female
 * - TDEE = BMR × activity multiplier
 * - MHR = 220 − age
 * - Target Zone = 60% to 80% of MHR
 */
export function calculateMetrics(user: IUser) {
  const heightM = user.height_cm / 100;
  const bmi = user.weight_kg / (heightM * heightM);

  let bmiCategory: string;
  if (bmi < 18.5) bmiCategory = 'underweight';
  else if (bmi < 25) bmiCategory = 'normal';
  else if (bmi < 30) bmiCategory = 'overweight';
  else bmiCategory = 'obese';

  // BMR calculation (Mifflin-St Jeor)
  const maleBmr = (10 * user.weight_kg) + (6.25 * user.height_cm) - (5 * user.age) + 5;
  const femaleBmr = (10 * user.weight_kg) + (6.25 * user.height_cm) - (5 * user.age) - 161;

  let bmr: number;
  if (user.gender === 'male') {
    bmr = maleBmr;
  } else if (user.gender === 'female') {
    bmr = femaleBmr;
  } else {
    bmr = (maleBmr + femaleBmr) / 2;
  }

  // Activity multiplier
  const activityMultipliers: Record<string, number> = {
    sedentary: 1.2,
    lightly_active: 1.375,
    moderately_active: 1.55,
    very_active: 1.725,
  };
  const multiplier = activityMultipliers[user.activity_level] || 1.2;
  const tdee = bmr * multiplier;

  // TDEE range (±5%)
  const tdeeRange = {
    low: Math.round(tdee * 0.95),
    high: Math.round(tdee * 1.05),
  };

  // Max Heart Rate and Target Zone
  const maxHeartRate = 220 - user.age;
  const targetZone = {
    low: Math.round(maxHeartRate * 0.6),
    high: Math.round(maxHeartRate * 0.8),
  };

  return {
    bmi: Math.round(bmi * 10) / 10,
    bmi_category: bmiCategory,
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    tdee_range: tdeeRange,
    max_heart_rate: maxHeartRate,
    target_zone: targetZone,
  };
}
