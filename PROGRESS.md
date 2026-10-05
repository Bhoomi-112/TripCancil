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

## P3 — Trip home + itinerary builder (done)
- Days are derived from the trip dates, never stored: `src/lib/itinerary/days.ts` is pure
  and free of `server-only`, so the screen and the actions share one definition of "day 3".
  `day_index` stays 0-based in the database and 1-based on screen, with UTC maths and a
  `MAX_TRIP_DAYS` cap of 30 (longer trips would need a different day picker than chips).
- `src/lib/itinerary/service.ts` — `readItinerary`, `createItem`, `updateItem`, `deleteItem`,
  `reorderDay`, all behind `requireSession`. Every write is additionally filtered by
  `trip_id`, so a crafted id from another trip is a no-op, and a `place_id` from another
  trip is silently dropped instead of attached.
- `reorderDay` takes the day's full new order from the client and appends anything it did
  not know about (an item another member added mid-drag) in its existing relative order, so
  a concurrent edit can never make an item disappear or get double-positioned.
- Server actions in `src/app/(app)/plan/actions.ts` (create, update, delete, reorder) all
  validate with zod and `revalidatePath("/plan")`. The reorder action takes plain arguments
  rather than `FormData` because a drag has no form to submit.
- `GET /api/trips/[tripId]/itinerary` is the poll target: it re-checks the session, and the
  `tripId` in the path against `context.trip.id`, before returning items + places. 401 when
  signed out, 404 for someone else's trip, and it never returns a storage path.
