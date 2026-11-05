#!/usr/bin/env node
/**
 * End-to-end checks against a running Worker (local `npm run dev:api`, or a deployment).
 *   BASE_URL=http://localhost:8787 OWNER_PASSWORD=... npm run test:smoke
 * Writes test RSVPs named "Smoke Test …" — run against production only if you are
 * happy to see (and later ignore) those rows in the dashboard.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const BASE = process.env.BASE_URL || 'http://localhost:8787';
const PASSWORD = process.env.OWNER_PASSWORD;
const origin = new URL(BASE).origin;
let passed = 0;

async function step(name, fn) {
  await fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
}

const post = (path, body, headers = {}) =>
  fetch(BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, ...headers }, body: JSON.stringify(body) });

const yesId = randomUUID();
const tag = `Smoke Test ${Date.now()}`;
let cookie = '';

console.log(`Smoke testing ${BASE}`);

await step('serves the invitation and the admin page', async () => {
  assert.equal((await fetch(BASE + '/')).status, 200);
  assert.equal((await fetch(BASE + '/admin/')).status, 200);
});

let savedId;
await step('saves a Yes RSVP only after the database confirms', async () => {
  const res = await post('/api/rsvp', { attendance: 'yes', name: `${tag} Yes`, phone: '+960 777-1234', guests: '3', submissionId: yesId });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.ok, true);
  savedId = body.id;
  assert.ok(savedId);
});

await step('a retried request updates the same record (no duplicate)', async () => {
  const res = await post('/api/rsvp', { attendance: 'yes', name: `${tag} Yes`, phone: '+960 777-1234', guests: 4, submissionId: yesId });
  assert.equal(res.status, 201);
  assert.equal((await res.json()).id, savedId);
});

await step('saves a No RSVP with a name and 0 guests', async () => {
  const res = await post('/api/rsvp', { attendance: 'no', name: `${tag} No`, phone: 'ignored', guests: 9, submissionId: randomUUID() });
  assert.equal(res.status, 201);
});

await step('rejects a No RSVP without a name', async () => {
  const res = await post('/api/rsvp', { attendance: 'no', name: '  ', submissionId: randomUUID() });
  assert.equal(res.status, 400);
  assert.ok((await res.json()).errors.name);
});

await step('validates Yes fields on the server', async () => {
  const res = await post('/api/rsvp', { attendance: 'yes', name: 'X', phone: 'abc', guests: '0', submissionId: randomUUID() });
  assert.equal(res.status, 400);
  const { errors } = await res.json();
  assert.ok(errors.phone && errors.guests);
});

await step('rejects cross-site posts', async () => {
  const res = await post('/api/rsvp', { attendance: 'no', name: 'Evil', submissionId: randomUUID() }, { Origin: 'https://evil.example' });
  assert.equal(res.status, 403);
});

await step('owner data and downloads require a login', async () => {
  assert.equal((await fetch(BASE + '/api/admin/rsvps')).status, 401);
  assert.equal((await fetch(BASE + '/api/admin/rsvps.csv')).status, 401);
  assert.equal((await fetch(BASE + '/api/admin/session')).status, 401);
  const forged = await fetch(BASE + '/api/admin/rsvps', { headers: { Cookie: `rsvp_owner=${Date.now() + 1e6}.forged; __Host-rsvp_owner=${Date.now() + 1e6}.forged` } });
  assert.equal(forged.status, 401);
});

await step('wrong password is refused', async () => {
  assert.equal((await post('/api/admin/login', { password: 'definitely-wrong' })).status, 401);
});

if (PASSWORD) {
  await step('owner can sign in', async () => {
    const res = await post('/api/admin/login', { password: PASSWORD });
    assert.equal(res.status, 200);
    const setCookie = res.headers.get('set-cookie') || '';
    assert.match(setCookie, /HttpOnly/i);
    assert.match(setCookie, /SameSite=Strict/i);
    cookie = setCookie.split(';')[0];
  });

  await step('owner sees responses with correct guest counts', async () => {
    const res = await fetch(BASE + '/api/admin/rsvps', { headers: { Cookie: cookie } });
    assert.equal(res.status, 200);
    const { responses } = await res.json();
    const mine = responses.filter((r) => r.name.startsWith(tag));
    assert.equal(mine.length, 2);
    assert.equal(mine.find((r) => r.attendance === 'yes').guests, 4);
    assert.equal(mine.find((r) => r.attendance === 'yes').phone, '+9607771234');
    const no = mine.find((r) => r.attendance === 'no');
    assert.equal(no.guests, 0);
    assert.equal(no.phone, null);
  });

  await step('CSV export applies the filters server-side', async () => {
    const res = await fetch(`${BASE}/api/admin/rsvps.csv?attendance=no&q=${encodeURIComponent(tag)}`, { headers: { Cookie: cookie } });
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/csv/);
    const text = await res.text();
    assert.ok(text.includes(`${tag} No`));
    assert.ok(!text.includes(`${tag} Yes`));
  });
} else {
  console.log('  – skipped owner checks (set OWNER_PASSWORD to run them)');
}

console.log(`\n${passed} checks passed.`);
