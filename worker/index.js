/**
 * RSVP Maldives Worker
 *  - Static assets (invitation at /, owner dashboard at /admin) are served by
 *    the ASSETS binding before this code runs.
 *  - /api/rsvp                POST  public: save a guest's response (idempotent)
 *  - /api/admin/login         POST  owner login → HttpOnly session cookie
 *  - /api/admin/logout        POST
 *  - /api/admin/session       GET   is the owner signed in?
 *  - /api/admin/rsvps         GET   owner only: all responses (JSON)
 *  - /api/admin/rsvps.csv     GET   owner only: filtered CSV download
 */
import { validateRsvp } from '../shared/rsvpValidation.js';
import { filterResponses, toCsv } from '../shared/rsvpFilters.js';
import {
  clearSessionCookie,
  cookieName,
  createSessionToken,
  readCookie,
  sessionCookie,
  verifyPassword,
  verifySessionToken,
} from './auth.js';

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
  'X-Frame-Options': 'DENY',
};

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...SECURITY_HEADERS, ...headers },
  });
}

const clientIp = (request) => request.headers.get('CF-Connecting-IP') || 'local';

/** Browsers always send Origin on POST; reject cross-site posts. */
function sameOrigin(request, url) {
  const origin = request.headers.get('Origin');
  return !origin || origin === url.origin;
}

async function readJson(request, limit = 8 * 1024) {
  if (!(request.headers.get('Content-Type') || '').includes('application/json')) return null;
  const text = await request.text();
  if (text.length > limit) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// Light per-isolate throttle for the public endpoint (best effort).
const hits = new Map();
function throttled(key, max, windowMs) {
  const now = Date.now();
  const list = (hits.get(key) || []).filter((t) => now - t < windowMs);
  list.push(now);
  hits.set(key, list);
  if (hits.size > 5000) hits.clear();
  return list.length > max;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const rowToResponse = (r) => ({
  id: r.id,
  attendance: r.attendance,
  name: r.name,
  phone: r.phone,
  guests: r.guests,
  submittedAt: r.created_at,
  updatedAt: r.updated_at,
});

async function handleRsvp(request, env, url) {
  if (!sameOrigin(request, url)) return json({ ok: false, error: 'forbidden' }, 403);
  if (throttled(`rsvp:${clientIp(request)}`, 30, 10 * 60 * 1000)) return json({ ok: false, error: 'rate_limited' }, 429);

  const body = await readJson(request);
  if (!body) return json({ ok: false, error: 'invalid_body' }, 400);
  if (body.website) return json({ ok: false, error: 'invalid_body' }, 400); // honeypot

  const submissionId = String(body.submissionId || '');
  if (!UUID.test(submissionId)) return json({ ok: false, error: 'invalid_submission_id' }, 400);

  const result = validateRsvp(body, { maxGuests: Number(env.MAX_GUESTS) || 20 });
  if (!result.ok) return json({ ok: false, error: 'validation', errors: result.errors }, 400);
  const { attendance, name, phone, guests } = result.value;

  const now = new Date().toISOString();
  // Upsert on submission_id: a retried or double-sent request updates the same row.
  const row = await env.DB.prepare(
    `INSERT INTO rsvps (id, submission_id, attendance, name, phone, guests, created_at, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)
     ON CONFLICT (submission_id) DO UPDATE SET
       attendance = excluded.attendance, name = excluded.name, phone = excluded.phone,
       guests = excluded.guests, updated_at = excluded.updated_at
     RETURNING id`,
  )
    .bind(crypto.randomUUID(), submissionId, attendance, name, phone, guests, now)
    .first();

  if (!row?.id) return json({ ok: false, error: 'not_saved' }, 500);
  return json({ ok: true, id: row.id }, 201);
}

async function isOwner(request, env, url) {
  const secure = url.protocol === 'https:';
  return verifySessionToken(readCookie(request, cookieName(secure)), env.SESSION_SECRET);
}

async function handleLogin(request, env, url) {
  if (!sameOrigin(request, url)) return json({ ok: false, error: 'forbidden' }, 403);
  if (!env.OWNER_PASSWORD_HASH || !env.SESSION_SECRET) return json({ ok: false, error: 'not_configured' }, 503);

  const ip = clientIp(request);
  const windowStart = Date.now() - 15 * 60 * 1000;
  const { failures } = await env.DB.prepare('SELECT COUNT(*) AS failures FROM login_failures WHERE ip = ?1 AND at > ?2')
    .bind(ip, windowStart)
    .first();
  if (failures >= 8) return json({ ok: false, error: 'locked' }, 429);

  const body = await readJson(request);
  const ok = await verifyPassword(body?.password, env.OWNER_PASSWORD_HASH);
  if (!ok) {
    await env.DB.batch([
      env.DB.prepare('INSERT INTO login_failures (ip, at) VALUES (?1, ?2)').bind(ip, Date.now()),
      env.DB.prepare('DELETE FROM login_failures WHERE at < ?1').bind(Date.now() - 24 * 60 * 60 * 1000),
    ]);
    return json({ ok: false, error: 'invalid_password' }, 401);
  }
  await env.DB.prepare('DELETE FROM login_failures WHERE ip = ?1').bind(ip).run();
  const secure = url.protocol === 'https:';
  const token = await createSessionToken(env.SESSION_SECRET);
  return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie(token, secure) });
}

async function listResponses(env) {
  const { results } = await env.DB.prepare(
    'SELECT id, attendance, name, phone, guests, created_at, updated_at FROM rsvps ORDER BY created_at DESC',
  ).all();
  return results.map(rowToResponse);
}

async function handleApi(request, env, url) {
  const { pathname } = url;
  const method = request.method;

  if (pathname === '/api/rsvp') {
    if (method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);
    return handleRsvp(request, env, url);
  }

  if (pathname === '/api/admin/login' && method === 'POST') return handleLogin(request, env, url);

  if (pathname === '/api/admin/logout' && method === 'POST') {
    if (!sameOrigin(request, url)) return json({ ok: false, error: 'forbidden' }, 403);
    return json({ ok: true }, 200, { 'Set-Cookie': clearSessionCookie(url.protocol === 'https:') });
  }

  if (pathname.startsWith('/api/admin/')) {
    // Every owner endpoint below this line requires a valid session.
    if (!(await isOwner(request, env, url))) return json({ ok: false, error: 'unauthorised' }, 401);

    if (pathname === '/api/admin/session' && method === 'GET') return json({ ok: true, authenticated: true });

    if (pathname === '/api/admin/rsvps' && method === 'GET') {
      return json({ ok: true, responses: await listResponses(env), fetchedAt: new Date().toISOString() });
    }

    if (pathname === '/api/admin/rsvps.csv' && method === 'GET') {
      const rows = filterResponses(await listResponses(env), {
        q: url.searchParams.get('q') || '',
        attendance: url.searchParams.get('attendance') || 'all',
        sort: url.searchParams.get('sort') || 'newest',
      });
      const stamp = new Date().toISOString().slice(0, 10);
      return new Response(toCsv(rows), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="rsvps-${stamp}.csv"`,
          'Cache-Control': 'no-store',
          ...SECURITY_HEADERS,
        },
      });
    }
  }

  return json({ ok: false, error: 'not_found' }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      try {
        return await handleApi(request, env, url);
      } catch (error) {
        console.error('API error', error);
        return json({ ok: false, error: 'server_error' }, 500);
      }
    }
    // Anything else that isn't a static file.
    if (url.pathname === '/admin') return Response.redirect(`${url.origin}/admin/`, 308);
    return new Response('Not found', { status: 404, headers: SECURITY_HEADERS });
  },
};
