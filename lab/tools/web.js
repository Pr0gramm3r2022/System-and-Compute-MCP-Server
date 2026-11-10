// lab/tools/web.js
import { z } from 'zod';
import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns';
import net from 'node:net';
import { logger } from '../logger.js';

// --- SSRF protection -------------------------------------------------------
// The server runs on Cloud Run, where http://metadata.google.internal
// (169.254.169.254) hands out service-account tokens. Any address that is not
// public internet is refused, and the check runs against the IP actually
// connected to (via a custom DNS lookup), so DNS rebinding can't sneak past it.

const BLOCKED = new net.BlockList();
for (const [addr, prefix] of [
  ['0.0.0.0', 8],       // "this" network
  ['10.0.0.0', 8],      // private
  ['100.64.0.0', 10],   // carrier-grade NAT
  ['127.0.0.0', 8],     // loopback
  ['169.254.0.0', 16],  // link-local, incl. cloud metadata
  ['172.16.0.0', 12],   // private
  ['192.0.0.0', 24],    // IETF protocol assignments
  ['192.168.0.0', 16],  // private
  ['198.18.0.0', 15],   // benchmarking
  ['224.0.0.0', 4],     // multicast
  ['240.0.0.0', 4],     // reserved + broadcast
]) BLOCKED.addSubnet(addr, prefix, 'ipv4');
for (const [addr, prefix] of [
  ['::', 128],          // unspecified
  ['::1', 128],         // loopback
  ['64:ff9b::', 96],    // NAT64
  ['fc00::', 7],        // unique local
  ['fe80::', 10],       // link-local
  ['ff00::', 8],        // multicast
]) BLOCKED.addSubnet(addr, prefix, 'ipv6');

const BLOCKED_HOSTNAMES = new Set(['localhost', 'metadata', 'metadata.google.internal']);

// Headers the caller may not set: metadata-server credentials headers, and
// ones that would let the caller spoof routing or framing.
const FORBIDDEN_HEADERS = new Set([
  'host', 'metadata-flavor', 'x-google-metadata-request',
  'connection', 'content-length', 'transfer-encoding', 'upgrade',
  'proxy-authorization', 'te', 'trailer', 'keep-alive',
]);

const MAX_REDIRECTS = 5;
const MAX_BODY_BYTES = 1024 * 1024;
const TIMEOUT_MS = 10_000;
const SHOWN_CHARS = 4000;

// ::ffff:a.b.c.d and ::ffff:XXXX:XXXX are IPv4 addresses in disguise; unwrap
// them so the IPv4 rules apply. (A ::ffff:0:0/96 subnet can't be used for
// this: BlockList matches plain IPv4 addresses against it too.)
function unwrapMappedV4(ip) {
  const m = ip.toLowerCase().match(/^(?:0{0,4}:){0,5}:?ffff:(.+)$/);
  if (!m) return null;
  if (net.isIPv4(m[1])) return m[1];
  const hex = m[1].match(/^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (!hex) return null;
  const n = (parseInt(hex[1], 16) << 16 >>> 0) + parseInt(hex[2], 16);
  return [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
}

export function isBlockedAddress(ip) {
  const family = net.isIP(ip);
  if (family === 0) return true; // not an IP at all: refuse
  if (family === 6) {
    const v4 = unwrapMappedV4(ip);
    if (v4) return BLOCKED.check(v4, 'ipv4');
  }
  return BLOCKED.check(ip, family === 6 ? 'ipv6' : 'ipv4');
}

// dns.lookup replacement handed to http(s).request: resolves normally, then
// fails the connection if any resolved address is internal.
function guardedLookup(hostname, options, callback) {
  if (typeof options === 'function') { callback = options; options = {}; }
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err);
    const bad = addresses.find(a => isBlockedAddress(a.address));
    if (bad) {
      return callback(new Error(`Blocked: ${hostname} resolves to non-public address ${bad.address}`));
    }
    if (options.all) return callback(null, addresses);
    callback(null, addresses[0].address, addresses[0].family);
  });
}

