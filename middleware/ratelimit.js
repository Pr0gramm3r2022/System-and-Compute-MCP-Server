//# ~/lab/mcp-server/middleware/ratelimit.js
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
 
// Global rate limit: 100 requests per 15 minutes per IP
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  //message: { error: 'Too many requests. Retry after 15 minutes.' }, claude recommendations: no customm key generator - default handles IPv4/IPv6 correctly
});
 
// Strict limit for destructive tools: 10 deletes per hour
export const destructiveLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.headers['x-api-key'] || ipKeyGenerator(req.ip),
  message: { error: 'Delete limit reached. Contact admin.' },
});
