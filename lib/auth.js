/**
 * Dashboard PIN + signed session cookie.
 *   ADMIN_PIN       – the 4-digit PIN (set in Vercel → Settings → Environment Variables)
 *   SESSION_SECRET  – random string used to sign the session cookie
 */
const enc = new TextEncoder();

const toB64url = (buf) => Buffer.from(buf).toString('base64url');

function safeEqual(a, b) {
  const x = enc.encode(String(a));
  const y = enc.encode(String(b));
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

export const pinConfigured = () => /^\d{4,8}$/.test(process.env.ADMIN_PIN || '') && !!process.env.SESSION_SECRET;
export const checkPin = (pin) => pinConfigured() && safeEqual(String(pin ?? '').trim(), process.env.ADMIN_PIN);

async function sign(value) {
  const key = await crypto.subtle.importKey('raw', enc.encode(process.env.SESSION_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return toB64url(await crypto.subtle.sign('HMAC', key, enc.encode(value)));
}

const COOKIE = '__Host-rsvp_admin';
const TTL_S = 12 * 60 * 60;

export async function sessionCookie() {
  const expires = String(Date.now() + TTL_S * 1000);
  const token = `${expires}.${await sign(`admin:${expires}`)}`;
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${TTL_S}`;
}

export const clearCookie = () => `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;

export async function isAdmin(req) {
  if (!pinConfigured()) return false;
  const raw = (req.headers.cookie || '').split(';').map((s) => s.trim()).find((s) => s.startsWith(`${COOKIE}=`));
  if (!raw) return false;
  const [expires, mac] = raw.slice(COOKIE.length + 1).split('.');
  if (!expires || !mac || Number(expires) < Date.now()) return false;
  return safeEqual(mac, await sign(`admin:${expires}`));
}
