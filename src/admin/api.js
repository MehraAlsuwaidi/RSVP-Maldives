/** Owner dashboard API client. All authorisation is enforced by the server. */
export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(path, { credentials: 'same-origin', headers: { Accept: 'application/json', ...(options.headers || {}) }, ...options });
  } catch {
    throw new ApiError('Couldn’t reach the server. Check your connection and try again.', 0);
  }
  return res;
}

export async function checkSession() {
  const res = await request('/api/admin/session');
  if (res.status === 401) return false;
  if (!res.ok) throw new ApiError('The dashboard couldn’t start. Please try again.', res.status);
  return true;
}

export async function login(password) {
  const res = await request('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (res.ok) return true;
  const messages = {
    401: 'That password isn’t right. Please try again.',
    429: 'Too many attempts. For safety, sign-in is paused for 15 minutes.',
    503: 'The owner login hasn’t been set up yet. Ask the organiser to finish the setup step.',
  };
  throw new ApiError(messages[res.status] || 'Sign-in failed. Please try again.', res.status);
}

export async function logout() {
  await request('/api/admin/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
}

export async function fetchResponses() {
  const res = await request('/api/admin/rsvps');
  if (res.status === 401) throw new ApiError('Your session has ended. Please sign in again.', 401);
  let body = null;
  try {
    body = await res.json();
  } catch {
    /* handled below */
  }
  if (!res.ok || !body?.ok) throw new ApiError('Responses couldn’t be loaded. Please try again.', res.status);
  return body;
}

/** Downloads the server-generated CSV for the current filters (owner session required). */
export async function downloadCsv({ q, attendance, sort }) {
  const params = new URLSearchParams({ q, attendance, sort });
  const res = await request(`/api/admin/rsvps.csv?${params}`, { headers: { Accept: 'text/csv' } });
  if (res.status === 401) throw new ApiError('Your session has ended. Please sign in again.', 401);
  if (!res.ok) throw new ApiError('The CSV couldn’t be created. Please try again.', res.status);
  const blob = await res.blob();
  const name = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') || '')?.[1] || 'rsvps.csv';
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
