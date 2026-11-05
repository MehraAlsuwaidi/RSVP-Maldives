import { isAdmin } from '../../lib/auth.js';
import { method, send } from '../../lib/http.js';

export default async function handler(req, res) {
  if (!method(req, res, 'GET')) return;
  if (!(await isAdmin(req))) return send(res, 401, { ok: false, error: 'unauthorised' });
  send(res, 200, { ok: true, authenticated: true });
}
