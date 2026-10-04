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

## Rules
See `AGENTS.md`. `PROGRESS.md` tracks what is done, deferred and known-buggy.
