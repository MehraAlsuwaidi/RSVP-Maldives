import { isAdmin } from '../../lib/auth.js';
import { listResponses } from '../../lib/db.js';
import { failure, method, send } from '../../lib/http.js';

/** Owner only: every response, newest first. */
export default async function handler(req, res) {
  if (!method(req, res, 'GET')) return;
  if (!(await isAdmin(req))) return send(res, 401, { ok: false, error: 'unauthorised' });
  try {
    send(res, 200, { ok: true, responses: await listResponses(), fetchedAt: new Date().toISOString() });
  } catch (error) {
    failure(res, error);
  }
}
