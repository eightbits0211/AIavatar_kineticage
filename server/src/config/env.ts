import dotenv from 'dotenv';

dotenv.config();

export const env = {
  // Server
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',

  // Database
  mongodbUri: process.env.MONGODB_URI || '',

  // Firebase Auth
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID || '',
  firebasePrivateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  firebaseClientEmail: process.env.FIREBASE_CLIENT_EMAIL || '',

  // Anthropic (Claude)
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',

  // Deepgram
  deepgramApiKey: process.env.DEEPGRAM_API_KEY || '',

  // ElevenLabs
  elevenlabsApiKey: process.env.ELEVENLABS_API_KEY || '',
  elevenlabsVoiceIdMale: process.env.ELEVENLABS_VOICE_ID_MALE || '',
  elevenlabsVoiceIdFemale: process.env.ELEVENLABS_VOICE_ID_FEMALE || '',
} as const;
