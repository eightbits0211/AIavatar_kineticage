import { Request, Response, NextFunction } from 'express';

// Simple in-memory rate limiter (replace with Redis in production)
const requestCounts: Map<string, { count: number; resetTime: number }> = new Map();

const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 60; // 60 requests per minute per user

export const rateLimitMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const key = (req as any).uid || req.ip || 'anonymous';
  const now = Date.now();
  const record = requestCounts.get(key);

  if (!record || now > record.resetTime) {
    requestCounts.set(key, { count: 1, resetTime: now + WINDOW_MS });
    next();
    return;
  }

  if (record.count >= MAX_REQUESTS) {
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please wait before making more requests.',
    });
    return;
  }

  record.count++;
  next();
};
