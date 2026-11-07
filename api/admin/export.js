import { isAdmin } from '../../lib/auth.js';
import { listResponses } from '../../lib/db.js';
import { EVENT_ID } from '../../shared/rsvpValidation.js';
import { failure, method, send } from '../../lib/http.js';
import { filterResponses, toCsv } from '../../shared/rsvpFilters.js';

/** Owner only: CSV of the responses matching the dashboard's current search/filter/sort. */
export default async function handler(req, res) {
  if (!method(req, res, 'GET')) return;
  if (!(await isAdmin(req))) return send(res, 401, { ok: false, error: 'unauthorised' });
  try {
    const { q = '', attendance = 'all', sort = 'newest' } = req.query;
    const rows = filterResponses(await listResponses(EVENT_ID), { q: String(q), attendance: String(attendance), sort: String(sort) });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="rsvps-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).send(toCsv(rows));
  } catch (error) {
    failure(res, error);
  }
}
