/**
 * Live checks for group voting. Run with the dev server up:
 *
 *   NODE_OPTIONS=--conditions=react-server npx tsx scripts/verify-votes.mts
 *
 * Everything it creates it deletes again; the seeded trip is only ever read.
 */
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import type { Database } from "../src/lib/db/types";

const SEED_TRIP = "11111111-1111-4111-8111-111111111111";
const OTHER_TRIP = "aaaaaaaa-9999-4999-8999-999999999999";
const BHOOMI = "22222222-2222-4222-8222-222222222201";
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

const equal = (actual: unknown, expected: unknown) =>
  JSON.stringify(actual) === JSON.stringify(expected);

/**
 * React splits adjacent text nodes with `<!-- -->` in server-rendered HTML, so
 * "6 votes cast" arrives as `6<!-- --> votes<!-- --> cast`. Strip the comments
 * before asserting on anything a human would read.
 */
function text(html: string): string {
  return html.replace(/<!--.*?-->/g, "").replace(/\s+/g, " ");
}

// ------------------------------------------------------------------- pure

const {
  buildMapPayload,
  tallyVotes,
  sortBallot,
  myVoteFor,
  nameOf,
  votersInNameOrder,
  totalVotesCast,
  isPlacesKey,
} = await import("../src/lib/maps/places");

const tally = tallyVotes([
  { member_id: "b", value: 1 },
  { member_id: "a", value: 1 },
  { member_id: "c", value: -1 },
]);
check("one vote each way is counted", tally.up === 2 && tally.down === 1, JSON.stringify(tally));
check("score is up minus down", tally.score === 1, String(tally.score));
check(
  "votes are held in member id order so polls are stable",
  equal(tally.byMember.map((v) => v.memberId), ["a", "b", "c"]),
  JSON.stringify(tally.byMember.map((v) => v.memberId)),
);
check("a place nobody voted on has a zero tally", tallyVotes([]).score === 0);
check(
  "a value outside -1/1 is dropped rather than counted",
  tallyVotes([
    { member_id: "a", value: 1 },
    { member_id: "b", value: 7 },
  ]).byMember.length === 1,
);
check(
  "a zero is not a vote either",
  tallyVotes([{ member_id: "a", value: 0 }]).byMember.length === 0,
);

function place(over: Partial<Parameters<typeof buildMapPayload>[0]["places"][number]>) {
  return {
    id: "x",
    name: "Somewhere",
    lat: 1,
    lng: 2,
    category: null,
    location_type: null,
    status: "proposed" as const,
    proposed_by: null,
    place_votes: [],
    ...over,
  };
}

/** Raw select rows in, ranked payload places out: the sort is tested on what
 *  the app actually holds, not on a hand-made stand-in. */
function rank(rows: Parameters<typeof buildMapPayload>[0]["places"]) {
  return sortBallot(buildMapPayload({ places: rows, items: [], members: [] }).places);
}

const ranked = rank([
  place({ id: "p1", name: "Tie B", place_votes: [{ member_id: "a", value: 1 }] }),
  place({
    id: "p2",
    name: "Winner",
    place_votes: [
      { member_id: "a", value: 1 },
      { member_id: "b", value: 1 },
    ],
  }),
  place({ id: "p3", name: "Tie A", place_votes: [{ member_id: "a", value: 1 }] }),
  place({ id: "p4", name: "Loser", place_votes: [{ member_id: "a", value: -1 }] }),
]);
check(
  "score first, then the name and not the id for a tie",
  equal(ranked.map((p) => p.id), ["p2", "p3", "p1", "p4"]),
  JSON.stringify(ranked.map((p) => p.id)),
);
check(
  "more ups beats fewer when scores are level",
  equal(
    rank([
      place({ id: "x", name: "A", place_votes: [{ member_id: "a", value: 1 }] }),
      place({
        id: "y",
        name: "B",
        place_votes: [
          { member_id: "a", value: 1 },
          { member_id: "b", value: -1 },
          { member_id: "c", value: -1 },
        ],
      }),
    ]).map((p) => p.id),
    ["x", "y"],
  ),
);
check(
  "an unvoted place still sorts by name",
  equal(
    rank([
      place({ id: "n1", name: "Zebra" }),
      place({ id: "n2", name: "Aardvark" }),
    ]).map((p) => p.id),
    ["n2", "n1"],
  ),
);

