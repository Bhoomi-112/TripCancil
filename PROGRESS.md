# PROGRESS

## P0 — Scaffold + theme + components (done)
- Next.js 16 App Router + TypeScript strict + Tailwind v4 (`@theme` tokens, no config file).
- Fonts: `Press Start 2P` (display) + `Nunito` (body), self-hosted via `next/font`.
- Palette tokens: cream / ink / electric / hot pink / lime / cyan / grape / silver / sunny,
  plus radii (`window`, `bubble`, `sticker`), shadows (`sticker`, `bubble`, `window`) and
  animations (`pop`, `wiggle`, `float`, `shimmer`, `slide-up`, `blink`, `twinkle`).
- Surface utilities: `gloss`, `dotted-grid`, `scanlines`, `iridescent`, `chrome-text`.
- Component library in `src/components/ui`: Button (+ `ButtonLink`, `IconButton`,
  `buttonClass`), Window (+ `WindowDots`), Input/Textarea/Field/Label, Badge (pill and
  sticker), Modal, Tabs (+ `TabPanel`), Avatar (+ `AvatarStack`), Toast
  (`ToastProvider`, `useToast`), EmptyState (6 pixel illustrations), Skeleton
  (+ `SkeletonText`, `SkeletonCard`).
- `/design` shows every component in every state; `/` is a Y2K splash.
- App shell: fixed sidebar from 768px up, bottom tab bar under it, five routes
  `/plan` `/map` `/money` `/photos` `/trip` (placeholders that demo skeleton + empty state).
- Reduced motion respected globally; body copy is 16px+ and high contrast on cream.

## P1 — Database schema (done)
- `supabase/migrations/001_init.sql`: 13 tables, 8 enums, RLS enabled on every table with
  zero policies, `trip_id` indexes, four private buckets, explicit `revoke` of anon and
  authenticated privileges plus `revoke create on schema public`.
- Money is `bigint` paise everywhere with `> 0` / `>= 0` checks; lat/lng, dates, vote
  values, self-settlements and non-object category caps are all constrained in the DB.
- Circular FK handled: `trips.owner_member_id` is added after `members` exists.
- `src/lib/db/types.ts` — full hand-written `Database` type with `Relationships` for every
  FK, so `select("*, members(*)")` stays typed in later prompts.
- `src/lib/db/client.ts` — `import "server-only"`, cached service-role client, no anon key.
- `src/lib/env.ts` — lazy accessors, so builds never need env vars at import time.
- `scripts/seed.ts` — fixed UUIDs so it is re-runnable; 1 trip, 4 members (PIN 123456),
  6 places, 19 votes, 6 itinerary items, 12 packing items, budget, 10 expenses with exact
  splits (one equal-with-remainder, one exact split, one unequal split), 2 settlements.
  `npm run seed -- --dry-run` validates and prints without writing; the script throws if any
  expense's splits do not sum exactly to its amount.

### How P1 was verified
- The migration was applied to a real Postgres engine (PGlite/WASM) in a throwaway harness:
  **50/50 checks pass** — all 13 tables created, RLS on with 0 policies, anon and
  authenticated have no table privileges, 4 buckets inserted as private, 20+ indexes, and
  12 negative tests (negative amount, bad vote value, self-settlement, duplicate display
  name, short invite code, reversed dates, lat out of range, non-object caps, unknown enum
  value, missing payer FK, owner FK, soft delete keeps the row).
- `src/lib/db/types.ts` was diffed against the live catalog: column names, nullability,
  `Insert` optionality vs column defaults, and all 8 enum labels match exactly.
- `npm run typecheck`, `npm run lint`, `npm run build` and the seed dry run are all clean.

### Live verification
- The migration was applied to the real Supabase project `pqsnazkorjcyihulhckn` (SQL editor)
  and the seed was written to it: 1 trip, 4 members, 6 places, 19 votes, 6 itinerary items,
  12 packing items, 1 budget, 10 expenses, 36 splits, 2 settlements, and the 4 private buckets.
- Money was re-checked from the written rows: total paid = total share = 2,092,000 paise
  (Rs 20,920 of the Rs 30,000 budget), the per-member nets sum to 0, and the settlements
  cover exactly the Rs 7,248 credit Bhoomi is owed.
- One real bug surfaced only against live PostgREST: multi-row inserts use the *union* of
  keys, so packing rows that omitted `checked` were sent as `NULL` instead of the column
  default. Every write in `scripts/seed.ts` now passes `defaultToNull: false`
  (`const WRITES`), which omits absent keys from the statement. Later prompts must do the
  same for any partial-column insert.

### Quirks to remember
- `unique (trip_id, display_name)` is case-sensitive, so P2 must look a member up with
  `ilike` before inserting to stop "Bhoomi" and "bhoomi" both joining.
- The migration is single-run by design (`create type` has no `if not exists`).
- `documents` and `photos` are not seeded: their rows point at storage paths, so they get
  created by the upload routes in P6 and P12.
- The service-role key lives only in `.env.local` (gitignored) and in Vercel's environment
  variables. It must never be prefixed `NEXT_PUBLIC_`.

## Deferred
- Nothing from P0 or P1.

## Known bugs
- Dev-only hydration warning on `<html data-scribe-recorder-ready>` injected by the Next 16
  dev overlay. Not present in the production build.

## Next: P2 — auth (invite code + name + PIN)
