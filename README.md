# A Magical Birthday Celebration — invitation, RSVP & dashboard

An interactive fairytale invitation for **Hermione, Isabella and Selena**, with RSVP collection and a
PIN-protected dashboard for the family.

| Page | Path | Who it's for |
|---|---|---|
| Invitation + RSVP | `/` | Guests. Public, anyone can reply without an account |
| RSVP dashboard | `/admin` | The family. Enter the 4-digit PIN |

Stack: React 18 + Vite + Framer Motion, Vercel serverless functions (`api/`), and Postgres (Neon, connected
through Vercel's Storage integration).

## Hosting on Vercel

The app is deployed as one Vercel project:

- **Static site:** Vite builds the invitation and the dashboard into `dist/`.
- **API:** the functions in `api/`.
- **Database:** a Neon Postgres database connected under the project's **Storage** tab. Vercel injects
  `DATABASE_URL` into the functions, and the tables are created automatically on the first request.

**Environment variables** (Vercel → Project → Settings → Environment Variables):

| Name | Value |
|---|---|
| `ADMIN_PIN` | The 4-digit dashboard PIN |
| `SESSION_SECRET` | A long random string that signs dashboard sessions |
| `DATABASE_URL` | Added automatically when the Neon database is connected |

**To change the PIN:** edit `ADMIN_PIN` in Vercel, then redeploy (Deployments → ⋯ → Redeploy).
To also sign everyone out of the dashboard, change `SESSION_SECRET` at the same time.

**Redeploying from your own computer:**

```bash
npx vercel deploy --prod
```

**Checking the live site** (this adds two "Smoke Test …" rows to the dashboard):

```bash
BASE_URL=https://<your-site>.vercel.app ADMIN_PIN=<pin> npm run test:smoke
```

## How the PIN is protected

- The PIN lives **only** in Vercel's environment variables. It is never in the website code or in git.
  Every dashboard request, including the CSV download, is checked on the server.
- A 4-digit PIN has only 10,000 combinations, so guessing is throttled. After 5 wrong PINs from one
  device or network, sign-in pauses for 15 minutes. After 30 wrong PINs in total within an hour,
  sign-in pauses for everyone until the hour passes.
- A correct PIN gives a 12-hour sign-in, stored as an `HttpOnly; Secure; SameSite=Strict` cookie.

## How RSVPs are saved

```
Guest form ─► submitRsvp() (src/services/rsvpService.js)
               │ POST /api/rsvp { attendance, name, phone, guests, submissionId }
               ▼
api/rsvp.js ─ validates again (shared/rsvpValidation.js)
               │ INSERT … ON CONFLICT (submission_id) DO UPDATE … RETURNING id
               ▼
Postgres table `rsvps` ─► /admin dashboard (PIN session only)
```

- **Yes** requires name, phone and guest count (a whole number of 1 or more, including the person replying).
  **No** requires only the name, and saves 0 guests.
- The guest sees a confirmation **only after the database confirms the save**. If saving fails, they get
  "Try again" and everything they typed is kept.
- **No duplicates:** each form gets one `submissionId`. Repeat taps are ignored while sending, and a
  retry updates the same row instead of adding a new one.
- The dashboard shows four totals: total responses, attending parties, attending guests (the sum of guest
  counts on Yes replies) and declined. It also has search, an attendance filter, sorting, refresh, and a
  server-generated CSV of the filtered list.

## Local development

```bash
npm install
```

```bash
npm run dev
```

`npm run dev` runs **preview mode**: the purple "Preview mode" badge shows, and nothing is sent or saved.

## Editing content and artwork

Everything editable is in `src/config/event.js`:

- `EVENT`: date, times, venue and map query.
- `COPY`: all invitation wording.
- `ASSETS`: image paths, alt text and focal points.

Colours are in `src/styles/theme.css`.

**Optional artwork:**

- `ASSETS.invitationArt.src`: the ornate invitation artwork for Chapter 1.
- `ASSETS.celebrating.src`: `scene_5` for Chapter 4.

Drop the files into `public/assets/` and set these paths to use them.

## Project map

```
index.html, admin/index.html   the two pages (Vite multi-page build)
src/                           React app: chapters, components, admin dashboard
api/                           Vercel functions: rsvp, admin/login|logout|session|rsvps|export
lib/                           database, PIN/session and HTTP helpers for the functions
shared/                        validation, filtering and CSV, used by both the browser and the server
scripts/smoke-test.mjs         end-to-end checks against a deployment
vercel.json                    build settings, /admin route, security headers
```
