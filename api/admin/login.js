import { checkPin, pinConfigured, sessionCookie } from '../../lib/auth.js';
import { ensureSchema, sql } from '../../lib/db.js';
import { clientIp, failure, method, sameOrigin, send } from '../../lib/http.js';

/**
 * PIN sign-in. A 4-digit PIN has only 10,000 combinations, so guessing is throttled:
 * 5 wrong tries per IP per 15 minutes, and 30 wrong tries in total per hour.
 */
export default async function handler(req, res) {
  if (!method(req, res, 'POST')) return;
  if (!sameOrigin(req)) return send(res, 403, { ok: false, error: 'forbidden' });
  if (!pinConfigured()) return send(res, 503, { ok: false, error: 'not_configured' });

  try {
    await ensureSchema();
    const ip = clientIp(req);
    const [{ mine, total }] = await sql`
      SELECT count(*) FILTER (WHERE ip = ${ip} AND at > now() - interval '15 minutes')::int AS mine,
             count(*) FILTER (WHERE at > now() - interval '1 hour')::int AS total
      FROM login_failures`;
    if (mine >= 5 || total >= 30) return send(res, 429, { ok: false, error: 'locked' });

    if (!checkPin(req.body?.pin)) {
      await sql`INSERT INTO login_failures (ip) VALUES (${ip})`;
      await sql`DELETE FROM login_failures WHERE at < now() - interval '1 day'`;
      return send(res, 401, { ok: false, error: 'invalid_pin' });
    }
    return send(res, 200, { ok: true }, { 'Set-Cookie': await sessionCookie() });
  } catch (error) {
    return failure(res, error);
  }
}
