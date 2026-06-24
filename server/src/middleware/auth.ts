import { Request, Response, NextFunction } from 'express';
import admin from 'firebase-admin';
import { env } from '../config/env';

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: env.firebaseProjectId,
      privateKey: env.firebasePrivateKey,
      clientEmail: env.firebaseClientEmail,
    }),
  });
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

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.uid = decodedToken.uid;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token' });
  }
};
