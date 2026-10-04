# TripCancil

Retro Y2K trip OS for friend groups: itinerary, map, money, photobooth, recap.

## Stack
Next.js (App Router) · TypeScript strict · Tailwind v4 · Supabase (Postgres + Storage
only, no Supabase Auth) · Leaflet · Canvas.

## Run it
```bash
npm install
cp .env.example .env.local   # fill in SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
npm run dev
```

- `http://localhost:3000` — splash
- `http://localhost:3000/design` — every UI component in every state (start here)
- `http://localhost:3000/plan` `/map` `/money` `/photos` `/trip` — app shell

## Database
```bash
supabase/migrations/001_init.sql   # apply via the Supabase dashboard SQL editor or CLI
npm run seed                       # 1 trip, 4 members (PIN 123456), places, 10 expenses
npm run seed -- --dry-run          # validate + print the seed data without writing
```

The migration creates 13 tables, 8 enums, RLS on every table with zero policies, all
`trip_id` indexes, and four private storage buckets (`documents`, `receipts`,
`payment-qrs`, `photos`). Seed rows use fixed UUIDs, so re-running the seed is safe.

Seeded invite code: `KONKAN7X4QP2M` — member PIN `123456` for Bhoomi, Ravi, Sana, Dev.

## Scripts
| command | what it does |
| --- | --- |
| `npm run dev` | dev server |
| `npm run build` | production build |
| `npm run lint` | eslint |
| `npm run typecheck` | tsc --noEmit |
| `npm run seed` | seed Supabase (add `-- --dry-run` to preview) |

## Money
All amounts are integer paise (`amount_paise`, `share_paise`, `total_paise`). Never floats.

## Deploy to Vercel

No `vercel.json` is needed — Vercel auto-detects Next.js from `package.json`, runs
`npm run build`, and serves the `.next` output. `engines.node` is pinned to `>=22`.

### 1. Import the repo
Vercel dashboard → **Add New → Project** → import `Bhoomi-112/TripCancil` → **Deploy**.
Leave Build Command (`npm run build`), Output Directory and Install Command as detected.

### 2. Add environment variables
Project → **Settings → Environment Variables**. Tick **Production**, **Preview** and
**Development** for all four:

| variable | example | notes |
| --- | --- | --- |
| `SUPABASE_URL` | `https://abcdefghijklm.supabase.co` | project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOi…` | server only, must **not** start with `NEXT_PUBLIC_` |
| `SESSION_SECRET` | 32+ random bytes | signs the session JWT from P2 |
| `NEXT_PUBLIC_APP_URL` | `https://tripcancil.vercel.app` | used for invite links and QR codes |

Generate a secret with `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`.

`NEXT_PUBLIC_*` values are inlined at build time, so after changing `NEXT_PUBLIC_APP_URL`
you must redeploy (Settings → Deployments → ⋯ → Redeploy), not just restart.

### 3. Prepare the database
Vercel only runs the app; the schema and seed run separately against the same Supabase
project, from your machine:

```bash
# paste supabase/migrations/001_init.sql into the Supabase SQL editor and run it
cp .env.example .env.local   # paste the same values you added in Vercel
npm run seed                 # optional demo data
```

Supabase is reached over HTTPS (PostgREST + Storage), so no IP allowlist or private network
config is required from Vercel.

### 4. Verify
Open the deployment URL, then `/design` for the component gallery and `/plan` for the shell.
From P2 onwards, test the full loop: create a trip in one browser, join from a second
browser (incognito) using the invite code, and confirm both see each other's edits.

### CLI alternative
The Vercel CLI is not installed in this repo. If you prefer it:
```bash
npm i -g vercel
vercel link --project <project-name> --yes
vercel env pull .env.local
vercel --prod
```
Use an explicit project name — the local folder is called `Frnd grp pojects`, which is not a
valid Vercel/npm project name.

## Rules
See `AGENTS.md`. `PROGRESS.md` tracks what is done, deferred and known-buggy.
