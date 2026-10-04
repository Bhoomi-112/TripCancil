# TripCancil

Retro Y2K trip OS for friend groups: itinerary, map, money, photobooth, recap.

## Stack
Next.js (App Router) · TypeScript strict · Tailwind v4 · Supabase (Postgres + Storage
only, no Supabase Auth) · Leaflet · Canvas.

## Run it
```bash
npm install
cp .env.example .env.local   # only needed from P1 onwards
npm run dev
```

- `http://localhost:3000` — splash
- `http://localhost:3000/design` — every UI component in every state (start here)
- `http://localhost:3000/plan` `/map` `/money` `/photos` `/trip` — app shell

## Scripts
| command | what it does |
| --- | --- |
| `npm run dev` | dev server |
| `npm run build` | production build |
| `npm run lint` | eslint |
| `npm run typecheck` | tsc --noEmit |

## Rules
See `AGENTS.md`. `PROGRESS.md` tracks what is done, deferred and known-buggy.
