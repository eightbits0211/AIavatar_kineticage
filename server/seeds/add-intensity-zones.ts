/**
 * Migration script: adds intensity_zone to all exercises in the seed JSON files.
 *
 * Logic:
 * - warm_up / cool_down / balance_mobility phases → low
 * - beginner difficulty → low or moderate
 * - intermediate + primary/core → moderate or high
 * - advanced + primary → high or very_high
 * - cardio_finisher → moderate or high depending on difficulty
 *
 * Run: npx ts-node seeds/add-intensity-zones.ts
 */

import * as fs from 'fs';
import * as path from 'path';

type IntensityZone = 'low' | 'moderate' | 'high' | 'very_high';

function determineIntensityZone(exercise: any): IntensityZone {
  const phases: string[] = exercise.workout_phase || [];
  const difficulty: string = exercise.difficulty_level || 'intermediate';

  // Structural phases are always low intensity
  if (phases.includes('warm_up') || phases.includes('cool_down') || phases.includes('balance_mobility')) {
    return 'low';
  }

  // Cardio finishers
  if (phases.includes('cardio_finisher')) {
    if (difficulty === 'advanced') return 'very_high';
    if (difficulty === 'intermediate') return 'high';
    return 'moderate';
  }

  // Core exercises
  if (phases.includes('core')) {
    if (difficulty === 'advanced') return 'high';
    return 'moderate';
  }

  // Primary / BMI targeting exercises
  if (difficulty === 'beginner') return 'moderate';
  if (difficulty === 'intermediate') return 'high';
  if (difficulty === 'advanced') return 'very_high';

  return 'moderate';
}

const seedFiles = ['exercises.json', 'exercises-part2.json', 'exercises-part3.json'];

for (const file of seedFiles) {
  const filePath = path.join(__dirname, file);
  if (!fs.existsSync(filePath)) {
    console.log(`Skipping ${file} (not found)`);
    continue;
  }

  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  let modified = 0;

  for (const exercise of data) {
    if (!exercise.intensity_zone) {
      exercise.intensity_zone = determineIntensityZone(exercise);
      modified++;
    }
  }

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
  console.log(`${file}: added intensity_zone to ${modified}/${data.length} exercises`);
}

console.log('\nDone! Seed files updated with intensity_zone field.');
