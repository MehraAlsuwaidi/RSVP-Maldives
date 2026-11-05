/**
 * Postgres (Neon, connected through the Vercel Storage integration).
 * Vercel injects DATABASE_URL (or POSTGRES_URL) into the functions.
 * Tables are created automatically on first use.
 */
import { neon } from '@neondatabase/serverless';

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
export const sql = url ? neon(url) : null;

let ready = null;
export function ensureSchema() {
  if (!sql) throw Object.assign(new Error('Database is not connected (DATABASE_URL missing).'), { code: 'NO_DB' });
  ready ??= (async () => {
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
    await sql`CREATE INDEX IF NOT EXISTS rsvps_created_at ON rsvps (created_at DESC)`;
    await sql`CREATE TABLE IF NOT EXISTS login_failures (ip TEXT NOT NULL, at TIMESTAMPTZ NOT NULL DEFAULT now())`;
    await sql`CREATE INDEX IF NOT EXISTS login_failures_at ON login_failures (at)`;
  })().catch((error) => {
    ready = null;
    throw error;
  });
  return ready;
}

export const rowToResponse = (r) => ({
  id: r.id,
  attendance: r.attendance,
  name: r.name,
  phone: r.phone,
  guests: r.guests,
  submittedAt: new Date(r.created_at).toISOString(),
  updatedAt: new Date(r.updated_at).toISOString(),
});

export async function listResponses() {
  await ensureSchema();
  const rows = await sql`SELECT id, attendance, name, phone, guests, created_at, updated_at FROM rsvps ORDER BY created_at DESC`;
  return rows.map(rowToResponse);
}
