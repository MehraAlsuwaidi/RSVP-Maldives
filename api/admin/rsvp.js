import { isAdmin } from '../../lib/auth.js';
import { ensureSchema, retryPhoneIndex, rowToResponse, sql } from '../../lib/db.js';
import { failure, sameOrigin, send } from '../../lib/http.js';
import { DUPLICATE_PHONE_MESSAGE, EVENT_ID, validateAdminEdit } from '../../shared/rsvpValidation.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_GUESTS = Number(process.env.MAX_GUESTS) || 20;
const duplicate = (res) => send(res, 409, { ok: false, error: 'phone_registered', errors: { phone: DUPLICATE_PHONE_MESSAGE } });

/**
 * Admin only.
 *   PATCH  /api/admin/rsvp?id=…   update one RSVP (keeps created_at, sets updated_at)
 *   DELETE /api/admin/rsvp?id=…   delete one RSVP and its guest names
 */
export default async function handler(req, res) {
  if (req.method !== 'PATCH' && req.method !== 'DELETE') {
    res.setHeader('Allow', 'PATCH, DELETE');
    return send(res, 405, { ok: false, error: 'method_not_allowed' });
  }
  if (!sameOrigin(req)) return send(res, 403, { ok: false, error: 'forbidden' });
  if (!(await isAdmin(req))) return send(res, 401, { ok: false, error: 'unauthorised' });

  const id = String(req.query?.id || '');
  if (!UUID.test(id)) return send(res, 400, { ok: false, error: 'invalid_id' });

  try {
    await ensureSchema();
    const [existingRow] = await sql`
      SELECT id, attendance, name, phone, guests, guest_names, created_at, updated_at
      FROM rsvps WHERE id = ${id} AND event_id = ${EVENT_ID}`;
    if (!existingRow) return send(res, 404, { ok: false, error: 'not_found' });

    if (req.method === 'DELETE') {
      const deleted = await sql`DELETE FROM rsvps WHERE id = ${id} AND event_id = ${EVENT_ID} RETURNING attendance, guests`;
      await retryPhoneIndex();
      const guests = deleted.reduce((n, r) => n + (r.attendance === 'yes' ? r.guests : 0), 0);
      return send(res, 200, { ok: true, deleted: deleted.length, attendingGuests: guests });
    }

    const existing = rowToResponse(existingRow);
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const result = validateAdminEdit(body, existing, { maxGuests: MAX_GUESTS });
    if (!result.ok) return send(res, 400, { ok: false, error: 'validation', errors: result.errors });
    const { attendance, name, phone, guests, guestNames } = result.value;

    if (phone) {
      // Same normalised number on another RSVP for this event? (this record is excluded)
      const clash = await sql`
        SELECT 1 FROM rsvps WHERE event_id = ${EVENT_ID} AND phone = ${phone} AND id <> ${id} LIMIT 1`;
      if (clash.length) return duplicate(res);
    }

    const [row] = await sql`
      UPDATE rsvps SET attendance = ${attendance}, name = ${name}, phone = ${phone}, guests = ${guests},
             guest_names = ${JSON.stringify(guestNames)}::jsonb, updated_at = now()
      WHERE id = ${id} AND event_id = ${EVENT_ID}
      RETURNING id, attendance, name, phone, guests, guest_names, created_at, updated_at`;
    await retryPhoneIndex();
    return send(res, 200, { ok: true, response: rowToResponse(row) });
  } catch (error) {
    if (error?.code === '23505') return duplicate(res);
    return failure(res, error);
  }
}
