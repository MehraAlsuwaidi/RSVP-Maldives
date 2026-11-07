import { EVENT_ID, validateRsvp } from '../shared/rsvpValidation.js';
import { ensureSchema, sql } from '../lib/db.js';
import { failure, method, sameOrigin, send } from '../lib/http.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_GUESTS = Number(process.env.MAX_GUESTS) || 20;

const phoneTaken = (res) =>
  send(res, 409, {
    ok: false,
    error: 'phone_registered',
    errors: { phone: 'This phone number has already been registered for this event.' },
  });

/**
 * Public: save one guest response.
 * - Idempotent per submissionId: a retried request updates the same row.
 * - One registration per normalised phone number per event (checked here and
 *   enforced by a unique index in the database).
 */
export default async function handler(req, res) {
  if (!method(req, res, 'POST')) return;
  if (!sameOrigin(req)) return send(res, 403, { ok: false, error: 'forbidden' });

  const body = req.body && typeof req.body === 'object' ? req.body : null;
  if (!body) return send(res, 400, { ok: false, error: 'invalid_body' });
  if (body.website) return send(res, 400, { ok: false, error: 'invalid_body' }); // honeypot
  if (!UUID.test(String(body.submissionId || ''))) return send(res, 400, { ok: false, error: 'invalid_submission_id' });

  const result = validateRsvp(body, { maxGuests: MAX_GUESTS });
  if (!result.ok) return send(res, 400, { ok: false, error: 'validation', errors: result.errors });
  const { attendance, name, phone, guests, guestNames } = result.value;
  const submissionId = String(body.submissionId).toLowerCase();

  try {
    await ensureSchema();

    // Server-side duplicate check (the unique index below is the final guarantee).
    const existing = await sql`
      SELECT submission_id FROM rsvps
      WHERE event_id = ${EVENT_ID} AND phone = ${phone} AND submission_id <> ${submissionId}
      LIMIT 1`;
    if (existing.length) return phoneTaken(res);

    const rows = await sql`
      INSERT INTO rsvps (id, submission_id, event_id, attendance, name, phone, guests, guest_names)
      VALUES (${crypto.randomUUID()}, ${submissionId}, ${EVENT_ID}, ${attendance}, ${name}, ${phone}, ${guests},
              ${JSON.stringify(guestNames)}::jsonb)
      ON CONFLICT (submission_id) DO UPDATE SET
        attendance = EXCLUDED.attendance, name = EXCLUDED.name, phone = EXCLUDED.phone,
        guests = EXCLUDED.guests, guest_names = EXCLUDED.guest_names, updated_at = now()
      RETURNING id`;
    if (!rows[0]?.id) return send(res, 500, { ok: false, error: 'not_saved' });
    return send(res, 201, { ok: true, id: rows[0].id });
  } catch (error) {
    // 23505 = unique violation: two submissions with the same phone raced each other.
    if (error?.code === '23505' && /phone/.test(`${error.constraint || ''} ${error.message || ''}`)) return phoneTaken(res);
    return failure(res, error);
  }
}
