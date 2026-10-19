//# ~/lab/mcp-server/middleware/oauth.js
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

// Identity provider settings. OAuth stays off until all three are set.
const JWKS_URI = process.env.OAUTH_JWKS_URI;
const AUDIENCE = process.env.OAUTH_AUDIENCE;
const ISSUER   = process.env.OAUTH_ISSUER;

export const oauthEnabled = Boolean(JWKS_URI && AUDIENCE && ISSUER);

const client = oauthEnabled
  ? jwksClient({ jwksUri: JWKS_URI, cache: true, cacheMaxAge: 3600000, rateLimit: true, jwksRequestsPerMinute: 10 })
  : null;

export async function validateJwt(token) {
  if (!oauthEnabled) throw new Error('OAuth is not configured');
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded?.header?.kid) throw new Error('Invalid token structure');

  const key = await client.getSigningKey(decoded.header.kid);
  const signingKey = key.getPublicKey();

  // Pin the algorithm so a token can't pick a weaker one
  return jwt.verify(token, signingKey, { algorithms: ['RS256'], audience: AUDIENCE, issuer: ISSUER });
}

// Public URL of this server. Set MCP_RESOURCE_URL in production so it
// doesn't depend on proxy headers.
export function resourceUrl(req) {
  return process.env.MCP_RESOURCE_URL || `${req.protocol}://${req.get('host')}`;
}

// RFC 9728 metadata: tells MCP clients which authorization server to log in with
export function protectedResourceMetadata(req, res) {
  if (!oauthEnabled) return res.status(404).json({ error: 'OAuth is not configured' });
  res.json({
    resource: resourceUrl(req),
    authorization_servers: [ISSUER],
    bearer_methods_supported: ['header'],
  });
}

// Sent with 401s so clients can discover the metadata above
export function wwwAuthenticate(req, error) {
  const base = `Bearer resource_metadata="${resourceUrl(req)}/.well-known/oauth-protected-resource"`;
  return error ? `${base}, error="${error}"` : base;
}
