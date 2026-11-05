# A Magical Birthday Celebration — invitation, RSVP & owner dashboard

An interactive fairytale invitation for **Hermione, Isabella and Selena**, plus a password-protected
dashboard where the event owner sees every RSVP.

| Page | Path | Who it's for |
|---|---|---|
| Invitation + RSVP | `/` | Guests. Public, no account needed |
| RSVP dashboard | `/admin/` | Event owner only. Password login, enforced by the server |

Stack: React 18 + Vite + Framer Motion (frontend), a Cloudflare Worker (API) and
Cloudflare D1 (shared SQLite database). Everything is served from one HTTPS origin on the free
Cloudflare plan.

---

## 1. Run it locally

```bash
npm install
```

**Design only (preview mode, nothing is saved):**

```bash
npm run dev
```

A purple "Preview mode · RSVPs are not sent" badge shows, and RSVP confirmations say the response was *not*
sent.

**Full stack (real API, local database, owner login):**

```bash
npm run setup:owner:local
```

```bash
npm run db:migrate:local
```

```bash
npm run build && npm run dev:api
```

Open <http://localhost:8787> for the invitation and <http://localhost:8787/admin/> for the dashboard.
For hot-reload while using the local API, run `npm run dev:api` in one terminal and `npm run dev:live` in another.

```bash
OWNER_PASSWORD='the password you chose' npm run test:smoke
```

This runs 12 end-to-end checks covering saving, duplicates, validation, cross-site posts, auth and CSV.

---

## 2. Deploy (public HTTPS links)

You need a free Cloudflare account. Run all of this from the project folder:

1. **Sign in:**

   ```bash
   npx wrangler login
   ```

2. **Create the database.** Then copy the printed `database_id` into `wrangler.toml`, replacing `00000000-…`:

   ```bash
   npx wrangler d1 create rsvp-maldives
   ```

3. **Create the tables:**

   ```bash
   npm run db:migrate
   ```

4. **Build and deploy.** Wrangler prints the live URL, e.g. `https://rsvp-maldives.<your-subdomain>.workers.dev`:

   ```bash
   npm run deploy
   ```

5. **Set the owner login** (next section).

6. **Check the live site.** Note that this adds two "Smoke Test …" rows to the real dashboard:

   ```bash
   BASE_URL=https://rsvp-maldives.<your-subdomain>.workers.dev OWNER_PASSWORD='…' npm run test:smoke
   ```

**Links to hand over**

- Guests: `https://rsvp-maldives.<your-subdomain>.workers.dev/`
- Event owner: `https://rsvp-maldives.<your-subdomain>.workers.dev/admin/`

To use a custom domain, add it in the Cloudflare dashboard under Workers → rsvp-maldives → Settings → Domains & Routes.

---

## 3. Owner login: secure setup

Run this command and type the owner's password when prompted. The input is hidden. Use at least 12 characters; a short phrase works well.

```bash
npm run setup:owner
```

- Only a **PBKDF2-SHA256 hash** of the password is stored, as the Worker secret `OWNER_PASSWORD_HASH`.
  A random `SESSION_SECRET` that signs login cookies is stored alongside it. Neither secret is in the code or in git.
- Give the password to the owner **separately from the link**, for example in person or by phone, not in the same message.
- To change the password, run the command again. This also signs out every existing session.
- Sessions last 12 hours and use `HttpOnly; Secure; SameSite=Strict` cookies.
- After 8 wrong passwords from one IP address, sign-in is paused for 15 minutes.

**What the server enforces:**

- Every `/api/admin/*` endpoint checks the session, including the JSON list and the CSV download.
- Guest data never ships in the page bundle. The public site can only *add* an RSVP; it can never read one.
- POST requests from other websites are rejected.

---

## 4. How RSVP collection works

```
Guest form ──► submitRsvp() (src/services/rsvpService.js)
                 │  POST /api/rsvp  { attendance, name, phone, guests, submissionId }
                 ▼
Worker (worker/index.js) ── validates again with shared/rsvpValidation.js
                 │  INSERT … ON CONFLICT(submission_id) DO UPDATE … RETURNING id
                 ▼
D1 table `rsvps` ──► /admin dashboard (owner session only)
```

- **Yes** requires name, phone and guest count (whole number ≥ 1, including the person replying).
  **No** requires only the name; phone is cleared and guests are saved as **0**.
- **Confirmation appears only after the database confirms the save** (`{ ok: true, id }`). Otherwise the guest sees
  an error with *Try again*, and everything they typed stays in the form.
- **No duplicates:** each form gets a `submissionId` once. Repeated taps are ignored while a request is in
  flight. A retry, for example after a timeout where the first save actually succeeded, updates the same row
  instead of adding a new one.
- "Attending guests" on the dashboard = the sum of guest counts on Yes responses.
- The CSV export is generated **by the server**, using the dashboard's current search, filter and sort.

---

## 5. Editing content and artwork

Everything editable is in **`src/config/event.js`**:

- `EVENT`: date and time labels, ISO start and end times (`+05:00`), venue and map query.
- `COPY`: all invitation wording.
- `ASSETS`: image paths, alt text and focal points.
- `RSVP_CONFIG`: endpoint, timeout and maximum guests (the server limit is `MAX_GUESTS` in `wrangler.toml`).

Theme colours are in `src/styles/theme.css`.

**Optional artwork not yet in the repo.** Drop these files into `public/assets/` and set their `src`:

- `ASSETS.invitationArt.src = '/assets/invitation.jpg'` makes Chapter 1 use the ornate invitation artwork. Adjust `textArea` so the
  live text sits in its empty ivory area. Until then, Chapter 1 is an ivory card built from the castle art.
- `ASSETS.celebrating.src = '/assets/scene-5.jpg'` gives Chapter 4 its own scene. Until then, it shows an oval portrait crop of the ballroom art.

## Project map

```
index.html, admin/index.html   two pages (Vite multi-page build)
src/App.jsx                    invitation shell: envelope → chapters → nav
src/components/                Envelope, Sparkles, RsvpForm, Countdown, ChapterNav, …
src/chapters/                  the five storybook chapters
src/admin/                     owner dashboard (login, summary, table/cards, CSV)
src/services/rsvpService.js    the only place that knows how RSVPs are sent
shared/                        validation, filtering and CSV, used by browser and server
worker/                        Cloudflare Worker API + auth
migrations/                    D1 schema
scripts/                       owner setup, smoke tests
```