const payload = buildMapPayload({
  places: [
    place({
      id: "p1",
      name: "Nagardhan",
      proposed_by: "m2",
      place_votes: [
        { member_id: "m2", value: 1 },
        { member_id: "m3", value: -1 },
      ],
    }),
  ],
  items: [],
  members: [
    { id: "m3", display_name: "Sana" },
    { id: "m1", display_name: "Bhoomi" },
    { id: "m2", display_name: "Ravi" },
  ],
});
check("the payload carries members by name", equal(payload.members.map((m) => m.displayName), ["Bhoomi", "Ravi", "Sana"]), JSON.stringify(payload.members));
check("a place keeps who proposed it", payload.places[0].proposedBy === "m2");
check("a place keeps its tally", payload.places[0].votes.score === 0);
check("a name resolves", nameOf(payload.members, "m3") === "Sana");
check("an unknown id has no name", nameOf(payload.members, "nobody") === null);
check("a null id has no name", nameOf(payload.members, null) === null);
check("the viewer finds their own vote", myVoteFor(payload.places[0], "m2") === 1);
check("and knows when they have not voted", myVoteFor(payload.places[0], "m1") === null);
check(
  "voters read ups first, then by name",
  equal(
    votersInNameOrder(payload.places[0], payload.members).map((v) => `${v.name}:${v.value}`),
    ["Ravi:1", "Sana:-1"],
  ),
  JSON.stringify(votersInNameOrder(payload.places[0], payload.members)),
);
check("an unlinked voter still gets a row", votersInNameOrder(payload.places[0], []).length === 2);
check("total votes cast adds up", totalVotesCast(payload) === 2, String(totalVotesCast(payload)));
check("the polling key is recognised", isPlacesKey("/api/trips/x/places"));
check("the money route is not the places key", !isPlacesKey("/api/trips/x/money"));

// ------------------------------------------------------------ live fixtures

// An earlier run that died mid-way leaves its fixtures behind, and the cleanup
// at the end never reached them. Start from a known-empty slate.
const { data: stale } = await db.from("trips").select("id").ilike("name", "verify-votes-%");
for (const row of stale ?? []) {
  await db.from("trips").delete().eq("id", row.id);
}

