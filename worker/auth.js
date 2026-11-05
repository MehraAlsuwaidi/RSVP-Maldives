/**
 * Owner authentication helpers (Web Crypto only, no dependencies).
 *
 * OWNER_PASSWORD_HASH format:  pbkdf2-sha256$<iterations>$<salt b64>$<hash b64>
 * Session cookie:              <expiry ms>.<HMAC-SHA256(expiry) b64url>
 */
const enc = new TextEncoder();

const b64ToBytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
const bytesToB64url = (bytes) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** Constant-time comparison of two byte arrays. */
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function verifyPassword(password, stored) {
  if (typeof password !== 'string' || !password || typeof stored !== 'string') return false;
  const [scheme, iterStr, saltB64, hashB64] = stored.split('$');
  const iterations = Number(iterStr);
  if (scheme !== 'pbkdf2-sha256' || !Number.isInteger(iterations) || iterations < 10000) return false;
  const expected = b64ToBytes(hashB64);
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: b64ToBytes(saltB64), iterations },
    key,
    expected.length * 8,
  );
  return safeEqual(new Uint8Array(bits), expected);
}

async function hmacKey(secret) {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}

async function sign(value, secret) {
  return bytesToB64url(await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(value)));
}

export const SESSION_COOKIE = '__Host-rsvp_owner';
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

export async function createSessionToken(secret, now = Date.now()) {
  const expires = String(now + SESSION_TTL_MS);
  return `${expires}.${await sign(`owner:${expires}`, secret)}`;
}

export async function verifySessionToken(token, secret, now = Date.now()) {
  if (!token || !secret) return false;
  const [expires, mac] = token.split('.');
  if (!expires || !mac || Number(expires) < now) return false;
  const expected = await sign(`owner:${expires}`, secret);
  return safeEqual(enc.encode(mac), enc.encode(expected));
}

export function readCookie(request, name) {
  const header = request.headers.get('Cookie') || '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return null;
}

export function sessionCookie(token, secure) {
  // __Host- prefix requires Secure; plain-HTTP local development uses a normal name.
  const name = secure ? SESSION_COOKIE : 'rsvp_owner';
  const attrs = [`${name}=${token}`, 'Path=/', 'HttpOnly', 'SameSite=Strict', `Max-Age=${SESSION_TTL_MS / 1000}`];
  if (secure) attrs.push('Secure');
  return attrs.join('; ');
}

export function clearSessionCookie(secure) {
  const name = secure ? SESSION_COOKIE : 'rsvp_owner';
  return `${name}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure ? '; Secure' : ''}`;
}

export const cookieName = (secure) => (secure ? SESSION_COOKIE : 'rsvp_owner');
