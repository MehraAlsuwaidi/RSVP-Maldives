-- RSVP responses. submission_id is generated once per form on the guest's device,
-- so repeated taps or network retries update one row instead of creating duplicates.
CREATE TABLE IF NOT EXISTS rsvps (
  id            TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL UNIQUE,
  attendance    TEXT NOT NULL CHECK (attendance IN ('yes', 'no')),
  name          TEXT NOT NULL,
  phone         TEXT,
  guests        INTEGER NOT NULL CHECK (guests >= 0),
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS rsvps_created_at ON rsvps (created_at DESC);

-- Failed owner logins, used to slow down password guessing.
CREATE TABLE IF NOT EXISTS login_failures (
  ip TEXT NOT NULL,
  at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS login_failures_ip_at ON login_failures (ip, at);
