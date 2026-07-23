//# ~/lab/mcp-server/middleware/auth.js
import { createHmac, timingSafeEqual } from 'crypto';
 
// Multiple API keys support (e.g., per-team keys)
const VALID_KEYS = new Set(
  (process.env.MCP_API_KEYS || '').split(',').map(k => k.trim()).filter(Boolean)
);
 
export function requireApiKey(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }
  const provided = authHeader.slice(7).trim();
 
  // Timing-safe comparison prevents timing attacks
  let valid = false;
  for (const key of VALID_KEYS) {
const a = Buffer.from(provided);
    const b = Buffer.from(key);
    if (a.length === b.length && timingSafeEqual(a, b)) { valid = true; break; }
  }
 
  if (!valid) {
    auditLog('AUTH_FAILURE', req);
    return res.status(403).json({ error: 'Invalid API key' });
  }
  auditLog('AUTH_SUCCESS', req);
  next();
}
 
function auditLog(event, req) {
  process.stderr.write(JSON.stringify({
    ts: new Date().toISOString(),
    event,
    ip: req.ip,
    path: req.path,
    ua: req.headers['user-agent']?.slice(0,80),
  }) + '\n');
}