- The Plan screen is server-rendered first paint (`TripHeader` with name, dates, destination,
  location badge and the crew's avatars) and then a client `PlanBoard` that SWR-polls the
  route above every 5s with the server payload as `fallbackData`. The "live 5s" chip in the
  header is that poll, made visible.
- Drag-and-drop is `@dnd-kit/sortable` with a `PointerSensor` at an 8px activation distance
  (so taps still edit and the list still scrolls on touch) plus a `KeyboardSensor`. The new
  order is applied locally first, the poll is paused for the round trip so it cannot yank a
  row back mid-flight, and a failed save falls back to a refetch with an error toast.
- Add / edit share one form (`ItineraryItemForm`) because both actions return the same
  `ActionState`; delete goes through a confirm modal rather than `window.confirm`.
- `Select` and `GripIcon` were added to the UI kit, and `Select` is in `/design`.

### How P3 was verified
- **57/57 checks** in a throwaway harness running the real service against the live Supabase
  project: day maths (single day, inclusive range, cross-month, leap day, reversed and junk
  dates, 30-day clamp), time normalisation and formatting, zod rejection of blank titles,
  day -1/30, `25:00` and junk uuids; create normalises `07:15` to `07:15:00`, copies the
  place's `location_type`, nulls blank notes and increments `position`; a day past the trip
  end and `day_index: 999` are both refused; a place from another trip is dropped; reorder
  persists and renumbers from 0, ignores ids from nowhere and keeps unlisted items; update
  moves an item across days onto the end of the new day; an update or delete carrying
  another trip's id changes nothing; the read payload is sorted and carries no storage
  paths. Harness rows were deleted and the seeded positions renumbered afterwards.
- Over real HTTP against `next start`: `/plan` redirects a signed-out browser to `/join`; the
  itinerary route answers 401 with no cookie and with a garbage cookie, 200 with a signed
  cookie, and 404 when the path carries another trip's id. A second member's insert showed
  up on the very next poll and disappeared on the one after the delete.
- Server-rendered `/plan` HTML contains the trip window, the crew, all three day chips, both
  of Day 1's items with their times, place names and notes, and the tablist.
- `npm run typecheck`, `npm run lint` and `npm run build` are clean.

### Quirks to remember
- The P3 groundwork commit had five type errors left in it (a `Place` type that was never
  exported, a nullable `location_type` used as a record key, and two `EmptyState`
  illustrations that do not exist: the art set is `beach | map | camera | coins | suitcase |
  cloud`). All fixed.
- `useSWR` returns `data?.items ?? []` fresh on every render, which the lint rules read as a
  new dependency for each `useMemo`/`useCallback`; both are wrapped in `useMemo` to keep the
  optimistic rewrite and the per-day counts stable.
- Any partial-column insert in this app must pass `defaultToNull: false`; `createItem`
  writes every column explicitly so it never depends on that.

## Traveller accounts + my trips (done)
- `supabase/migrations/002_travelers.sql` adds `travelers (id, created_at)` and
  `members.traveler_id` (FK, `on delete set null`), a `members_traveler_id_idx`, a partial
  unique index on `(trip_id, traveler_id) where traveler_id is not null`, RLS on with no
  policies, `revoke all` from anon/authenticated, and a `notify pgrst` so the API sees it
  immediately. Unlike `001` it is fully re-runnable (`if not exists` everywhere), because the
  dashboard SQL editor has no rollback for a half-pasted script.
- A `travelers` row is a person, not a login: no email, no password, nothing to guess. Its
  only credential is possession of the signed `tc_traveller` cookie
  (`src/lib/traveller/session.ts`, HS256, 180 days, httpOnly/Secure/SameSite=Lax, same flags
  as `tc_session`). The cookie is not a trip session: every trip screen still needs
  `tc_session`, and `openTripAction` re-reads the member row for that traveller before it
  mints one, so a trip id from the form cannot borrow another trip's membership.
- First claim wins. `claimMemberForTraveller` updates with `.is("traveler_id", null)`, so a
  second device proving the same PIN gets `false` instead of a silent handover; a partial
  unique index backstops the same rule in the database. `createTrip`, `joinOrLogin` and
  `loginWithPin` all take an optional `travellerId`, so rows created before this prompt are
  adopted the first time their owner signs in again, and a wrong PIN claims nothing.
- `listTravellerTrips` (`src/lib/traveller/service.ts`) reads the traveller's memberships in
  one embed plus one read per child table for the counts, so a dashboard with a dozen trips is
  6 queries, not one per trip. It returns ids, names, dates, counts and `ended` only — no pin
  hashes, no storage paths. The embed needs the `trips!members_trip_id_fkey(...)` hint
  because `trips.owner_member_id` is a second relationship to `members`.
- `/trips` lives outside the `(app)` group, since it cannot require a trip to be open. It
  splits live trips from past ones, badges owner vs member and read-only, and shows real
  counts. Actions: `openTripAction`, `updateTripAction`, `deleteTripAction`,
  `forgetDeviceAction` (clears both cookies). Entry points: the splash grows a "My trips"
  button only when a traveller cookie exists, and the trip shell has a "My trips" link above
  the sidebar tabs / in the mobile header, without disturbing the 5-tab bottom bar.
- Owner tools on `/trips`: rename, re-date, re-theme, and delete. `updateTripDetails`
  refuses a non-owner, an ended trip, and shortening a trip while plan items sit on the days
  the new dates would remove (it counts the strays first, so the message names them). The
  service re-parses its own input with the same zod schema rather than trusting the caller,
  so a bad payload cannot reach Postgres and surface a raw constraint error.
- `deleteTrip` deletes storage first: it walks all four private buckets under `<trip id>/`
  a page at a time (folders in Supabase Storage are prefixes, so it recurses) and refuses to
  drop the trip row if any removal fails, because the cascade would orphan files — someone's
  passport scan — with nothing left pointing at them. Deleting needs the trip name typed.
- Ended trips are read-only everywhere, not just here: `tripHasEnded(endDate, today)` in
  `src/lib/constants.ts` (`end_date < todayUtcISO()`, UTC because trip dates are `date`), and
  the P3 itinerary service now calls `assertTripEditable` on all four writes.
- Read-only is also how it *looks*: `PlanBoard` takes an `editable` flag from
  `tripHasEnded`, so an over trip renders the same board with no Add button, no live chip, no
  grip, no pencil and no bin, and says "read-only" in the header instead of "drag to reorder".

### How this was verified
- **37/37 checks** in a throwaway harness against the live project: schema present; first
  claim wins and a second device is refused; the listing derives `isOwner` from
  `owner_member_id` and leaks no pin hash; an unknown traveller sees nothing; access is
  refused for an unlinked traveller and for a random trip id; a live trip edits; a non-owner,
  reversed dates and a shortening-over-items edit are all refused with a readable message;
  delete cascades members, itinerary items, expenses, photos and documents and empties all
  four buckets (including a nested prefix); an ended trip refuses both edit and delete and
  survives; every fixture row, traveller and test trip was removed afterwards.
- **26/26 HTTP checks** against the dev server: the splash hides "My trips" with no cookie;
  `/trips` 307s to `/` without a traveller cookie and with a tampered one; the empty state
  renders with `/join` + `/new`; the seeded trip lists with its owner badge, counts and open
  form; an ended trip gets the read-only badge and no edit/delete; no bcrypt hash appears in
  the HTML; `/plan` still renders for the member and now links back to `/trips`; the
  itinerary route still answers 200/401/404 correctly.
- **10/10 auth wiring checks** on the live service: create-trip and join file the owner and
  the joiner under their traveller; an unclaimed pre-existing member is adopted on a correct
  PIN; a second device cannot take it over; a wrong PIN is refused and claims nothing.
- **10/10 checks** over real HTTP against the dev server for the read-only plan board: a live
  trip keeps Add, the live chip, the drag hint and its items; an over trip shows the
  read-only badge, the read-only subtitle, its items, and none of the write affordances.
- `npm run typecheck`, `npm run lint` and `npm run build` are clean.

### Quirks to remember
- The harness for that last pass failed 6 checks before it passed 10, and the app was innocent
  every time: the helper that mints a cookie is `async`, so `cookie: \`tc_session=${cookie}\``
  silently sent the string `[object Promise]` and every session was correctly refused. Await
  the token before putting it in a header.
- Embedding `trips` from `members` must name the foreign key
  (`trips!members_trip_id_fkey(*)`). PostgREST refuses the embed outright with "more than
  one relationship was found for 'members' and 'trips'" because of `owner_member_id`.
- `ensureTraveller()` is called inside the create and join actions before the service call,
  so the trip is filed under the traveller from the first insert and there is nothing to
  claim afterwards. It writes cookies, so it cannot be called outside a request.
- A traveller with no claimed members is possible and legitimate (a join that failed, or a
  trip the owner already deleted); `/trips` shows the empty state rather than an error.
- The dashboard's per-trip counts come from full row reads of the child tables, not `count`
  queries, because Supabase has no `in` + `count` combination in one call. Fine for friend
  groups, worth revisiting if a trip ever holds thousands of expenses.
- Every partial-column insert still needs `defaultToNull: false` (see P1).

## Deferred
- Nothing from P0 to P3. Still to do: transferring ownership, letting the owner leave, and
  password-recovery-by-owner is only a PIN reset (no trip-admin takeover).
- Cross-day dragging: items move days through the edit form's day picker, not by dragging a
  row onto another chip.
- A trip longer than 30 days cannot be planned past day 30 (see `MAX_TRIP_DAYS`).
- A traveller account cannot be recovered: there is no email, so a device that is forgotten
  is a new traveller. Its unclaimed memberships can still be re-claimed by entering the PIN
  once; the ones another device already claimed stay with that device. This is a deliberate
  trade-off, not an oversight.

## Known bugs
- Dev-only hydration warning on `<html data-scribe-recorder-ready>` injected by the Next 16
  dev overlay. Not present in the production build.

## Next: P4 — the real Map tab (pins by location_type, day filter chips, a day's polyline,
Nominatim search behind a server proxy that can add the result as a candidate place or drop
it straight into a day).
