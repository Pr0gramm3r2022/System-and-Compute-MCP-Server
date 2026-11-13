// OAuth (JWT) auth against a local fake identity provider serving a JWKS.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { generateKeyPairSync } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { startApp } from './helpers.js';

const KID = 'test-kid';
const AUDIENCE = 'https://mcp.test';
const ISSUER = 'https://issuer.test/';
const API_KEY = 'test-key-aaa';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const { privateKey: otherKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });

// Fake IdP: serves the public key at /jwks.json
const jwks = { keys: [{ ...publicKey.export({ format: 'jwk' }), kid: KID, use: 'sig', alg: 'RS256' }] };
const idp = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(jwks));
});
await new Promise(r => idp.listen(0, r));

// Env must be set before oauth.js / auth.js are imported
process.env.OAUTH_JWKS_URI = `http://127.0.0.1:${idp.address().port}/jwks.json`;
process.env.OAUTH_AUDIENCE = AUDIENCE;
process.env.OAUTH_ISSUER = ISSUER;
process.env.MCP_API_KEYS = API_KEY;
process.env.ANTHROPICKEY = API_KEY;

const { requireAuth } = await import('../middleware/auth.js');

const sign = (claims = {}, opts = {}, key = privateKey) =>
  jwt.sign({ sub: 'user-123', ...claims }, key, {
    algorithm: 'RS256', keyid: KID, audience: AUDIENCE, issuer: ISSUER, expiresIn: '5m', ...opts,
  });

let app;
before(async () => { app = await startApp(requireAuth); });
after(async () => { await app.close(); await new Promise(r => idp.close(r)); });

const get = (token) => fetch(`${app.url}/protected`, {
  headers: token === undefined ? {} : { Authorization: `Bearer ${token}` },
});

test('missing header -> 401 with WWW-Authenticate pointing at metadata', async () => {
  const res = await get();
  assert.equal(res.status, 401);
  assert.match(res.headers.get('www-authenticate'), /resource_metadata=".*\/\.well-known\/oauth-protected-resource"/);
});

test('API key still works when OAuth is enabled', async () => {
  const res = await get(API_KEY);
  assert.equal(res.status, 200);
});

test('valid JWT -> 200 and req.user populated', async () => {
  const res = await get(sign());
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.user.sub, 'user-123');
});

test('expired JWT -> 401 invalid_token', async () => {
  const res = await get(sign({}, { expiresIn: -10 }));
  assert.equal(res.status, 401);
  assert.match(res.headers.get('www-authenticate'), /error="invalid_token"/);
});

test('wrong audience -> 401', async () => {
  assert.equal((await get(sign({}, { audience: 'https://other' }))).status, 401);
});

test('wrong issuer -> 401', async () => {
  assert.equal((await get(sign({}, { issuer: 'https://evil/' }))).status, 401);
});

test('signed by a different key -> 401', async () => {
  assert.equal((await get(sign({}, {}, otherKey))).status, 401);
});

test('HS256 token (algorithm confusion) -> 401', async () => {
  const token = jwt.sign({ sub: 'x' }, 'secret', { algorithm: 'HS256', keyid: KID, audience: AUDIENCE, issuer: ISSUER });
  assert.equal((await get(token)).status, 401);
});

test('garbage token -> 401', async () => {
  assert.equal((await get('not-a-jwt')).status, 401);
});
