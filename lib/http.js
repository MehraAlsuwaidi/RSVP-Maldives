export function send(res, status, data, headers = {}) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.status(status).send(JSON.stringify(data));
}

export const clientIp = (req) =>
  String(req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim();

/** Browsers always send Origin on POST; refuse posts coming from other websites. */
export function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

export function method(req, res, allowed) {
  if (req.method === allowed) return true;
  res.setHeader('Allow', allowed);
  send(res, 405, { ok: false, error: 'method_not_allowed' });
  return false;
}

export function failure(res, error) {
  console.error(error);
  if (error?.code === 'NO_DB') return send(res, 503, { ok: false, error: 'database_not_connected' });
  return send(res, 500, { ok: false, error: 'server_error' });
}
