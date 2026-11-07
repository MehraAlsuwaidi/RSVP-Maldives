#!/usr/bin/env node
/**
 * Local stand-in for Vercel: serves the built site (dist/) and runs the real
 * api/ functions against an in-memory Postgres (PGlite). Nothing touches the
 * live database.
 *
 *   npm run build:live && ADMIN_PIN=1234 npm run local
 */
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { randomBytes } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { __setSqlForTests } from '../lib/db.js';

process.env.ADMIN_PIN ||= '1234';
process.env.SESSION_SECRET ||= randomBytes(24).toString('base64url');
const PORT = Number(process.env.PORT) || 3000;
const DIST = join(process.cwd(), 'dist');

const db = new PGlite();
__setSqlForTests((strings, ...values) => {
  const text = strings.reduce((acc, s, i) => acc + s + (i < values.length ? `$${i + 1}` : ''), '');
  return db.query(text, values).then((r) => r.rows).catch((e) => {
    throw Object.assign(e, { code: e.code });
  });
});

// SEED_LEGACY=1 recreates the previous schema with older-style rows, to exercise the migration.
if (process.env.SEED_LEGACY) {
  await db.exec(`
    CREATE TABLE rsvps (id UUID PRIMARY KEY, submission_id UUID NOT NULL UNIQUE,
      attendance TEXT NOT NULL CHECK (attendance IN ('yes','no')), name TEXT NOT NULL, phone TEXT,
      guests INTEGER NOT NULL CHECK (guests >= 0), created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
    INSERT INTO rsvps (id, submission_id, attendance, name, phone, guests, created_at) VALUES
      ('11111111-1111-4111-8111-111111111111','21111111-1111-4111-8111-111111111111','yes','Legacy Two','7772826',2, now() - interval '2 days'),
      ('11111111-1111-4111-8111-111111111112','21111111-1111-4111-8111-111111111112','yes','Legacy Eight Digits','77777766',1, now() - interval '1 day'),
      ('11111111-1111-4111-8111-111111111113','21111111-1111-4111-8111-111111111113','no','Legacy Declined',NULL,0, now() - interval '3 days');
  `);
}

const routes = {
  '/api/rsvp': '../api/rsvp.js',
  '/api/health': '../api/health.js',
  '/api/admin/login': '../api/admin/login.js',
  '/api/admin/logout': '../api/admin/logout.js',
  '/api/admin/session': '../api/admin/session.js',
  '/api/admin/rsvps': '../api/admin/rsvps.js',
  '/api/admin/rsvp': '../api/admin/rsvp.js',
  '/api/admin/delete': '../api/admin/delete.js',
  '/api/admin/export': '../api/admin/export.js',
};
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.woff': 'font/woff', '.svg': 'image/svg+xml' };

function vercelResponse(res) {
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.send = (body) => res.end(body);
  return res;
}

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const route = routes[url.pathname];
    if (route) {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const raw = Buffer.concat(chunks).toString();
      req.body = (req.headers['content-type'] || '').includes('json') && raw ? JSON.parse(raw) : undefined;
      req.query = Object.fromEntries(url.searchParams);
      const { default: handler } = await import(route);
      return handler(req, vercelResponse(res));
    }
    let path = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
    if (path === '/admin') path = '/admin/';
    if (path.endsWith('/')) path += 'index.html';
    const file = join(DIST, path);
    try {
      if (!file.startsWith(DIST) || !(await stat(file)).isFile()) throw new Error('nf');
      res.setHeader('Content-Type', TYPES[extname(file)] || 'application/octet-stream');
      res.end(await readFile(file));
    } catch {
      res.statusCode = 404;
      res.end('Not found');
    }
  })
  .listen(PORT, () => console.log(`Local site with in-memory Postgres on http://localhost:${PORT} (PIN ${process.env.ADMIN_PIN})`));
