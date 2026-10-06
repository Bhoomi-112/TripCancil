/**
 * Live checks for P10: the photobooth screen renders for a signed-in member
 * and leaks nothing. Run with the dev server up:
 *
 *   NODE_OPTIONS=--conditions=react-server npx tsx scripts/verify-booth.mts
 *
 * The canvas itself is covered by `scripts/test-booth.mts`; this script only
 * proves the page wires the engine to the right trip.
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/db/types";

const SEED_TRIP = "11111111-1111-4111-8111-111111111111";
const OTHER_TRIP = "aaaaaaaa-9999-4999-8999-999999999999";
const OWNER = "22222222-2222-4222-8222-222222222201";
const BASE = process.env.BASE_URL ?? "http://localhost:3000";

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    try {
      process.loadEnvFile(file);
    } catch {
      continue;
    }
  }
}

loadEnv();

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error("Missing Supabase env");

const db = createClient<Database>(url, serviceKey, {
  auth: { persistSession: false },
});

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    passed += 1;
    console.log(`  ok   ${name}`);
  } else {
    failed += 1;
    failures.push(name);
    console.log(`  FAIL ${name}${detail ? ` -> ${detail}` : ""}`);
  }
}

const { data: trip } = await db
  .from("trips")
  .select("*")
  .eq("id", SEED_TRIP)
  .single();
if (!trip) throw new Error("Seed trip missing — run scripts/seed.ts");

const { formatTripDates } = await import("../src/lib/constants");
const { signSession } = await import("../src/lib/auth/session");

const cookie = async (tripId: string, memberId: string) =>
  `tc_session=${await signSession({ memberId, tripId })}`;

const signedOut = await fetch(`${BASE}/photos`, { redirect: "manual" });
check("a visitor is bounced off /photos", signedOut.status === 307, String(signedOut.status));
check(
  "…towards the invite screen",
  signedOut.headers.get("location") === "/join",
  signedOut.headers.get("location") ?? "none",
);

const wrongTrip = await fetch(`${BASE}/photos`, {
  redirect: "manual",
  headers: { cookie: await cookie(OTHER_TRIP, OWNER) },
});
check("a session pointed at another trip is refused", wrongTrip.status === 307, String(wrongTrip.status));

const res = await fetch(`${BASE}/photos`, {
  headers: { cookie: await cookie(SEED_TRIP, OWNER) },
});
check("a member reaches /photos", res.status === 200, String(res.status));
const html = await res.text();

check("the screen is titled Photos", html.includes("Photos"));
check("the booth window is open", html.includes("booth.studio"));
check("the canvas badge is on the chrome", html.includes("canvas"));
check("all four layouts are offered", ["Single", "2×2", "Strip", "Polaroid"].every(
  (label) => html.includes(label),
));
check("the strip layout carries its hint", html.includes("The classic four down"));
check("the export button is there", html.includes("Download PNG"));
check(
  "the export starts disabled until photos arrive",
  /<button[^>]*disabled[^>]*>\s*(?:<svg[\s\S]*?<\/svg>\s*)*Download PNG/.test(html),
);
check("the drag hint is shown", html.includes("Tap a photo or a sticker"));
check("the empty frames say so", html.includes("Add photos to fill the frames"));
check("the file picker accepts images", html.includes('accept="image/*"') && html.includes("multiple"));
check("all eight stickers are on the sheet", (html.match(/aria-label="Add [A-Za-z]+ sticker"/g) ?? []).length === 8);
check("captions are pre-filled with the trip name", html.includes(`value="${trip.name}"`));
check("captions are pre-filled with the destination", html.includes(`value="${trip.destination}"`));
check(
  "captions are pre-filled with the trip dates",
  html.includes(`value="${formatTripDates(trip.start_date, trip.end_date)}"`),
);
check("no PIN hash reaches the page", !html.includes("pin_hash") && !html.includes("$2b$"));
check("no session cookie is echoed back", !html.includes("tc_session="));

const photosBefore = await db
  .from("photos")
  .select("id", { count: "exact", head: true })
  .eq("trip_id", SEED_TRIP);

const second = await fetch(`${BASE}/photos`, {
  headers: { cookie: await cookie(SEED_TRIP, OWNER) },
});
await second.text();
const photosAfter = await db
  .from("photos")
  .select("id", { count: "exact", head: true })
  .eq("trip_id", SEED_TRIP);
check(
  "the booth writes nothing to the trip",
  (photosBefore.count ?? 0) === (photosAfter.count ?? 0),
  `${photosBefore.count} -> ${photosAfter.count}`,
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log(`failures: ${failures.join(", ")}`);
  process.exit(1);
}
