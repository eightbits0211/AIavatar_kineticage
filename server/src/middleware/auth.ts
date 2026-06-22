import { Request, Response, NextFunction } from 'express';
import admin from 'firebase-admin';
import { env } from '../config/env';

// Initialize Firebase Admin SDK only if real credentials are provided
if (!admin.apps.length && !env.firebasePrivateKey.includes('REPLACE_WITH_REAL')) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: env.firebaseProjectId,
        privateKey: env.firebasePrivateKey,
        clientEmail: env.firebaseClientEmail,
      }),
    });
    console.log('✅ Firebase Admin SDK initialized');
  } catch (error) {
    console.warn('⚠️ Firebase Admin SDK failed to initialize:', error);
  }
} else {
  console.log('⚠️ Firebase Admin SDK not initialized - using placeholder credentials');
}

export interface AuthRequest extends Request {
  uid?: string;
}

export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized', message: 'No token provided' });
    return;
  }

  const token = authHeader.split('Bearer ')[1];

  // If Firebase Admin isn't properly configured, allow development access
  if (env.firebasePrivateKey.includes('REPLACE_WITH_REAL')) {
    console.log('⚠️ Development mode - bypassing Firebase auth verification');
    req.uid = 'dev-user-123'; // Mock UID for development
    next();
    return;
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.uid = decodedToken.uid;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token' });
  }
};
