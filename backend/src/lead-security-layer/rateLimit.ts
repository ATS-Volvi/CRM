/**
 * Stage 1: Bot defense — the cheapest possible filter, runs before we even
 * look at field content. This is what HubSpot/Salesforce-style form
 * protection relies on for the bulk of junk.
 */

import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';

export const rateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 20,                  // 20 submissions per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'held_for_review', reason: 'rate_limited' },
});

/**
 * Expects the client-side form to include a hidden field (e.g. "website_url")
 * that is invisible/disabled via CSS and that real users never fill in.
 * Bots that auto-fill every field trip this instantly, before any DB write.
 */
export function honeypotCheck(req: Request, res: Response, next: NextFunction) {
  if (req.body?.website_url) {
    // Respond as if it succeeded — don't teach bots that they were caught.
    return res.status(200).json({ status: 'received' });
  }
  next();
}
