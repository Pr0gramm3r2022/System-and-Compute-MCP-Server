 
//# ~/lab/mcp-server/middleware/oauth.js
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
 
// Configure with your identity provider's JWKS URI
const JWKS_URI = process.env.OAUTH_JWKS_URI || 'https://your-idp.example.com/.well-known/jwks.json';
const AUDIENCE  = process.env.OAUTH_AUDIENCE || 'mcp-lab-server';
const ISSUER    = process.env.OAUTH_ISSUER   || 'https://your-idp.example.com';
 
const client = jwksClient({ jwksUri: JWKS_URI, cache: true, cacheMaxAge: 3600000 });
 
export async function validateJwt(token) {
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded?.header?.kid) throw new Error('Invalid token structure');
 
  const key = await client.getSigningKey(decoded.header.kid);
  const signingKey = key.getPublicKey();
 
  return jwt.verify(token, signingKey, { audience: AUDIENCE, issuer: ISSUER });
}
 
export async function requireOAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try {
    req.user = await validateJwt(token);
    next();
  } catch (e) {
    res.status(403).json({ error: `Token invalid: ${e.message}` });
  }
}
