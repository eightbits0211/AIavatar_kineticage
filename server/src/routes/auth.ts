import { Router, Response } from 'express';
import admin from 'firebase-admin';
import { User } from '../models';
import { AuthRequest, authMiddleware } from '../middleware/auth';

const router = Router();

/**
 * POST /api/auth/guest
 * Creates an anonymous Firebase user and returns a custom token.
 * The mobile app uses this token to sign in anonymously.
 * A user profile is created in MongoDB with is_guest = true.
 */
router.post('/guest', async (req, res: Response) => {
  try {
    // Create anonymous user in Firebase
    const userRecord = await admin.auth().createUser({});

    // Create a custom token for the anonymous user
    const customToken = await admin.auth().createCustomToken(userRecord.uid);

    // Create a minimal user profile in MongoDB
    const user = new User({
      firebase_uid: userRecord.uid,
      name: 'Guest',
      email: '',
      is_guest: true,
      onboarding_completed: false,
    });

    await user.save();

    res.status(201).json({
      token: customToken,
      uid: userRecord.uid,
      is_guest: true,
      message: 'Guest account created. Complete onboarding to personalize your experience.',
    });
  } catch (error: any) {
    console.error('Guest login error:', error.message);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to create guest account' });
  }
});

/**
 * POST /api/auth/upgrade
 * Upgrades a guest account to a full account (after signing in with Google/email).
 * The mobile app handles the Firebase linking; this endpoint updates our MongoDB record.
 */
router.post('/upgrade', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { name, email } = req.body;

    const user = await User.findOneAndUpdate(
      { firebase_uid: req.uid },
      {
        name: name || '',
        email: email || '',
        is_guest: false,
      },
      { new: true }
    );

    if (!user) {
      res.status(404).json({ error: 'Not Found', message: 'User not found' });
      return;
    }

    res.json({
      message: 'Account upgraded successfully',
      user,
    });
  } catch (error: any) {
    console.error('Account upgrade error:', error.message);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to upgrade account' });
  }
});

/**
 * POST /api/auth/google
 * Called after the mobile app completes Google sign-in via Firebase.
 * Creates or retrieves the user profile in MongoDB.
 */
router.post('/google', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    let user = await User.findOne({ firebase_uid: req.uid });

    if (user) {
      // Existing user — return profile
      res.json({ user, is_new: false });
      return;
    }

    // New user — create profile
    const { name, email } = req.body;
    user = new User({
      firebase_uid: req.uid,
      name: name || '',
      email: email || '',
      is_guest: false,
      onboarding_completed: false,
    });

    await user.save();

    res.status(201).json({ user, is_new: true });
  } catch (error: any) {
    console.error('Google auth error:', error.message);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to process Google sign-in' });
  }
});

export default router;
