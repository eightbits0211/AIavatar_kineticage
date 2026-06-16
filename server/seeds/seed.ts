/**
 * Seed script: populates the Exercise Library in MongoDB.
 * 
 * Run: cd server && npx ts-node seeds/seed.ts
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Exercise } from '../src/models/Exercise';
import exercises1 from './exercises.json';
import exercises2 from './exercises-part2.json';
import exercises3 from './exercises-part3.json';

dotenv.config();

async function seed() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('❌ MONGODB_URI not set in .env');
    process.exit(1);
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUri);
  console.log('✅ Connected\n');

  const allExercises = [...exercises1, ...exercises2, ...exercises3];

  console.log(`Seeding ${allExercises.length} exercises...`);

  // Clear existing exercises
  await Exercise.deleteMany({});
  console.log('  Cleared existing exercises');

  // Insert all
  await Exercise.insertMany(allExercises);
  console.log(`  ✅ Inserted ${allExercises.length} exercises\n`);

  // Verify
  const count = await Exercise.countDocuments();
  console.log(`Verification: ${count} exercises in database`);

  // Print summary by category
  const categories = ['strength', 'hypertrophy', 'mobility', 'general_fitness', 'weight_loss', 'home_workout'];
  console.log('\nBreakdown by category:');
  for (const cat of categories) {
    const catCount = await Exercise.countDocuments({ category_tags: cat });
    console.log(`  ${cat}: ${catCount} exercises`);
  }

  // Print summary by substitution group
  const groups = await Exercise.distinct('substitution_group');
  console.log(`\nSubstitution groups: ${groups.length} groups`);
  for (const group of groups) {
    const groupCount = await Exercise.countDocuments({ substitution_group: group });
    console.log(`  ${group}: ${groupCount} exercises`);
  }

  await mongoose.disconnect();
  console.log('\n✅ Seed complete!');
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err.message);
  process.exit(1);
});