async function makeTrip(name: string, daysAgo: number, daysLong: number, people = 3) {
  const start = new Date(Date.now() - daysAgo * 86400000);
  const end = new Date(start.getTime() + (daysLong - 1) * 86400000);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const { data: trip, error } = await db
    .from("trips")
    .insert({
      name,
      destination: "Konkan",
      start_date: iso(start),
      end_date: iso(end),
      invite_code: `VOT${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
    })
    .select("id")
    .single();
  if (error) throw error;

  const memberIds: string[] = [];
  for (let index = 0; index < people; index += 1) {
    const { data: row, error: memberError } = await db
      .from("members")
      .insert({
        trip_id: trip.id,
        display_name: `M${index}`,
        pin_hash: bcrypt.hashSync("123456", 10),
        role: index === 0 ? "owner" : "member",
      })
      .select("id")
      .single();
    if (memberError) throw memberError;
    memberIds.push(row.id);
  }
  await db.from("trips").update({ owner_member_id: memberIds[0] }).eq("id", trip.id);

  return {
    tripId: trip.id,
    memberIds,
    startDate: iso(start),
    endDate: iso(end),
    context: (viewerId: string) =>
      ({
        trip: {
          id: trip.id,
          name,
          start_date: iso(start),
          end_date: iso(end),
          // isOwner() checks this against the viewer's role, so the fake context
          // has to carry it exactly as a real session would.
          owner_member_id: memberIds[0],
        },
        member: {
          id: viewerId,
          role: viewerId === memberIds[0] ? "owner" : "member",
        },
      }) as never,
  };
}

async function propose(
  tripId: string,
  memberId: string,
  name: string,
  status: "proposed" | "locked" = "proposed",
) {
  const { data, error } = await db
    .from("places")
    .insert({
      trip_id: tripId,
      name,
      lat: 18.5,
      lng: 73.1,
      proposed_by: memberId,
      status,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

const live = await makeTrip("verify-votes-live", 1, 3);
const over = await makeTrip("verify-votes-over", 10, 2);
const other = await makeTrip("verify-votes-other", 1, 3);

const { readMapData, voteOnPlace, lockInPlace, proposePlace, MapError } =
  await import("../src/lib/maps/service");

const [owner, second, third] = live.memberIds;
const ownerCtx = live.context(owner);
const secondCtx = live.context(second);
const thirdCtx = live.context(third);

// ----------------------------------------------------------------- services

const beach = await propose(live.tripId, owner, "Treyashir Beach");

// The headline case: three people, three members, one vote each.
await voteOnPlace(ownerCtx, { placeId: beach, value: 1 });
await voteOnPlace(secondCtx, { placeId: beach, value: 1 });
await voteOnPlace(thirdCtx, { placeId: beach, value: -1 });

const { data: voteRows } = await db
  .from("place_votes")
  .select("member_id, value")
  .eq("place_id", beach);
check("three members leave three votes", voteRows?.length === 3, JSON.stringify(voteRows));
check(
  "each vote is in the name of the person who cast it",
  voteRows?.find((row) => row.member_id === third)?.value === -1,
  JSON.stringify(voteRows),
);

const livePayload = await readMapData(live.tripId);
const beachPlace = livePayload.places.find((p) => p.id === beach);
check("the payload tallies the votes", beachPlace?.votes.up === 2 && beachPlace?.votes.down === 1, JSON.stringify(beachPlace?.votes));
check("and scores them", beachPlace?.votes.score === 1, String(beachPlace?.votes.score));
check("the payload carries every voter", beachPlace?.votes.byMember.length === 3);
check("the payload carries the members who can be named", livePayload.members.length === 3, String(livePayload.members.length));
check("no pin hashes anywhere in the payload", !JSON.stringify(livePayload).includes("pin_hash"));
check("no invite code in the payload", !JSON.stringify(livePayload).includes("invite_code"));

// Changing your mind, and taking a vote back.
await voteOnPlace(thirdCtx, { placeId: beach, value: 1 });
const afterChange = await readMapData(live.tripId);
const changed = afterChange.places.find((p) => p.id === beach);
check("changing a vote replaces it", changed?.votes.up === 3 && changed?.votes.down === 0, JSON.stringify(changed?.votes));
check("and still leaves one row per member", changed?.votes.byMember.length === 3);

await voteOnPlace(thirdCtx, { placeId: beach, value: 1 });
const afterRetract = await readMapData(live.tripId);
const retracted = afterRetract.places.find((p) => p.id === beach);
check("voting the same way again takes the vote back", retracted?.votes.byMember.length === 2, JSON.stringify(retracted?.votes.byMember));
check("and the score drops with it", retracted?.votes.score === 2, String(retracted?.votes.score));

// A vote for somewhere that is not on this trip.
let foreignError = "";
try {
  await voteOnPlace(ownerCtx, { placeId: OTHER_TRIP, value: 1 });
} catch (error) {
  foreignError = error instanceof MapError ? error.message : String(error);
}
check("a place id from elsewhere is refused", foreignError.includes("not on this trip"), foreignError);

let nonsenseVote = "";
try {
  await voteOnPlace(ownerCtx, { placeId: beach, value: 0 as never });
} catch (error) {
  nonsenseVote = error instanceof MapError ? error.message : String(error);
}
check("zero is not a vote", nonsenseVote.includes("not a vote"), nonsenseVote);

let overVote = "";
try {
  await voteOnPlace(over.context(over.memberIds[0]), { placeId: await propose(over.tripId, over.memberIds[0], "Old pin"), value: 1 });
} catch (error) {
  overVote = error instanceof MapError ? error.message : String(error);
}
check("an over trip refuses new votes", overVote.includes("read-only"), overVote);

// A locked pin is settled: no more votes.
const settled = await propose(live.tripId, owner, "Koramana", "locked");
let lockedVote = "";
try {
  await voteOnPlace(ownerCtx, { placeId: settled, value: 1 });
} catch (error) {
  lockedVote = error instanceof MapError ? error.message : String(error);
}
check("a pin already in the plan takes no more votes", lockedVote.includes("already in the plan"), lockedVote);

// ---------------------------------------------------------------- lock-in

const hill = await propose(live.tripId, second, "Mangi-Tungi");
await voteOnPlace(ownerCtx, { placeId: hill, value: 1 });
await voteOnPlace(secondCtx, { placeId: hill, value: 1 });
await voteOnPlace(thirdCtx, { placeId: hill, value: 1 });

let memberLock = "";
try {
  await lockInPlace(secondCtx, { placeId: hill, dayIndex: 1 });
} catch (error) {
  memberLock = error instanceof MapError ? error.message : String(error);
}
check("a plain member cannot lock a winner in", memberLock.includes("owner"), memberLock);

const { data: nothingYet } = await db
  .from("itinerary_items")
  .select("id")
  .eq("place_id", hill);
check("and nothing was added to the plan", (nothingYet ?? []).length === 0);

await lockInPlace(ownerCtx, { placeId: hill, dayIndex: 1 });
const { data: lockedIn } = await db
  .from("itinerary_items")
  .select("id, day_index, title, position")
  .eq("place_id", hill);
check("the owner can", lockedIn?.length === 1, JSON.stringify(lockedIn));
check("the winner becomes a stop on the chosen day", lockedIn?.[0]?.day_index === 1, JSON.stringify(lockedIn?.[0]));
check("titled after the pin", lockedIn?.[0]?.title === "Mangi-Tungi");
check("and sits on that day in order", lockedIn?.[0]?.position === 0);

const { data: hillRow } = await db.from("places").select("status").eq("id", hill).single();
check("the pin is no longer a candidate", hillRow?.status === "locked");

let relock = "";
try {
  await lockInPlace(ownerCtx, { placeId: hill, dayIndex: 2 });
} catch (error) {
  relock = error instanceof MapError ? error.message : String(error);
}
check("locking the same pin twice is refused", relock.includes("already locked"), relock);

const secondDayPin = await propose(live.tripId, second, "Rajmachi");
let badDay = "";
try {
  await lockInPlace(ownerCtx, { placeId: secondDayPin, dayIndex: 9 });
} catch (error) {
  badDay = error instanceof MapError ? error.message : String(error);
}
check("a day outside the trip is refused", badDay.includes("outside this trip"), badDay);

await lockInPlace(ownerCtx, { placeId: secondDayPin, dayIndex: 0 });
let twice = "";
try {
  await lockInPlace(ownerCtx, { placeId: secondDayPin, dayIndex: 0 });
} catch (error) {
  twice = error instanceof MapError ? error.message : String(error);
}
check("a pin that is already a stop on that day is refused", twice.includes("already locked") || twice.includes("already a stop"), twice);

// The place from the map's own search flow still votes and locks like any other.
const viaSearch = await proposePlace(ownerCtx, {
  name: "Shirdi",
  lat: 19.234,
  lng: 74.544,
  locationType: "heritage",
});
await voteOnPlace(thirdCtx, { placeId: viaSearch, value: 1 });
check("a pin proposed through the map takes a vote", (await readMapData(live.tripId)).places.find((p) => p.id === viaSearch)?.votes.up === 1);

// Two trips at once: one trip's ballot must never leak into another's.
const foreignPlaceId = await propose(other.tripId, other.memberIds[0], "Foreign pin");
const otherPayload = await readMapData(other.tripId);
check("another trip's pin is invisible here", !(await readMapData(live.tripId)).places.some((p) => p.id === foreignPlaceId));
check("but its own trip reads it", otherPayload.places.some((p) => p.id === foreignPlaceId));
check("and its vote with it", totalVotesCast(otherPayload) === 0);
check(
  "the other trip reads its own members",
  equal(
    otherPayload.members.map((m) => m.id).sort(),
    [...other.memberIds].sort(),
  ),
  JSON.stringify(otherPayload.members.map((m) => m.id)),
);

const afterLock = await readMapData(live.tripId);
check("a locked pin reports its day", afterLock.places.find((p) => p.id === hill)?.days.includes(1) === true);
check("and is out of the candidate race", afterLock.places.filter((p) => p.status !== "locked").length === 2, String(afterLock.places.filter((p) => p.status !== "locked").length));
// Treyashir Beach is on 2 after the retraction, Shirdi on 1; Mangi-Tungi left
// the race when the owner locked it in.
check(
  "the ballot ranks by score",
  equal(sortBallot(afterLock.places.filter((p) => p.status !== "locked")).map((p) => p.votes.score), [2, 1]),
  JSON.stringify(sortBallot(afterLock.places.filter((p) => p.status !== "locked")).map((p) => [p.name, p.votes.score])),
);

// ------------------------------------------------------------- the seed

const seedPayload = await readMapData(SEED_TRIP);
check("the seeded map still reads", seedPayload.places.length === 6, String(seedPayload.places.length));
check("the seeded trip has four members", seedPayload.members.length === 4, String(seedPayload.members.length));
check("every seeded vote is counted", totalVotesCast(seedPayload) === 19, String(totalVotesCast(seedPayload)));
const nagardhan = seedPayload.places.find((p) => p.name === "Nagardhan viewpoint");
check("Nagardhan is two in, one out", nagardhan?.votes.up === 2 && nagardhan?.votes.down === 1, JSON.stringify(nagardhan?.votes));
const alibaug = seedPayload.places.find((p) => p.name === "Alibaug beach resort");
check("the resort Day 1 stops at is locked, not on the ballot", alibaug?.status === "locked", alibaug?.status);
check("so the seeded ballot is the two places still up for grabs", seedPayload.places.filter((p) => p.status !== "locked").map((p) => p.name).sort().join(", ") === "Karli Caves, Nagardhan viewpoint", seedPayload.places.filter((p) => p.status !== "locked").map((p) => p.name).join(", "));
check("every seeded voter is a seeded member", seedPayload.places.every((p) => p.votes.byMember.every((v) => seedPayload.members.some((m) => m.id === v.memberId))));
check("the seeded ballot ranks the viewpoint above the caves", sortBallot(seedPayload.places.filter((p) => p.status !== "locked"))[0]?.name === "Nagardhan viewpoint");

// -------------------------------------------------------------------- HTTP

const { signSession } = await import("../src/lib/auth/session");
async function cookie(tripId: string, memberId: string) {
  return `tc_session=${await signSession({ memberId, tripId })}`;
}

const ownerCookie = await cookie(live.tripId, owner);
const mapRes = await fetch(`${BASE}/map`, { headers: { cookie: ownerCookie }, redirect: "manual" });
const mapHtml = await mapRes.text();
check("the map page opens for a member", mapRes.status === 200, String(mapRes.status));
check("the ballot is on the page", mapHtml.includes("Ballot"), mapHtml.slice(0, 120));
// The owner locked Mangi-Tungi in, so it has left the race and the leader is
// now the best candidate still standing.
check("the leader is named", text(mapHtml).includes("Treyashir Beach is winning"), text(mapHtml).match(/[\w\s]+ is winning/)?.[0]);
check("a candidate is called a candidate", mapHtml.includes("Candidate"));
check("the owner gets the day picker", mapHtml.includes("Lock in"));
check("the footer counts the votes", /\d+ votes? cast/.test(text(mapHtml)), text(mapHtml).match(/[\d.]+ votes? cast/)?.[0]);
check("no pin hashes on the map", !mapHtml.includes("pin_hash") && !mapHtml.includes("$2b$"));

const memberCookie = await cookie(live.tripId, second);
const memberHtml = await (await fetch(`${BASE}/map`, { headers: { cookie: memberCookie }, redirect: "manual" })).text();
check("a plain member sees the ballot too", memberHtml.includes("Ballot"));
check("but no lock-in controls", !memberHtml.includes("Lock in"));

const overCookie = await cookie(over.tripId, over.memberIds[0]);
const overHtml = await (await fetch(`${BASE}/map`, { headers: { cookie: overCookie }, redirect: "manual" })).text();
check("an over trip still opens the map", overHtml.includes("Ballot"));
check("an over trip says the ballot is closed", overHtml.includes("ballot is closed"));
check("an over trip offers no votes", !overHtml.includes("Lock in"));

const seedCookie = await cookie(SEED_TRIP, BHOOMI);
const seedHtml = await (await fetch(`${BASE}/map`, { headers: { cookie: seedCookie }, redirect: "manual" })).text();
check("the seeded ballot renders", seedHtml.includes("Ballot") && seedHtml.includes("Nagardhan viewpoint"));
check("the seeded footer says nineteen votes", text(seedHtml).includes("19 votes cast"), text(seedHtml).match(/[\d.]+ votes? cast/)?.[0]);
check("the seeded owner can lock a winner in", seedHtml.includes("Lock in"));

const apiRes = await fetch(`${BASE}/api/trips/${live.tripId}/places`, { headers: { cookie: ownerCookie } });
const apiBody = await apiRes.json();
check("the places polling route answers", apiRes.status === 200, String(apiRes.status));
check("it now sends members", Array.isArray(apiBody.members) && apiBody.members.length === 3);
check("and votes inside every place", apiBody.places.every((p: { votes?: unknown }) => p.votes !== undefined));
check("it leaks nothing private", !JSON.stringify(apiBody).includes("pin_hash") && !JSON.stringify(apiBody).includes("invite_code"));
const wrongTrip = await fetch(`${BASE}/api/trips/${OTHER_TRIP}/places`, { headers: { cookie: ownerCookie } });
check("it refuses another trip", wrongTrip.status === 404, String(wrongTrip.status));
const signedOut = await fetch(`${BASE}/api/trips/${live.tripId}/places`);
check("it needs a session", signedOut.status === 401, String(signedOut.status));

const signedOutMap = await fetch(`${BASE}/map`, { redirect: "manual" });
check("the map sends a signed-out browser to the join screen", signedOutMap.status === 307 || signedOutMap.status === 302, String(signedOutMap.status));

// ----------------------------------------------------------------- cleanup

for (const fixture of [live.tripId, over.tripId, other.tripId]) {
  await db.from("trips").delete().eq("id", fixture);
}
const { data: left } = await db.from("trips").select("id").ilike("name", "verify-votes-%");
check("no verify-votes trips left behind", (left ?? []).length === 0, JSON.stringify(left));
const { data: seedPlaceIds } = await db
  .from("places")
  .select("id")
  .eq("trip_id", SEED_TRIP);
const { count: seededVoteCount } = await db
  .from("place_votes")
  .select("place_id", { count: "exact", head: true })
  .in("place_id", (seedPlaceIds ?? []).map((row) => row.id));
check("the seeded ballot is still nineteen votes", seededVoteCount === 19, String(seededVoteCount));

const { data: seededAlibaug } = await db
  .from("places")
  .select("status")
  .eq("trip_id", SEED_TRIP)
  .ilike("name", "Alibaug beach resort")
  .single();
check("and the resort is locked in the database too", seededAlibaug?.status === "locked", seededAlibaug?.status);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log(`failed: ${failures.join(", ")}`);
  process.exit(1);
}