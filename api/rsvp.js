import { validateRsvp } from '../shared/rsvpValidation.js';
import { ensureSchema, sql } from '../lib/db.js';
import { failure, method, sameOrigin, send } from '../lib/http.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_GUESTS = Number(process.env.MAX_GUESTS) || 20;

/** Public: save one guest response. Idempotent per submissionId (retries never duplicate). */
export default async function handler(req, res) {
  if (!method(req, res, 'POST')) return;
  if (!sameOrigin(req)) return send(res, 403, { ok: false, error: 'forbidden' });

  const body = req.body && typeof req.body === 'object' ? req.body : null;
  if (!body) return send(res, 400, { ok: false, error: 'invalid_body' });
  if (body.website) return send(res, 400, { ok: false, error: 'invalid_body' }); // honeypot
  if (!UUID.test(String(body.submissionId || ''))) return send(res, 400, { ok: false, error: 'invalid_submission_id' });

  const result = validateRsvp(body, { maxGuests: MAX_GUESTS });
  if (!result.ok) return send(res, 400, { ok: false, error: 'validation', errors: result.errors });
  const { attendance, name, phone, guests } = result.value;

  try {
    await ensureSchema();
    const rows = await sql`
      INSERT INTO rsvps (id, submission_id, attendance, name, phone, guests)
      VALUES (${crypto.randomUUID()}, ${body.submissionId}, ${attendance}, ${name}, ${phone}, ${guests})
      ON CONFLICT (submission_id) DO UPDATE SET
        attendance = EXCLUDED.attendance, name = EXCLUDED.name, phone = EXCLUDED.phone,
        guests = EXCLUDED.guests, updated_at = now()
      RETURNING id`;
    if (!rows[0]?.id) return send(res, 500, { ok: false, error: 'not_saved' });
    return send(res, 201, { ok: true, id: rows[0].id });
  } catch (error) {
    return failure(res, error);
  }
}
