/**
 * Postgres (Neon, connected through the Vercel Storage integration).
 * Vercel injects DATABASE_URL (or POSTGRES_URL) into the functions.
 * The schema is created and migrated automatically on first use.
 */
import { neon } from '@neondatabase/serverless';

// Vercel's Neon integration may add a custom prefix (e.g. STORAGE_DATABASE_URL), so accept those too.
function findDatabaseUrl(env = process.env) {
  if (env.DATABASE_URL) return env.DATABASE_URL;
  if (env.POSTGRES_URL) return env.POSTGRES_URL;
  const key = Object.keys(env).find((k) => /(^|_)(DATABASE_URL|POSTGRES_URL)$/.test(k) && /^postgres(ql)?:\/\//.test(env[k] || ''));
  return key ? env[key] : null;
}

const url = findDatabaseUrl();
let impl = url ? neon(url) : null;

/** Tagged-template SQL: sql`SELECT … ${value}` → rows. */
export function sql(strings, ...values) {
  if (!impl) throw Object.assign(new Error('Database is not connected (DATABASE_URL missing).'), { code: 'NO_DB' });
  return impl(strings, ...values);
}

/** Tests swap in a local Postgres (PGlite) with the same tagged-template interface. */
export function __setSqlForTests(fn) {
  impl = fn;
  ready = null;
}

export const schemaState = { phoneUniqueIndex: false };

let ready = null;
export function ensureSchema() {
  if (!impl) return Promise.reject(Object.assign(new Error('Database is not connected (DATABASE_URL missing).'), { code: 'NO_DB' }));
  ready ??= migrate().catch((error) => {
    ready = null;
    throw error;
  });
  return ready;
}

async function migrate() {
  await sql`CREATE TABLE IF NOT EXISTS rsvps (
    id            UUID PRIMARY KEY,
    submission_id UUID NOT NULL UNIQUE,
    attendance    TEXT NOT NULL CHECK (attendance IN ('yes', 'no')),
    name          TEXT NOT NULL,
    phone         TEXT,
    guests        INTEGER NOT NULL CHECK (guests >= 0),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  await sql`ALTER TABLE rsvps ADD COLUMN IF NOT EXISTS event_id TEXT NOT NULL DEFAULT 'magical-birthday-2026-11-21'`;
  await sql`ALTER TABLE rsvps ADD COLUMN IF NOT EXISTS guest_names JSONB NOT NULL DEFAULT '[]'::jsonb`;
  await sql`CREATE INDEX IF NOT EXISTS rsvps_created_at ON rsvps (created_at DESC)`;

  // Bring numbers saved by the earlier version into the same +960 format.
  await sql`UPDATE rsvps SET phone = '+960' || phone WHERE phone ~ '^[0-9]{7}$'`;
  await sql`UPDATE rsvps SET phone = '+' || phone WHERE phone ~ '^960[0-9]{7}$'`;

  // One registration per phone number per event, enforced by the database.
  try {
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS rsvps_event_phone_unique ON rsvps (event_id, phone) WHERE phone IS NOT NULL`;
    schemaState.phoneUniqueIndex = true;
  } catch (error) {
    // Only possible if older data already contains a duplicate number; the API still
    // rejects new duplicates, and the index is retried on the next cold start.
    schemaState.phoneUniqueIndex = false;
    console.error('Could not create the phone uniqueness index (existing duplicates?)', error);
  }

  await sql`CREATE TABLE IF NOT EXISTS login_failures (ip TEXT NOT NULL, at TIMESTAMPTZ NOT NULL DEFAULT now())`;
  await sql`CREATE INDEX IF NOT EXISTS login_failures_at ON login_failures (at)`;
}

const asArray = (v) => (Array.isArray(v) ? v : typeof v === 'string' ? JSON.parse(v || '[]') : []);

export const rowToResponse = (r) => ({
  id: r.id,
  attendance: r.attendance,
  name: r.name,
  phone: r.phone,
  guests: r.guests,
  guestNames: asArray(r.guest_names),
  submittedAt: new Date(r.created_at).toISOString(),
  updatedAt: new Date(r.updated_at).toISOString(),
});

export async function listResponses(eventId) {
  await ensureSchema();
  const rows = await sql`
    SELECT id, attendance, name, phone, guests, guest_names, created_at, updated_at
    FROM rsvps WHERE event_id = ${eventId} ORDER BY created_at DESC`;
  return rows.map(rowToResponse);
}

/** After admins fix duplicates in older data, try again to add the uniqueness index. */
export async function retryPhoneIndex() {
  if (schemaState.phoneUniqueIndex) return;
  try {
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS rsvps_event_phone_unique ON rsvps (event_id, phone) WHERE phone IS NOT NULL`;
    schemaState.phoneUniqueIndex = true;
  } catch {
    /* duplicates still present */
  }
}