// Checks that don't need DNS: scheme, hostname, and literal-IP hosts
// (http.request skips the lookup function for those).
export function validateUrl(raw) {
  const url = new URL(raw);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Blocked: only http and https are allowed, got ${url.protocol}`);
  }
  if (url.username || url.password) {
    throw new Error('Blocked: credentials in the URL are not allowed');
  }
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase().replace(/\.$/, '');
  if (BLOCKED_HOSTNAMES.has(host) || host.endsWith('.localhost') || host.endsWith('.internal')) {
    throw new Error(`Blocked: host ${host} is not allowed`);
  }
  if (net.isIP(host) && isBlockedAddress(host)) {
    throw new Error(`Blocked: ${host} is a non-public address`);
  }
  return url;
}

export function sanitizeHeaders(headers = {}) {
  const out = {};
  for (const [k, v] of Object.entries(headers)) {
    if (!FORBIDDEN_HEADERS.has(k.toLowerCase())) out[k] = v;
  }
  return out;
}

function requestOnce(url, headers) {
  const mod = url.protocol === 'https:' ? https : http;
  return new Promise((resolvePromise, reject) => {
    const req = mod.request(url, {
      method: 'GET',
      headers,
      lookup: guardedLookup,
      timeout: TIMEOUT_MS,
    }, (res) => {
      const chunks = [];
      let size = 0;
      res.on('data', (chunk) => {
        size += chunk.length;
        if (size > MAX_BODY_BYTES) {
          res.destroy();
          return resolvePromise({ res, body: Buffer.concat(chunks).toString('utf8'), truncated: true });
        }
        chunks.push(chunk);
      });
      res.on('end', () => resolvePromise({ res, body: Buffer.concat(chunks).toString('utf8'), truncated: false }));
      res.on('error', reject);
    });
    req.on('timeout', () => req.destroy(new Error(`Timed out after ${TIMEOUT_MS} ms`)));
    req.on('error', reject);
    req.end();
  });
}

// Follows redirects by hand so every hop goes through validateUrl and the
// guarded lookup (a public URL could otherwise redirect to the metadata server).
export async function safeGet(rawUrl, callerHeaders = {}) {
  const headers = { 'User-Agent': 'curl/7.64.1', ...sanitizeHeaders(callerHeaders) };
  let url = validateUrl(rawUrl);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const { res, body, truncated } = await requestOnce(url, headers);
    const location = res.headers.location;
    if (res.statusCode >= 300 && res.statusCode < 400 && location) {
      const next = validateUrl(new URL(location, url).toString());
      // Don't carry caller-supplied auth to a different origin.
      if (next.origin !== url.origin) {
        for (const k of Object.keys(headers)) {
          if (['authorization', 'cookie'].includes(k.toLowerCase())) delete headers[k];
        }
      }
      url = next;
      continue;
    }
    return { status: res.statusCode, url: url.toString(), body, truncated };
  }
  throw new Error(`Too many redirects (more than ${MAX_REDIRECTS})`);
}

export function registerWebTools(server) {
  server.tool(
    'http_get',
    'Perform an HTTP GET request to a public internet URL. Private, loopback, link-local and cloud metadata addresses are blocked.',
    {
      url: z.string().url().describe('Full URL including https://'),
      headers: z.record(z.string(), z.string()).optional().describe('Optional request headers'),
    },
    async ({ url, headers = {} }) => {
      logger.info('http_get', 'Fetching', { url });
      try {
        const { status, url: finalUrl, body, truncated } = await safeGet(url, headers);
        const result = {
          status,
          ...(finalUrl !== url ? { finalUrl } : {}),
          body: body.slice(0, SHOWN_CHARS) + (truncated || body.length > SHOWN_CHARS ? '...[truncated]' : ''),
        };
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        logger.warn('http_get', 'Refused or failed', { url, error: e.message });
        return { content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true };
      }
    }
  );
}
