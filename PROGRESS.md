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

## P2 — Auth: invite code + display name + PIN (done)
- `src/lib/auth/codes.ts` — 12-character codes from `crypto.randomBytes` with rejection
  sampling over a 32-glyph alphabet (no `I O 0 1`), so a code read aloud survives a
  forward. Input is uppercased and stripped of punctuation, so typing is forgiving.
- `src/lib/auth/password.ts` — bcrypt cost 10 via `bcryptjs`. `burnPinCompare` compares
  against a decoy hash when the member does not exist, so a missing member costs the same
  time as a wrong PIN and the two cannot be told apart by timing.
- `src/lib/auth/session.ts` — HS256 JWT via `jose` in an httpOnly, `SameSite=Lax`,
  `Secure`-in-production cookie, 14-day expiry. The token carries only `member_id` (sub)
  and `trip_id`: role, name and membership are re-read from the database on every
  request, so removing a member or changing a role takes effect immediately instead of
  living on inside a cookie for a fortnight.
- `src/lib/auth/context.ts` — `requireSession` is the single gate for every read and
  write. It re-reads the member row, rejects a token whose `trip_id` disagrees with the
  member it points at, and redirects to `/join`. `requireOwner` gates the owner tools.
- `src/lib/auth/rate-limit.ts` — 5 wrong PINs locks that member for 15 minutes
  (`members.failed_attempts` + `locked_until`), plus an IP throttle of 20 failures per
  15 minutes from `login_attempts`, which also covers attempts that never resolved to a
  member. Resetting a PIN clears the lockout with it.
- `src/lib/auth/service.ts` — `createTrip`, `joinOrLogin`, `loginWithPin`,
  `rotateInviteCode`. No cookie writes and no `next/headers` reads here: the actions pass
  the client IP in, which keeps the business logic testable outside a request.
  An unknown display name with the invite code *joins* (the code is the invitation and the
  joiner picks their own PIN); a known name must pass the PIN. Because the unique
  constraint is case sensitive, the name is matched with `ilike`, and after insert the
  trip is re-counted with `ilike` so a simultaneous case-variant join backs itself out
  instead of shadowing the first member.
- Server actions only: `src/app/(auth)/actions.ts` (create, join), `src/app/(app)/actions.ts`
  (logout, rotate, reset PIN, remove member). Every one of them validates with zod, and
  the owner actions re-check ownership inside the action rather than trusting the UI.
- Screens: `/join` (invite code + name + PIN, one form for both joining and signing in),
  `/new` (create a trip and mint the code), and `/trip`, which is now real: the invite
  plate with a copy/share button, an SVG QR that scans into `/join?code=…`, the crew list,
  and the owner tools. `(app)/layout.tsx` gates the app, `(auth)/layout.tsx` bounces
  signed-in users to `/plan`. No `proxy.ts`/middleware: Next 16 deprecates it in favour of
  doing this in the layout, where the membership check can actually reach the database.
- `PinInput` is one native input drawn over six cells, so paste, backspace and
  one-time-code autofill work instead of being reimplemented. `QrCode` renders SVG paths,
  not a data-URL image. Both are in `/design` under a new "Auth" section.

### How P2 was verified
- **48/48 checks** in a throwaway harness running the real service against the live
  Supabase project: 2000 codes are unique and unambiguous; zod rejects bad PINs, reversed
  dates, mismatched confirmations and unknown location types; bcrypt hashes are salted and
  never contain the PIN; create/join/login round-trip; case-insensitive name matching;
  the 5th wrong PIN locks the member, the correct PIN is refused while locked, the audit
  trail records the attempts; an owner reset restores access and kills the old PIN;
  rotation invalidates the old code; a removed member cannot sign back in. The harness trip
  was deleted afterwards and the seeded trip was left untouched.
- Over real HTTP against `next start`: unauthenticated `/plan`, `/trip` and `/map` all
  307 to `/join`; a garbage and a tampered cookie are both refused; a signed cookie opens
  `/plan`, `/trip` and `/money`; a signed cookie bounces `/join` and `/new` back to `/plan`.
- Rendered HTML was diffed per role: the owner sees Rotate / Reset PIN / Remove, a plain
  member sees none of them.
- `npm run typecheck`, `npm run lint` and `npm run build` are clean.

### Quirks to remember
- `NEXT_PUBLIC_APP_URL` is hand-typed into a dashboard, so `env.appUrl` adds `https://`
  when the scheme is missing. Without it the QR code and share link scan as a relative path.
- The lockout counter resets to 0 the moment the lockout starts, so a member gets a fresh
  5 attempts after the 15 minutes, instead of 10.
- A plain member deliberately sees no owner controls at all; `MemberRow` takes `canManage`
  separately from the row's own `isOwner`, because the row role and the viewer's role are
  different questions.

## Deferred
- Nothing from P0 to P2. Still to do: transferring ownership, letting the owner leave,
  and password-recovery-by-owner is only a PIN reset (no trip-admin takeover).

## Known bugs
- Dev-only hydration warning on `<html data-scribe-recorder-ready>` injected by the Next 16
  dev overlay. Not present in the production build.

## P3 — Plan + Map places groundwork (in progress)
- Leaflet + react-leaflet added.

## Next: implement real plan + places (itinerary skeleton, places list, Nominatim search, Leaflet map with pins).
