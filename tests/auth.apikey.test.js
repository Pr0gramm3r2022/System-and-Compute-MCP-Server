// API-key auth with OAuth disabled.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startApp } from './helpers.js';

const KEY_A = 'test-key-aaa';
const KEY_B = 'test-key-bbb';

// auth.js reads keys at import time, so set env vars before importing it.
process.env.MCP_API_KEYS = `${KEY_A}, ${KEY_B}`;
process.env.ANTHROPICKEY = `${KEY_A}, ${KEY_B}`;
delete process.env.OAUTH_JWKS_URI;
delete process.env.OAUTH_AUDIENCE;
delete process.env.OAUTH_ISSUER;

const { requireAuth } = await import('../middleware/auth.js');

let app;
before(async () => { app = await startApp(requireAuth); });
after(async () => { await app.close(); });

const get = (headers = {}) => fetch(`${app.url}/protected`, { headers });

test('no Authorization header -> 401', async () => {
  const res = await get();
  assert.equal(res.status, 401);
  assert.equal(res.headers.get('www-authenticate'), null); // only sent when OAuth is on
});

test('non-Bearer scheme -> 401', async () => {
  const res = await get({ Authorization: `Basic ${KEY_A}` });
  assert.equal(res.status, 401);
});

test('valid first key -> 200', async () => {
  const res = await get({ Authorization: `Bearer ${KEY_A}` });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, user: null });
});

test('valid second key (comma-separated list, whitespace trimmed) -> 200', async () => {
  const res = await get({ Authorization: `Bearer ${KEY_B}` });
  assert.equal(res.status, 200);
});

test('wrong key -> 403', async () => {
  const res = await get({ Authorization: 'Bearer nope' });
  assert.equal(res.status, 403);
});

test('wrong key of the same length -> 403', async () => {
  const res = await get({ Authorization: `Bearer ${'x'.repeat(KEY_A.length)}` });
  assert.equal(res.status, 403);
});

test('empty Bearer token -> 401 (header value is trimmed to "Bearer")', async () => {
  const res = await get({ Authorization: 'Bearer ' });
  assert.equal(res.status, 401);
});
