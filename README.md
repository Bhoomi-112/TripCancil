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
- `http://localhost:3000/plan` — trip home + day-by-day itinerary (drag to reorder, live)
- `http://localhost:3000/trips` — every trip this device has signed into, one tap to open
- `http://localhost:3000/map` — pins by vibe, day chips, a dashed line through the day's stops
- `/money` `/photos` `/trip` — the other tabs

## Live updates
There are no websockets. Authenticated screens poll with SWR every 5s, so a member sees the
group's edits within about five seconds:
- `GET /api/trips/[id]/itinerary` — plan board items and the trip's places
- `GET /api/trips/[id]/places` — map pins, each pin's days, and the visit order per day

Both return 401 signed out and 404 if the id in the path is not the session's trip.

## Places and search
`/map` reads one payload from `buildMapPayload` in `src/lib/maps/places.ts`, shared by the page
and the polling route, so the first paint and every refresh agree. A pin's `location_type` is
its colour, a stop's day comes from `itinerary_items.place_id`, and picking a day draws that
day's stops in plan order.

Place search runs through the server: `src/lib/maps/nominatim.ts` is the only caller of
Nominatim's public API, with the `User-Agent` their policy requires and one request per 1.1s.
A hit can be proposed as a candidate (`places.status = 'proposed'`) or dropped straight into a
day, which creates the pin as `locked` plus the itinerary item. Re-searching a spot already on
the trip reuses that pin instead of adding a second one.

## Database
```bash
supabase/migrations/001_init.sql      # paste into the Supabase dashboard SQL editor
supabase/migrations/002_travelers.sql # same, after 001 — adds `travelers`
npm run seed                          # 1 trip, 4 members (PIN 123456), places, 10 expenses
npm run seed -- --dry-run             # validate + print the seed data without writing
```

`001` creates 13 tables, 8 enums, RLS on every table with zero policies, all `trip_id`
indexes, and four private storage buckets (`documents`, `receipts`, `payment-qrs`, `photos`).
`002` adds the `travelers` table and `members.traveler_id`, which is what lets one person
hold memberships in several trips and lets a device open them without a PIN. It is safe to
paste twice; `001` is single-run by design. Seed rows use fixed UUIDs, so re-running the
seed is safe.

Seeded invite code: `KONKAN7X4QP2M` — member PIN `123456` for Bhoomi, Ravi, Sana, Dev.

## Scripts
| command | what it does |
| --- | --- |
| `npm run dev` | dev server |
| `npm run build` | production build |
| `npm run lint` | eslint |
| `npm run typecheck` | tsc --noEmit |
| `npm run seed` | seed Supabase (add `-- --dry-run` to preview) |

## Signing in across trips
There is no account and no password. A trip is entered with its invite code, a display name
and a 6-digit PIN, and that PIN is the only proof of who you are.

The first time a device gets through a trip's PIN, it also mints a `travelers` row and
remembers it in the `tc_traveller` cookie (180 days, httpOnly). That is what `/trips` lists,
and what makes one tap open a trip without typing the PIN again. It is a convenience, not a
new credential: opening still requires a membership row for that traveller, and "Forget this
device" on `/trips` deletes both cookies. A trip whose last day has passed opens read-only.

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
# paste supabase/migrations/001_init.sql into the Supabase SQL editor and run it,
# then paste 002_travelers.sql the same way
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
