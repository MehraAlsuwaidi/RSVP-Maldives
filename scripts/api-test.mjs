#!/usr/bin/env node
/**
 * Full API test for the local server (scripts/local-server.mjs, in-memory Postgres).
 * It creates, edits and deletes records, so never point it at the live site.
 *   SEED_LEGACY=1 npm run local    (other terminal)
 *   ADMIN_PIN=1234 node scripts/api-test.mjs
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
if (!/localhost|127\.0\.0\.1/.test(BASE)) throw new Error('api-test modifies data: run it against the local server only.');
const PIN = process.env.ADMIN_PIN || '1234';
const origin = new URL(BASE).origin;
let cookie = '';
let passed = 0;

const step = async (name, fn) => {
  await fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
};
const req = (path, { method = 'GET', body, auth = true } = {}) =>
  fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', Origin: origin, ...(auth && cookie ? { Cookie: cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const rsvp = (data) => req('/api/rsvp', { method: 'POST', body: { submissionId: randomUUID(), ...data }, auth: false });
const list = async () => (await (await req('/api/admin/rsvps')).json()).responses;
const totals = (rows) => ({
  total: rows.length,
  parties: rows.filter((r) => r.attendance === 'yes').length,
  guests: rows.filter((r) => r.attendance === 'yes').reduce((n, r) => n + r.guests, 0),
  declined: rows.filter((r) => r.attendance === 'no').length,
});

console.log(`API test on ${BASE}`);

await step('legacy numbers were migrated to +960 format', async () => {
  const h = await (await fetch(BASE + '/api/health')).json();
  assert.equal(h.database, true);
});

await step('Yes with 3 guests saves all 3 names (Guest 1 = Your Name)', async () => {
  const res = await rsvp({ attendance: 'yes', name: 'Aisha Ali', phone: '+960 791 0001', guests: '3', guestNames: ['ignored', 'Bilal Ali', 'Cara Ali'] });
  assert.equal(res.status, 201);
});

await step('an incomplete guest name (spaces only) is rejected', async () => {
  const res = await rsvp({ attendance: 'yes', name: 'Dana', phone: '7910002', guests: '3', guestNames: ['Dana', 'Eli', '   '] });
  assert.equal(res.status, 400);
  assert.ok((await res.json()).errors.guestNames['2']);
});

await step('a missing guest name list is rejected', async () => {
  const res = await rsvp({ attendance: 'yes', name: 'Dana', phone: '7910002', guests: '2' });
  assert.equal(res.status, 400);
});

for (const variant of ['7910001', '791 0001', '791-0001', '(791) 0001', '960 7910001', '00960 791 0001', '(+960) 791.0001']) {
  await step(`duplicate phone in another format is rejected: "${variant}"`, async () => {
    const res = await rsvp({ attendance: 'no', name: 'Someone Else', phone: variant });
    assert.equal(res.status, 409);
    assert.equal((await res.json()).error, 'phone_registered');
  });
}

await step('a legacy local number is also protected ("777 2826" vs stored "7772826")', async () => {
  const res = await rsvp({ attendance: 'yes', name: 'Copy', phone: '+960 777-2826', guests: '1', guestNames: ['Copy'] });
  assert.equal(res.status, 409);
});

await step('a retry with the same submissionId updates instead of duplicating', async () => {
  const submissionId = randomUUID();
  const body = { submissionId, attendance: 'no', name: 'Retry Person', phone: '7910009' };
  assert.equal((await req('/api/rsvp', { method: 'POST', body, auth: false })).status, 201);
  assert.equal((await req('/api/rsvp', { method: 'POST', body, auth: false })).status, 201);
});

await step('every admin endpoint refuses requests without the PIN session', async () => {
  const id = randomUUID();
  assert.equal((await req('/api/admin/rsvps', { auth: false })).status, 401);
  assert.equal((await req('/api/admin/export', { auth: false })).status, 401);
  assert.equal((await req(`/api/admin/rsvp?id=${id}`, { method: 'PATCH', body: {}, auth: false })).status, 401);
  assert.equal((await req(`/api/admin/rsvp?id=${id}`, { method: 'DELETE', auth: false })).status, 401);
  assert.equal((await req('/api/admin/delete', { method: 'POST', body: { ids: [id] }, auth: false })).status, 401);
});

await step('admin signs in with the PIN', async () => {
  const res = await req('/api/admin/login', { method: 'POST', body: { pin: PIN }, auth: false });
  assert.equal(res.status, 200);
  cookie = res.headers.get('set-cookie').split(';')[0];
});

let rows;
await step('dashboard data includes guest names and legacy records', async () => {
  rows = await list();
  const aisha = rows.find((r) => r.name === 'Aisha Ali');
  assert.deepEqual(aisha.guestNames, ['Aisha Ali', 'Bilal Ali', 'Cara Ali']);
  assert.equal(aisha.guests, 3);
  const legacy = rows.find((r) => r.name === 'Legacy Two');
  assert.deepEqual(legacy.guestNames, []);
  assert.equal(legacy.phone, '+9607772826');
  assert.equal(rows.find((r) => r.name === 'Legacy Eight Digits').phone, '77777766');
});

await step('CSV export includes individual guest names and search finds them', async () => {
  const csv = await (await req('/api/admin/export?q=Bilal')).text();
  assert.ok(csv.includes('Aisha Ali; Bilal Ali; Cara Ali'));
  assert.equal(csv.trim().split('\n').length, 2);
});

const aisha = () => rows.find((r) => r.name.startsWith('Aisha'));
const patch = (id, body) => req(`/api/admin/rsvp?id=${id}`, { method: 'PATCH', body });

await step('edit: saving the unchanged phone number is allowed', async () => {
  const a = aisha();
  const res = await patch(a.id, { name: 'Aisha A. Ali', phone: a.phone, attendance: 'yes', guests: '3', guestNames: a.guestNames });
  assert.equal(res.status, 200);
  const updated = (await res.json()).response;
  assert.equal(updated.name, 'Aisha A. Ali');
  assert.equal(updated.submittedAt, a.submittedAt); // original timestamp kept
  assert.ok(updated.updatedAt > a.updatedAt); // last-updated recorded
});

await step('edit: a number belonging to another RSVP is blocked', async () => {
  rows = await list();
  const res = await patch(aisha().id, { name: 'Aisha A. Ali', phone: '777 2826', attendance: 'yes', guests: '3', guestNames: aisha().guestNames });
  assert.equal(res.status, 409);
  assert.equal((await res.json()).errors.phone, 'This phone number has already been registered for this event.');
});

await step('edit: add a guest and remove another (count stays in sync)', async () => {
  const names = ['Aisha A. Ali', 'Cara Ali', 'Dawood Ali', 'Eman Ali'];
  const res = await patch(aisha().id, { name: 'Aisha A. Ali', phone: aisha().phone, attendance: 'yes', guests: '4', guestNames: names });
  assert.equal(res.status, 200);
  assert.deepEqual((await res.json()).response.guestNames, names);
});

await step('edit: mismatched count or blank guest name is rejected', async () => {
  rows = await list();
  const a = aisha();
  assert.equal((await patch(a.id, { name: a.name, phone: a.phone, attendance: 'yes', guests: '5', guestNames: a.guestNames })).status, 400);
  assert.equal((await patch(a.id, { name: a.name, phone: a.phone, attendance: 'yes', guests: '2', guestNames: ['X', ' '] })).status, 400);
});

await step('edit: removing the final guest requires Declined (0 guests while attending is rejected)', async () => {
  const a = aisha();
  assert.equal((await patch(a.id, { name: a.name, phone: a.phone, attendance: 'yes', guests: '0', guestNames: [] })).status, 400);
});

await step('legacy record: phone/name editable without inventing guest names; count kept', async () => {
  const legacy = rows.find((r) => r.name === 'Legacy Eight Digits');
  const res = await patch(legacy.id, { name: 'Legacy Eight', phone: legacy.phone, attendance: 'yes', guests: String(legacy.guests), guestNames: [''] });
  assert.equal(res.status, 200);
  const r = (await res.json()).response;
  assert.deepEqual(r.guestNames, []);
  assert.equal(r.guests, 1);
});

await step('legacy record: names can be completed later', async () => {
  const legacy = rows.find((r) => r.name === 'Legacy Two');
  const res = await patch(legacy.id, { name: 'Legacy Two', phone: legacy.phone, attendance: 'yes', guests: '2', guestNames: ['Legacy Two', 'Partner'] });
  assert.equal(res.status, 200);
  assert.deepEqual((await res.json()).response.guestNames, ['Legacy Two', 'Partner']);
});

await step('edit: change to Declined stores 0 guests', async () => {
  rows = await list();
  const r = rows.find((x) => x.name === 'Legacy Eight');
  const res = await patch(r.id, { name: r.name, phone: r.phone, attendance: 'no', guests: '1', guestNames: [] });
  assert.equal(res.status, 200);
  const out = (await res.json()).response;
  assert.equal(out.guests, 0);
  assert.equal(out.attendance, 'no');
});

await step('single delete removes the RSVP and reports its attending guests', async () => {
  rows = await list();
  const before = totals(rows);
  const a = aisha();
  const res = await req(`/api/admin/rsvp?id=${a.id}`, { method: 'DELETE' });
  const body = await res.json();
  assert.equal(body.deleted, 1);
  assert.equal(body.attendingGuests, 4);
  const after = totals(await list());
  assert.equal(after.total, before.total - 1);
  assert.equal(after.guests, before.guests - 4);
});

await step('bulk delete removes exactly the selected RSVPs', async () => {
  rows = await list();
  const pick = rows.filter((r) => r.name.startsWith('Legacy'));
  const res = await req('/api/admin/delete', { method: 'POST', body: { ids: pick.map((r) => r.id) } });
  const body = await res.json();
  assert.equal(body.deleted, pick.length);
  const left = await list();
  assert.equal(left.length, rows.length - pick.length);
  assert.ok(left.every((r) => !r.name.startsWith('Legacy')));
});

await step('a deleted phone number can register again', async () => {
  assert.equal((await rsvp({ attendance: 'no', name: 'Back Again', phone: '7772826' })).status, 201);
});

console.log(`\n${passed} checks passed.`);
