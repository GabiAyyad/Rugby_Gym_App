# Setup

Roughly 15 minutes, most of it waiting for Supabase to provision. You need a
GitHub account, a Supabase account and a Vercel account — all free tiers cover a
40-player squad comfortably.

---

## 1. Create the Supabase project

1. Go to <https://supabase.com/dashboard> and create a new project.
2. Pick a region close to the squads — **Frankfurt (eu-central-1)** is the
   sensible choice for Palestine and Cyprus.
3. Save the database password somewhere safe. You will need it once, in step 3.
4. Wait for provisioning to finish (about two minutes).

## 2. Collect the three secrets

In the Supabase dashboard:

| Value | Where |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → Data API → **Project URL** |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API Keys → `service_role` (click Reveal) |

> Copy the **Project URL** (`https://<ref>.supabase.co`), not the RESTful
> endpoint shown just below it (`https://<ref>.supabase.co/rest/v1/`).
> supabase-js appends `/rest/v1` itself, so the endpoint version produces a
> doubled path and every query 404s — which surfaces as "cannot reach the
> database" even though the project is fine. `npm run check:db` catches it.

Generate the third yourself:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

That is your `SESSION_SECRET` — it signs the login cookie.

Now create `.env.local` in the project root:

```bash
cp .env.example .env.local
```

and paste the three values in.

> The service role key bypasses Row Level Security. It must never be committed
> and never be prefixed `NEXT_PUBLIC_`. `.env.local` is already gitignored.

## 3. Apply the schema

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>   # the ref is in your project URL
npx supabase db push
```

`db push` applies everything in `supabase/migrations/`. Then load the two squads
and the starting exercise library — open the Supabase dashboard → SQL Editor,
paste the contents of `supabase/seed.sql`, and run it.

The seed creates:

- **Palestine**, login code `PAL2026`
- **Cyprus**, login code `CYP2026`
- ~40 rugby exercises tagged with progression types

Those codes work as-is, so this step is optional — but change them before you
hand them out. In the Supabase dashboard, open **SQL Editor** (left sidebar) →
**New query**, paste this, and press Run:

```sql
update teams set login_code = 'YOUR-CODE' where name = 'Palestine';
update teams set login_code = 'YOUR-OTHER-CODE' where name = 'Cyprus';
```

Confirm it took with `select name, login_code from teams;` in the same editor.

## 4. Check it, then run it

```bash
npm install
npm run check:db
```

`check:db` is the preflight: it confirms the three variables are set, that the
key reaches your project, that all eight tables exist and that the seed has
loaded — and tells you which step to redo if not. Then:

```bash
npm run dev
```

Open <http://localhost:3000>, enter a team code, and you will be offered
**"Set up the first admin account"** — that path is open only while a team has
zero admins, and closes for good once one exists. Pick your name and a 4–8 digit
PIN.

From there: add players on **Players**, check the exercise library on
**Exercises**, build a block on **Programs**, and watch **Adherence**.

## 5. Deploy to Vercel

1. Push this repo to GitHub.
2. <https://vercel.com/new> → import the repo. Vercel detects Next.js on its own;
   no build settings to change.
3. Add the same three environment variables (`NEXT_PUBLIC_SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET`) under Settings → Environment
   Variables, for Production **and** Preview.
4. Deploy. Every push to `main` redeploys automatically from then on.

Optionally set `NEXT_PUBLIC_APP_TIME_ZONE` (defaults to `Asia/Nicosia`, which is
correct for both squads — they share EET/EEST).

Tell players to open the deployed URL on their phone and use **Add to Home
Screen**; it runs standalone and the logging screen works without signal.

---

## Day-to-day

| Task | Where |
|---|---|
| Add or remove a player | Admin → Players |
| Give someone admin rights | Admin → Players → toggle Admin, set a PIN |
| Add an exercise to the library | Admin → Exercises |
| Build next month's block | Admin → Programs → Duplicate the current block, shift the dates |
| See who isn't training | Admin → Adherence |
| Reset a forgotten admin PIN | Another admin edits that player and sets a new PIN |
| Diagnose "the app can't see the database" | `npm run check:db` |

If **every** admin PIN is lost, clear the admin flag in the Supabase SQL editor
and the first-run setup path reopens:

```sql
update players set is_admin = false, admin_pin_hash = null
where team_id = (select id from teams where name = 'Palestine');
```

## Costs

Supabase free tier: 500 MB database, 2 GB egress. A squad of 40 logging four
sessions a week produces on the order of 30 000 log rows a year — a few MB.
Vercel Hobby covers the hosting. Realistically this runs at zero cost.
