/**
 * Live checks for P7: the budget. Run with the dev server up:
 *
 *   NODE_OPTIONS=--conditions=react-server npx tsx scripts/verify-budget.mts
 *
 * Everything it creates it deletes again; the seeded trip is only ever read.
 */
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import type { Database } from "../src/lib/db/types";

const SEED_TRIP = "11111111-1111-4111-8111-111111111111";
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

// ---------------------------------------------------------------- pure math

const { capsOf, budgetLines, budgetTotals, ratioPaise } = await import(
  "../src/lib/money/budget"
);

type P = Parameters<typeof budgetLines>[0];
const member = (id: string) => ({ id, displayName: id, role: "member" as const });
const expense = (
  id: string,
  amountPaise: number,
  category: Database["public"]["Enums"]["expense_category"] = "food",
  deleted = false,
) => ({
  id,
  trip_id: "t1",
  payer_id: "a",
  amount_paise: amountPaise,
  category,
  note: null,
  spent_on: "2026-10-02",
  receiptUrl: null,
  deleted_at: deleted ? "2026-10-03T00:00:00Z" : null,
  created_at: "2026-10-02T00:00:00Z",
});
const budgetRow = (totalPaise: number, categoryCaps: Record<string, unknown>) =>
  ({ trip_id: "t1", total_paise: totalPaise, category_caps: categoryCaps }) as never;

const ledger: P = {
  members: [member("a"), member("b")],
  expenses: [
    expense("e1", 45000, "food"),
    expense("e2", 12000, "food", true),
    expense("e3", 30000, "stay"),
  ],
  splits: [],
  settlements: [],
  budget: null,
};

const caps = capsOf(
  budgetRow(0, { food: 600000, stay: 800000, pizzas: 99999, negative: -1, floaty: 12.5 }),
);
check(
  "caps keep only recognised categories in canonical order",
  equal(caps, [
    { category: "food", capPaise: 600000 },
    { category: "stay", capPaise: 800000 },
  ]),
  JSON.stringify(caps),
);
check(
  "capsOf on no budget is empty",
  capsOf(null).length === 0,
);

const lines = budgetLines(ledger, budgetRow(0, { food: 600000, stay: 800000 }));
check(
  "budget lines carry the canonical order",
  equal(lines.map((l) => [l.category, l.capPaise, l.spentPaise]), [
    ["food", 600000, 45000],
    ["stay", 800000, 30000],
  ]),
  JSON.stringify(lines),
);
check(
  "soft-deleted expenses do not count toward a cap",
  lines.find((l) => l.category === "food")?.spentPaise === 45000,
);
check(
  "an under-cap line owes you headroom",
  lines.find((l) => l.category === "food")?.remainingPaise === 555000,
);
check(
  "a blown cap reports the over-run",
  equal(
    (() => {
      const foods = budgetLines(ledger, budgetRow(0, { food: 30000 }));
      const line = foods.find((l) => l.category === "food");
      return [line?.remainingPaise, line?.overPaise];
    })(),
    [-15000, 15000],
  ),
);

const totals = budgetTotals(ledger, budgetRow(300000, {}));
check(
  "totals pace spent against the ceiling",
  equal(
    [totals.totalPaise, totals.spentPaise, totals.remainingPaise, totals.overPaise],
    [300000, 75000, 225000, 0],
  ),
  JSON.stringify(totals),
);
const overTotals = budgetTotals(ledger, budgetRow(60000, {}));
check(
  "an over-run budget reports how much over",
  equal(
    [overTotals.remainingPaise, overTotals.overPaise],
    [-15000, 15000],
  ),
  JSON.stringify(overTotals),
);
check("a zero total does not blow up the ratio", ratioPaise(5000, 0) === 0);
check("the ratio clamps below zero", ratioPaise(-1, 100) === 0);
check("the ratio clamps above one", ratioPaise(200, 100) === 1);
check("the ratio is a plain fraction", ratioPaise(45000, 600000) === 0.075);

