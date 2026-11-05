import { clearCookie } from '../../lib/auth.js';
import { method, send } from '../../lib/http.js';

export default function handler(req, res) {
  if (!method(req, res, 'POST')) return;
  send(res, 200, { ok: true }, { 'Set-Cookie': clearCookie() });
}
