//# ~/lab/mcp-server/middleware/auth.js
/*import {createHash, timingSafeEqual } from 'crypto';
import { oauthEnabled, validateJwt, wwwAuthenticate } from './oauth.js';

// Multiple API keys support (e.g., per-team keys)
const VALID_KEYS = new Set(
  //was previously .MCP_API_KEY
  (process.env.MCP_API_KEYS || '').split(',').map(k => k.trim()).filter(Boolean)
);

// Timing-safe comparison prevents timing attacks
function isValidApiKey(provided) {
  const a = Buffer.from(provided);
  for (const key of VALID_KEYS) {
    const b = Buffer.from(key);
    if (a.length === b.length && timingSafeEqual(a, b)) return true;
  }
  return false;
}

// Accepts either an API key from MCP_API_KEYS or, when OAuth is configured,
// a JWT from the identity provider. Both arrive as "Authorization: Bearer <token>".
export async function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  if (!authHeader.startsWith('Bearer ')) {
    if (oauthEnabled) res.set('WWW-Authenticate', wwwAuthenticate(req));
    return res.status(401).json({ error: 'Missing Authorization header' });
  } 
  const provided = authHeader.slice(7).trim();

  if (isValidApiKey(provided)) {
    auditLog('AUTH_SUCCESS', req, { method: 'api_key' });
    return next();
  }

  if (oauthEnabled) {
        try {
      req.user = await validateJwt(provided);
      auditLog('AUTH_SUCCESS', req, { method: 'oauth', sub: req.user.sub });
      return next();
    } catch (e) {
      // Log the reason, but don't tell the caller why the token failed
      auditLog('AUTH_FAILURE', req, { method: 'oauth', reason: e.message });
      res.set('WWW-Authenticate', wwwAuthenticate(req, 'invalid_token'));
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  }

  auditLog('AUTH_FAILURE', req, { method: 'api_key' });
  return res.status(403).json({ error: 'Invalid API key' });
}

function auditLog(event, req, extra = {}) {
  process.stderr.write(JSON.stringify({
    ts: new Date().toISOString(),
    event,
    ip: req.ip,
    path: req.path,
    ua: req.headers['user-agent']?.slice(0,80),
    ...extra,
  }) + '\n');
}*/

// ~/lab/mcp-server/middleware/auth.js
import { createHash, timingSafeEqual } from 'crypto';
import { oauthEnabled, validateJwt, wwwAuthenticate } from './oauth.js';

// Helper to hash keys to a fixed length (prevents length leaks and buffer size mismatches)
function hashKey(key) {
  return createHash('sha256').update(key).digest();
}

// Dynamically fetch valid keys to avoid module-load timing issues with dotenv
function getValidKeyHashes() {
  const keys = (process.env.MCP_API_KEYS || '')
    .split(',')
    .map(k => k.trim())
    .filter(Boolean);
  return new Set(keys.map(hashKey));
}

// Timing-safe comparison using fixed-size SHA-256 hashes
function isValidApiKey(provided) {
  const providedHash = hashKey(provided);
  const validHashes = getValidKeyHashes();
  
  for (const validHash of validHashes) {
    if (timingSafeEqual(providedHash, validHash)) return true;
  }
  return false;
}

export async function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  if (!authHeader.startsWith('Bearer ')) {
    if (oauthEnabled) res.set('WWW-Authenticate', wwwAuthenticate(req));
    return res.status(401).json({ error: 'Missing Authorization header' });
  }
  const provided = authHeader.slice(7).trim();

  if (isValidApiKey(provided)) {
    auditLog('AUTH_SUCCESS', req, { method: 'api_key' });
    return next();
  }

  if (oauthEnabled) {
    try {
      req.user = await validateJwt(provided);
      auditLog('AUTH_SUCCESS', req, { method: 'oauth', sub: req.user.sub });
      return next();
    } catch (e) {
      auditLog('AUTH_FAILURE', req, { method: 'oauth', reason: e.message });
      res.set('WWW-Authenticate', wwwAuthenticate(req, 'invalid_token'));
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  }

  auditLog('AUTH_FAILURE', req, { method: 'api_key' });
  return res.status(403).json({ error: 'Invalid API key' });
}

function auditLog(event, req, extra = {}) {
  process.stderr.write(JSON.stringify({
    ts: new Date().toISOString(),
    event,
    ip: req.ip,
    path: req.path,
    ua: req.headers['user-agent']?.slice(0,80),
    ...extra,
  }) + '\n');
}

