<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# TripCancil

Responsive, multi-user web app for FRIEND GROUPS: plan a trip, track and split expenses, make themed photobooth images, relive it afterwards.

## Stack (do not substitute)
- Next.js App Router + TypeScript (strict) + Tailwind CSS
- Supabase used ONLY as Postgres + Storage. NO Supabase Auth, NO Realtime.
- Leaflet + OpenStreetMap (react-leaflet), Nominatim for place search
- Canvas API for photobooth (client-side)
- `qrcode` npm package, `jose` (JWT), `bcryptjs`, `zod`

## Auth model (security-critical, never weaken)
- No email, no OAuth. A trip has a high-entropy invite code (crypto.randomBytes, 10+ chars, rotatable by owner).
- Join = invite code + display name (unique within the trip) + 6-digit PIN.
- PIN stored only as bcrypt hash. Never log or return it.
- Session = signed JWT (jose) in an httpOnly, Secure, SameSite=Lax cookie containing member_id + trip_id. 14-day expiry.
- Login rate limiting: 5 failed PIN attempts per member => 15-minute lockout (stored in DB). Also throttle by IP.
- Owner can reset a member's PIN. Owner can remove a member.
- A `travelers` row is a person, not a login: no email, no password, nothing to guess. It exists so one person can hold memberships in several trips. `members.traveler_id` points at it (first claim wins, `traveler_id is null` predicate, never a silent handover).
- Device trust = signed `tc_traveller` cookie (traveller_id, 180 days, same flags as the session cookie). It is NOT a trip session: every trip screen still needs `tc_session`, and one-tap open re-checks the membership row for that traveller before minting one. Offer "Forget this device" wherever it is minted.
- Trip dates are `date`, so "is this trip over" is `end_date < todayUtcISO()` (UTC, `tripHasEnded`). Ended trips are read-only: gate every write, not just the ones that feel obvious.
- ALL database and storage access happens in server code (route handlers / server actions) using the Supabase service-role key. The service-role key must never reach the browser.
- Enable RLS on every table with NO policies (deny-all to anon key). The anon key is not used for data.
- Every server handler must: verify session, verify membership in the trip being accessed, validate input with zod. No exceptions.
- Private files (documents, payment QRs, receipts) live in private buckets and are served only via short-lived signed URLs created after a membership check.
- Public recap page exposes ONLY: trip name/dates, places, photos marked public, aggregate stats. Never documents, balances, QRs, or member PINs.
- Live updates: poll with SWR (refetch every 5s on active screens). No websockets.
- Secrets only in .env.local; keep .env.example updated; .env.local in .gitignore.

## Design: retro Y2K, fully custom
- Hand-build every component. No shadcn, MUI, Chakra, or default UI kits.
- Look: chrome/metallic gradients, glossy bubble buttons, faux window chrome (title bar with dots), sticker badges, sparkles/stars, dotted grids, soft iridescent gradients, light CRT touches.
- Fonts: a pixel font for headings, a rounded sans for body (Google Fonts via next/font).
- Palette as Tailwind tokens + CSS variables: electric blue, hot pink, lime accent, silver, warm cream background. Keep contrast readable.
- Mobile-first (design at 360px first). Bouncy press animations; respect prefers-reduced-motion.
- Playful SVG empty states and skeleton loaders.

## Data rules
- IDs are uuid. Money stored as integer paise (INR minor units), never floats.
- Timestamps timestamptz. Soft-delete expenses (keep audit trail).
- Location types enum: beach, mountain, city, forest, desert, heritage, snow, roadtrip.

## Workflow rules
- Work on ONE prompt's scope only. Do not build ahead.
- After finishing: run the app, fix errors, update PROGRESS.md (done / deferred / known bugs), then stop and summarise in under 10 lines.
- Make sensible decisions without asking; ask only if something is truly ambiguous or would force a rewrite.
- Small commits with clear messages. No dead code, no placeholder lorem ipsum in finished screens.
