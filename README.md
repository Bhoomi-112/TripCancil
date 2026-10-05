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
- `http://localhost:3000/money` — the ledger: expenses, who owes whom, fewest payments to square up
- `/photos` `/trip` — the other tabs

## Live updates
There are no websockets. Authenticated screens poll with SWR every 5s, so a member sees the
group's edits within about five seconds:
- `GET /api/trips/[id]/itinerary` — plan board items and the trip's places
- `GET /api/trips/[id]/places` — map pins, each pin's days, the visit order per day, the
  members, and every pin's votes (up/down tally and who cast them)
- `GET /api/trips/[id]/money` — members, live expenses, every share, and settlements

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

## Voting on candidates
Every pin that is not in the plan is a live question, and the ballot is the window under the map
on `/map`. It lists the candidates ranked by score, with the counts and the voters' faces beside
them, so the group can see what everyone thinks instead of guessing from who spoke last.

Votes are not a second request. `readMapData` embeds `place_votes(member_id, value)` on the same
`places` select the map already polls, so the tally the ballot draws is part of the map payload
and arrives within the same 5 seconds as everything else. `place_votes` has no `trip_id` of its
own, which is exactly why it hangs off the pin: `places -> place_votes` needs no disambiguation,
and a vote can never be counted for the wrong trip.

| action | who | what happens |
| --- | --- | --- |
| In / Out on a ballot row or in a pin pop-up | any member | one vote per person per pin; the same button twice retracts it, a different one replaces it |
| Lock in | owner only | pick a day, the winner becomes a stop on it and leaves the ballot |

The member a vote is written for always comes from the session cookie, never from the browser, so
a vote only exists in the name of the person whose PIN passed. Voting the same way again deletes
the row rather than storing a second one. Ranking is score (ups minus downs), then ups, then name —
the ups tiebreak keeps two enthusiastic supporters ahead of two-plus-one-who-dislikes-it, and the
name tiebreak is what stops a tie from reshuffling every 5 seconds.

The owner's lock-in delegates to `addPlaceToDay`, so the day bounds, the position in the day, the
"this pin belongs to this trip" check and the read-only gate on an ended trip all stay in the one
place they already lived. An ended trip shows a closed ballot and refuses votes server-side.

`/design` has a **Votes** section that is a working ballot — switch the viewer between the four
members and between owner and plain member, and the row changes. `Ballot` and `BallotRow` take
optional `onVote` / `onLockIn` handlers: inside the app they are absent and the server actions run;
on `/design` they are supplied and nothing touches the database.

## Database
```bash
supabase/migrations/001_init.sql      # paste into the Supabase dashboard SQL editor
supabase/migrations/002_travelers.sql # same, after 001 — adds `travelers`
npm run seed                          # 1 trip, 4 members (PIN 123456), 6 places, 19 votes, 10 expenses
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
| `NODE_OPTIONS=--conditions=react-server npx tsx scripts/verify-money.mts` | 89 checks against the live database and a running dev server; deletes its own fixtures |
| `NODE_OPTIONS=--conditions=react-server npx tsx scripts/verify-votes.mts` | 89 checks for voting: tallies, sort tiebreaks, retraction, lock-in, cross-trip and ended-trip guards, and the map page over HTTP |

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

`/money` reads one payload from `readMoney` in `src/lib/money/service.ts`, shared by the page and
the polling route, then does the arithmetic in the browser with the pure functions next to it:
`parsePaise` / `formatPaise` in `src/lib/money/paise.ts`, and `computeBalances` /
`simplifyDebts` in `src/lib/money/balances.ts`. A split is equal for now and the payer is always
part of it; the leftover paise goes to the first member id, so shares always add up to the amount.
Every balance nets to zero across the group, which the test harness asserts on the seeded trip.

Settling up is two taps on purpose. **Log promise** writes a `pending` settlement that moves no
money; either of the two people involved or the owner then marks it paid, then settled. Removing
an expense is a soft delete: the row stays as an audit trail and drops out of the totals. An over
trip is read-only here exactly as it is everywhere else.

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
Open the deployment URL, then `/design` for the component gallery (including the working Votes
ballot) and `/plan` for the shell. From P2 onwards, test the full loop: create a trip in one
browser, join from a second browser (incognito) using the invite code, and confirm both see each
other's edits — and in `/map` that both can vote on the same pin and see each other's vote within
five seconds.

To check the data layer without clicking through it, run `scripts/verify-money.mts` and
`scripts/verify-votes.mts` (see Scripts). Each creates its own throwaway trips, asserts against the
live database and a running `npm run dev`, then deletes what it made.

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
