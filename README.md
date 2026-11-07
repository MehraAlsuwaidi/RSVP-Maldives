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

- **Yes** requires name, phone, number of guests and a full name for every guest
  ("Guest 1 – Full Name" … one field per guest). Guest 1 is the person replying and stays in sync with
  "Your Name". **No** requires name and phone. Every visible field is required.
- **Phone numbers** are normalised before checking and saving: spaces, hyphens, dots and brackets are
  ignored, and `00` is treated as `+`. Local 7-digit numbers get the Maldives code, so `777 1234`,
  `960 7771234`, `00960 777-1234` and `(+960) 777.1234` are all saved as `+9607771234`.
- **One registration per phone number per event.** The API checks this first, and a unique index on
  `(event_id, phone)` in Postgres enforces it even if two people submit at the same moment. A
  duplicate gets HTTP 409, and the form shows the pop-up "Phone number already registered" with
  everything the guest typed kept.
- The guest sees a confirmation **only after the database confirms the save**. "Send RSVP" is disabled
  while sending, and a retry with the same `submissionId` updates the existing row instead of
  adding a new one.

## Dashboard (`/admin`, PIN)

- **Summary cards:** total responses, attending parties, attending guests (the sum of guest counts on
  Yes replies) and declined. They refresh after every change.
- **Finding responses:** search by contact name, any guest name or phone number. Filter by attendance,
  sort newest or oldest, and export a server-generated CSV that includes all guest names.
- **Viewing:** each RSVP expands to show every guest name, and older RSVPs saved before names were
  collected show "Guest names not provided".
- **Selecting:** a checkbox per RSVP, plus **Select all** for the rows currently shown and
  **Delete selected**.
- **View / Edit:** change the contact name, phone, attendance, number of guests and individual guest
  names, and add or remove guests. Phone changes go through the same normalisation and duplicate check,
  with the record itself excluded. Removing the last attending guest asks you to change the RSVP to
  Declined or delete it. **Cancel** discards every unsaved change.
- **Delete:** a confirmation always states how many RSVP records and attending guests will be removed.
- **History:** the original submission time is kept; every edit records a separate last-updated time.
- **Access:** every read, update and delete endpoint checks the PIN session on the server.

## Local development

```bash
npm install
```

```bash
npm run dev
```

`npm run dev` runs **preview mode**: the purple "Preview mode" badge shows, and nothing is sent or saved.

**Full local test** (in-memory Postgres via PGlite; it never touches the live database):

```bash
npm run build
```

```bash
SEED_LEGACY=1 ADMIN_PIN=1234 npm run local
```

Open <http://localhost:3000> and <http://localhost:3000/admin> (PIN 1234). Then, in another terminal:

```bash
ADMIN_PIN=1234 node scripts/api-test.mjs
```

This runs 28 API checks covering guest names, duplicate phone formats, edits, deletes and auth.

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
api/                           Vercel functions: rsvp, health, admin/login|logout|session|rsvps|rsvp|delete|export
lib/                           database, PIN/session and HTTP helpers for the functions
shared/                        validation, filtering and CSV, used by both the browser and the server
scripts/                       local-server (PGlite), api-test (local), smoke-test (deployment)
vercel.json                    build settings, /admin route, security headers
```
