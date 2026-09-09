# Setup

Roughly 15 minutes. You need a PostgreSQL database (any host works — a local
install, Railway, Render, Neon, RDS, or even a Supabase project used as plain
Postgres) and a GitHub + Vercel account to deploy.

---

## 1. Get a PostgreSQL database

Any Postgres 14+ works. Two easy options:

- **Local**: install Postgres, then `createdb rugby_gym`.
- **Hosted (free tier)**: Railway, Render, or Neon all give you a connection
  string in under a minute.

Either way, you end up with a connection string shaped like:

```
postgres://user:password@host:5432/database
```

Hosted providers usually need `?sslmode=require` appended.

## 2. Collect the two secrets

Create `.env.local` in the project root:

```bash
cp .env.example .env.local
```

- **`DATABASE_URL`** — the connection string from step 1.
- **`SESSION_SECRET`** — signs the login cookie. Generate one:

  ```bash
  node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
  ```

> Nothing here is prefixed `NEXT_PUBLIC_` — the database credential is a
> server-only secret, never sent to the browser. `.env.local` is already
> gitignored.

## 3. Apply the schema and seed

```bash
npm install
npm run db:migrate   # applies db/migrations/ — creates all eight tables
npm run db:seed       # loads the two squads + ~40 starting exercises
```

The seed creates:

- **Palestine**, login code `PAL2026`
- **Cyprus**, login code `CYP2026`
- ~40 rugby exercises tagged with progression types

Those codes work as-is, so this step is optional — but change them before you
hand them out:

```sql
update teams set login_code = 'YOUR-CODE' where name = 'Palestine';
update teams set login_code = 'YOUR-OTHER-CODE' where name = 'Cyprus';
```

Run that against your database with `psql "$DATABASE_URL" -c "..."` or any
Postgres client.

## 4. Check it, then run it

```bash
npm run check:db
```

`check:db` is the preflight: it confirms both variables are set, that the
database is reachable, that all eight tables exist and that the seed has
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
3. Add `DATABASE_URL` and `SESSION_SECRET` under Settings → Environment
   Variables, for Production **and** Preview. Point `DATABASE_URL` at a
   database Vercel's servers can actually reach (a hosted Postgres, not
   `localhost`).
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

If **every** admin PIN is lost, clear the admin flag directly in the database
and the first-run setup path reopens:

```sql
update players set is_admin = false, admin_pin_hash = null
where team_id = (select id from teams where name = 'Palestine');
```

## Costs

A small managed Postgres (Railway/Render/Neon free or hobby tier) comfortably
covers a squad of 40 logging four sessions a week — on the order of 30,000 log
rows a year, a few MB. Vercel Hobby covers the hosting. Realistically this runs
at little to no cost, though unlike the Supabase original there is no single
"free forever" managed database guarantee — check your host's tier limits.
