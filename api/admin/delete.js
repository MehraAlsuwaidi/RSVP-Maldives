import { isAdmin } from '../../lib/auth.js';
import { ensureSchema, retryPhoneIndex, sql } from '../../lib/db.js';
import { failure, method, sameOrigin, send } from '../../lib/http.js';
import { EVENT_ID } from '../../shared/rsvpValidation.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Admin only: POST /api/admin/delete { ids: [...] } removes the selected RSVPs. */
export default async function handler(req, res) {
  if (!method(req, res, 'POST')) return;
  if (!sameOrigin(req)) return send(res, 403, { ok: false, error: 'forbidden' });
  if (!(await isAdmin(req))) return send(res, 401, { ok: false, error: 'unauthorised' });

  const ids = Array.isArray(req.body?.ids) ? [...new Set(req.body.ids.map(String))] : [];
  if (!ids.length || ids.length > 1000 || !ids.every((id) => UUID.test(id))) return send(res, 400, { ok: false, error: 'invalid_ids' });

  try {
    await ensureSchema();
    const deleted = await sql`
      DELETE FROM rsvps WHERE event_id = ${EVENT_ID} AND id = ANY(${ids}::uuid[])
      RETURNING attendance, guests`;
    await retryPhoneIndex();
    const attendingGuests = deleted.reduce((n, r) => n + (r.attendance === 'yes' ? r.guests : 0), 0);
    return send(res, 200, { ok: true, deleted: deleted.length, attendingGuests });
  } catch (error) {
    return failure(res, error);
  }
}
