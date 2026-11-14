// SSRF guard for http_get and path containment for the filesystem tools.
/*import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { homedir, hostname } from 'node:os';
import { resolve } from 'node:path';
import { isBlockedAddress, validateUrl, sanitizeHeaders, safeGet } from '../lab/tools/web.js';
import { safePath } from '../lab/tools/filesystem.js';

test('internal addresses are blocked', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254',
                    '100.64.0.1', '0.0.0.0', '::1', '::', 'fe80::1', 'fd00::1', '::ffff:127.0.0.1',
                    '::ffff:169.254.169.254', '::ffff:a9fe:a9fe', '::ffff:7f00:1']) {
    assert.equal(isBlockedAddress(ip), true, ip);
  }
});

test('public addresses are allowed', () => {
  for (const ip of ['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111', '::ffff:8.8.8.8']) {
    assert.equal(isBlockedAddress(ip), false, ip);
  }
});

test('validateUrl rejects metadata, loopback, bad schemes, credentials', () => {
  for (const u of [
    'http://metadata.google.internal/computeMetadata/v1/',
    'http://metadata/computeMetadata/v1/',
    'http://169.254.169.254/latest/meta-data/',
    'http://127.0.0.1:3000/',
    'http://[::1]/',
    'http://[::ffff:a9fe:a9fe]/',
    'http://localhost/',
    'http://foo.localhost/',
    'file:///etc/passwd',
    'ftp://example.com/',
    'https://user:pw@example.com/',
  ]) {
    assert.throws(() => validateUrl(u), /Blocked/, u);
  }
  assert.doesNotThrow(() => validateUrl('https://example.com/path?q=1'));
});

test('metadata and routing headers are stripped', () => {
  const out = sanitizeHeaders({ 'Metadata-Flavor': 'Google', Host: 'x', 'X-Google-Metadata-Request': 'True', Accept: 'text/html' });
  assert.deepEqual(out, { Accept: 'text/html' });
});

// A hostname that resolves to loopback must be refused at connect time.
let srv, port;
before(async () => {
  srv = http.createServer((req, res) => res.end('secret')).listen(0, '127.0.0.1');
  await new Promise(r => srv.once('listening', r));
  port = srv.address().port;
});
after(() => srv.close());

test('literal internal IP is refused before connecting', async () => {
  await assert.rejects(safeGet(`http://127.0.0.1:${port}/`), /Blocked/);
});

test('hostname resolving to loopback is refused at DNS lookup', async (t) => {
  // In most containers the machine's own hostname maps to 127.x or a private IP.
  const name = hostname();
  if (!name || name === 'localhost') return t.skip('no usable hostname');
  await assert.rejects(safeGet(`http://${name}:${port}/`), /Blocked: .* resolves to non-public address/);
});

test('safePath keeps paths inside ~/lab', () => {
  const root = resolve(homedir(), 'lab');
  assert.equal(safePath('.'), root);
  assert.equal(safePath('logs/a.log'), resolve(root, 'logs/a.log'));
  assert.throws(() => safePath('../lab-other/secret'), /traversal/);
  assert.throws(() => safePath('../.ssh/id_rsa'), /traversal/);
  assert.throws(() => safePath('/etc/passwd'), /traversal/);
}); */

// SSRF guard for http_get and path containment for the filesystem tools.
import { describe, it, beforeAll, afterAll } from '@jest/globals';
import assert from 'node:assert/strict';
import http from 'node:http';
import { homedir, hostname } from 'node:os';
import { resolve } from 'node:path';
import { isBlockedAddress, validateUrl, sanitizeHeaders, safeGet } from '../lab/tools/web.js';
import { safePath } from '../lab/tools/filesystem.js';

describe('SSRF and Path Containment Security Tests', () => {

  it('internal addresses are blocked', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254',
                     '100.64.0.1', '0.0.0.0', '::1', '::', 'fe80::1', 'fd00::1', '::ffff:127.0.0.1',
                     '::ffff:169.254.169.254', '::ffff:a9fe:a9fe', '::ffff:7f00:1']) {
      assert.equal(isBlockedAddress(ip), true, ip);
    }
  });

  it('public addresses are allowed', () => {
    for (const ip of ['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111', '::ffff:8.8.8.8']) {
      assert.equal(isBlockedAddress(ip), false, ip);
    }
  });

  it('validateUrl rejects metadata, loopback, bad schemes, credentials', () => {
    for (const u of [
      'http://metadata.google.internal/computeMetadata/v1/',
      'http://metadata/computeMetadata/v1/',
      'http://169.254.169.254/latest/meta-data/',
      'http://127.0.0.1:3000/',
      'http://[::1]/',
      'http://[::ffff:a9fe:a9fe]/',
      'http://localhost/',
      'http://foo.localhost/',
      'file:///etc/passwd',
      'ftp://example.com/',
      'https://user:pw@example.com/',
    ]) {
      assert.throws(() => validateUrl(u), /Blocked/, u);
    }
    assert.doesNotThrow(() => validateUrl('https://example.com/path?q=1'));
  });

  it('metadata and routing headers are stripped', () => {
    const out = sanitizeHeaders({ 'Metadata-Flavor': 'Google', Host: 'x', 'X-Google-Metadata-Request': 'True', Accept: 'text/html' });
    assert.deepEqual(out, { Accept: 'text/html' });
  });

  // A hostname that resolves to loopback must be refused at connect time.
  let srv, port;
  beforeAll(async () => {
    srv = http.createServer((req, res) => res.end('secret')).listen(0, '127.0.0.1');
    await new Promise(r => srv.once('listening', r));
    port = srv.address().port;
  });
  afterAll(() => srv.close());

  it('literal internal IP is refused before connecting', async () => {
    await assert.rejects(safeGet(`http://127.0.0.1:${port}/`), /Blocked/);
  });

  it('hostname resolving to loopback is refused at DNS lookup', async () => {
    const name = hostname();
    if (!name || name === 'localhost') return; // skip if no usable hostname
    await assert.rejects(safeGet(`http://${name}:${port}/`), /Blocked: .* resolves to non-public address/);
  });

  it('safePath keeps paths inside ~/lab', () => {
    const root = resolve(homedir(), 'lab');
    assert.equal(safePath('.'), root);
    assert.equal(safePath('logs/a.log'), resolve(root, 'logs/a.log'));
    assert.throws(() => safePath('../lab-other/secret'), /traversal/);
    assert.throws(() => safePath('../.ssh/id_rsa'), /traversal/);
    assert.throws(() => safePath('/etc/passwd'), /traversal/);
  });

});