// ------------------------------------------------------------ live fixtures

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
      invite_code: `BUG${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
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
        display_name: `B${index}`,
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
        },
        member: {
          id: viewerId,
          role: viewerId === memberIds[0] ? "owner" : "member",
        },
      }) as never,
  };
}

const live = await makeTrip("verify-budget-live", 1, 3);
const over = await makeTrip("verify-budget-over", 10, 2);
const other = await makeTrip("verify-budget-other", 1, 3);

const { readMoney, createExpense, setBudget, MoneyError } = await import(
  "../src/lib/money/service"
);

const [owner, second] = live.memberIds;
const ownerCtx = live.context(owner);
const secondCtx = live.context(second);

const fresh = await readMoney(live.tripId);
check("a fresh trip has no budget row", fresh.budget === null);

await setBudget(ownerCtx, { totalPaise: 2000000, caps: { food: 600000, stay: 800000 } });
let read = await readMoney(live.tripId);
check("the budget round-trips", read.budget?.total_paise === 2000000, JSON.stringify(read.budget));
check(
  "both caps survive, in order",
  equal(
    read.budget ? capsOf(read.budget) : null,
    [
      { category: "food", capPaise: 600000 },
      { category: "stay", capPaise: 800000 },
    ],
  ),
  JSON.stringify(read.budget?.category_caps),
);

await createExpense(ownerCtx, {
  amountPaise: 45000,
  category: "food",
  note: "Chai and snacks",
  spentOn: live.startDate,
  payerId: owner,
  splitWith: [],
});
read = await readMoney(live.tripId);
const foodLine = budgetLines(read, read.budget).find((l) => l.category === "food");
check(
  "the ledger feeds the budget bar",
  foodLine?.spentPaise === 45000 && foodLine?.remainingPaise === 555000,
  JSON.stringify(foodLine),
);

let negativeTotal = "";
try {
  await setBudget(ownerCtx, { totalPaise: -50, caps: {} });
} catch (error) {
  negativeTotal = error instanceof MoneyError ? error.message : String(error);
}
check("a negative total is refused", negativeTotal.length > 0, negativeTotal);

let negativeCap = "";
try {
  await setBudget(ownerCtx, { totalPaise: 1000, caps: { food: -1 } });
} catch (error) {
  negativeCap = error instanceof MoneyError ? error.message : String(error);
}
check("a negative cap is refused", negativeCap.length > 0, negativeCap);

await setBudget(ownerCtx, {
  totalPaise: 60000,
  caps: { food: 30000, other: 0 },
});
read = await readMoney(live.tripId);
check(
  "a second save replaces the old caps, and a zero cap means no cap",
  equal(read.budget ? capsOf(read.budget) : null, [{ category: "food", capPaise: 30000 }]),
  JSON.stringify(read.budget?.category_caps),
);
const overLine = budgetLines(read, read.budget).find((l) => l.category === "food");
const bigTotals = budgetTotals(read, read.budget);
check(
  "a blown category cap reports the over-run",
  overLine?.overPaise === 15000 && overLine?.remainingPaise === -15000,
  JSON.stringify(overLine),
);
check(
  "the ceiling itself is still fine",
  bigTotals.overPaise === 0 && bigTotals.remainingPaise === 15000,
  JSON.stringify(bigTotals),
);

await setBudget(secondCtx, {
  totalPaise: 1500000,
  caps: { food: 100000, stay: 0, pizzas: 99999 } as never,
});
read = await readMoney(live.tripId);
check(
  "any member can set the budget",
  read.budget?.total_paise === 1500000,
  JSON.stringify(read.budget?.total_paise),
);
check(
  "unknown category keys are scrubbed before storage",
  equal(read.budget?.category_caps, { food: 100000 }),
  JSON.stringify(read.budget?.category_caps),
);
check(
  "zero caps are stored as no caps",
  capsOf(read.budget).length === 1,
  JSON.stringify(capsOf(read.budget)),
);

const otherRead = await readMoney(other.tripId);
check("another trip stays unbudgeted", otherRead.budget === null);

let endedBudget = "";
try {
  await setBudget(over.context(over.memberIds[0]), {
    totalPaise: 5000,
    caps: {},
  });
} catch (error) {
  endedBudget = error instanceof MoneyError ? error.message : String(error);
}
check("an over trip refuses a new budget", endedBudget.includes("read-only"), endedBudget);

const seedPayload = await readMoney(SEED_TRIP);
check(
  "the seeded trip's budget is intact or absent, never garbage",
  seedPayload.budget === null || typeof seedPayload.budget.total_paise === "number",
  JSON.stringify(seedPayload.budget),
);

console.log(`\n${passed} passed, ${failed} failed`);

// -------------------------------------------------------------------- HTTP

const { signSession } = await import("../src/lib/auth/session");
async function cookie(tripId: string, memberId: string) {
  return `tc_session=${await signSession({ memberId, tripId })}`;
}

const liveCookie = await cookie(live.tripId, owner);
const moneyRes = await fetch(`${BASE}/money`, {
  headers: { cookie: liveCookie },
  redirect: "manual",
});
const moneyHtml = await moneyRes.text();
check("the money page opens for a member", moneyRes.status === 200, String(moneyRes.status));
check("the budget window is on the money tab", moneyHtml.includes("The budget"));
check("the ceiling is rendered", moneyHtml.includes("₹15,000.00"), moneyHtml.match(/₹[\d,.]+/g)?.slice(0, 4).join(" "));
check("the remaining reads off the ledger", moneyHtml.includes("₹14,550.00"));
check("capped categories get bars", moneyHtml.includes("Category caps"));
check("the category is named", moneyHtml.includes("Food &amp; chai"));
check("no PIN hashes in the money page", !moneyHtml.includes("pin_hash") && !moneyHtml.includes("$2b$"));

const otherCookie = await cookie(other.tripId, other.memberIds[0]);
const otherRes = await fetch(`${BASE}/money`, { headers: { cookie: otherCookie }, redirect: "manual" });
const otherHtml = await otherRes.text();
check("an unbudgeted trip offers the empty state", otherHtml.includes("No budget yet"));

const overCookie = await cookie(over.tripId, over.memberIds[0]);
const overRes = await fetch(`${BASE}/money`, { headers: { cookie: overCookie }, redirect: "manual" });
const overHtml = await overRes.text();
check(
  "a read-only trip says plainly there is no budget to manage",
  overHtml.includes("This trip never set a budget"),
);

const apiRes = await fetch(`${BASE}/api/trips/${live.tripId}/money`, {
  headers: { cookie: liveCookie },
});
const apiBody = await apiRes.json();
check("the money polling route answers", apiRes.status === 200, String(apiRes.status));
check("it sends the budget row", apiBody.budget?.total_paise === 1500000, JSON.stringify(apiBody.budget));
check(
  "it leaks nothing private",
  !JSON.stringify(apiBody).includes("pin_hash") && !JSON.stringify(apiBody).includes("invite_code"),
);

// ----------------------------------------------------------------- cleanup

for (const fixture of [live.tripId, over.tripId, other.tripId]) {
  await db.from("trips").delete().eq("id", fixture);
}
const { data: left } = await db.from("trips").select("id").ilike("name", "verify-budget-%");
check("no verify-budget trips left behind", (left ?? []).length === 0, JSON.stringify(left));
const { data: seedBudgets } = await db.from("budgets").select("trip_id").eq("trip_id", SEED_TRIP);
check("the seeded budget is untouched", (seedBudgets ?? []).length <= 1, String(seedBudgets?.length));

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log(`failed: ${failures.join(", ")}`);
  process.exit(1);
}