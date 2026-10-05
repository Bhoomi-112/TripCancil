/**
 * Live checks for P5: the money ledger. Run with the dev server up:
 *
 *   NODE_OPTIONS=--conditions=react-server npx tsx scripts/verify-money.mts
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

const { parsePaise, formatPaise, formatPaiseShort, splitEqually } =
  await import("../src/lib/money/paise");
const {
  computeBalances,
  simplifyDebts,
  totalSpent,
  totalByCategory,
  isMoneyKey,
} = await import("../src/lib/money/balances");

// ------------------------------------------------------------------- paise

check("plain rupees become paise", parsePaise("1200") === 120000);
check("commas are ignored", parsePaise("1,20,000") === 12000000);
check("a rupee sign is ignored", parsePaise("₹ 99") === 9900);
check("one decimal means one zero paise", parsePaise("1200.5") === 120050);
check("two decimals are kept", parsePaise("1200.55") === 120055);
check("empty text is not money", parsePaise("") === null);
check("letters are not money", parsePaise("chai") === null);
check("three decimals is not money", parsePaise("12.345") === null);
check("zero is not an expense", parsePaise("0") === null);
check("a negative amount is not an expense", parsePaise("-50") === null);

check("paise print with two decimals", formatPaise(123456) === "₹1,234.56");
check("paise under a rupee keep the zero", formatPaise(5) === "₹0.05");
check("negative money keeps its sign", formatPaise(-5000) === "-₹50.00");
check("zero is ₹0.00", formatPaise(0) === "₹0.00");
check("short form switches to k above ten thousand", formatPaiseShort(1234500) === "₹12.3k");
check("short form stays exact under it", formatPaiseShort(123450) === "₹1,235");

const thirds = splitEqually(10000, ["c", "a", "b"]);
check(
  "an uneven split still adds up to the amount",
  [...thirds.values()].reduce((a, b) => a + b, 0) === 10000,
  JSON.stringify([...thirds.entries()]),
);
check("the leftover paisa goes to one person", Math.max(...thirds.values()) - Math.min(...thirds.values()) === 1);
check("the leftover is not random", thirds.get("a") === 3334, JSON.stringify([...thirds.entries()]));
check("one sharer pays it all", splitEqually(999, ["a"]).get("a") === 999);
check("nobody to split with means nothing", splitEqually(999, []).size === 0);

// --------------------------------------------------------------- balances

type P = Parameters<typeof computeBalances>[0];
const member = (id: string, name: string, role: "owner" | "member" = "member") => ({
  id,
  displayName: name,
  role,
});
const expense = (
  id: string,
  payerId: string,
  amountPaise: number,
  category: Database["public"]["Enums"]["expense_category"] = "food",
  deleted = false,
) => ({
  id,
  trip_id: SEED_TRIP,
  payer_id: payerId,
  amount_paise: amountPaise,
  category,
  note: null,
  spent_on: "2026-10-02",
  receipt_path: null,
  deleted_at: deleted ? "2026-10-03T00:00:00Z" : null,
  created_at: "2026-10-02T00:00:00Z",
});

const trio: P = {
  members: [member("a", "A"), member("b", "B"), member("c", "C")],
  expenses: [expense("e1", "a", 3000)],
  splits: [
    { expense_id: "e1", member_id: "a", share_paise: 1000 },
    { expense_id: "e1", member_id: "b", share_paise: 1000 },
    { expense_id: "e1", member_id: "c", share_paise: 1000 },
  ],
  settlements: [],
};

const trioNets = computeBalances(trio).map((entry) => [entry.memberId, entry.netPaise]);
check(
  "the payer of an equal split is owed the other two thirds",
  equal(trioNets, [
    ["a", 2000],
    ["b", -1000],
    ["c", -1000],
  ]),
  JSON.stringify(trioNets),
);
check("balances always sum to zero", trioNets.reduce((sum, [, value]) => sum + (value as number), 0) === 0);
check(
  "one expense needs two payments to clear",
  equal(
    simplifyDebts(computeBalances(trio)).map((t) => [t.fromMemberId, t.toMemberId, t.amountPaise]),
    [
      ["b", "a", 1000],
      ["c", "a", 1000],
    ],
  ),
  JSON.stringify(simplifyDebts(computeBalances(trio))),
);

const settled: P = {
  ...trio,
  settlements: [
    {
      id: "s1",
      trip_id: SEED_TRIP,
      from_member: "b",
      to_member: "a",
      amount_paise: 1000,
      status: "paid",
      created_at: "2026-10-02T00:00:00Z",
    },
  ],
};
check(
  "a paid settlement moves the balance",
  equal(
    computeBalances(settled).map((entry) => [entry.memberId, entry.netPaise]),
    [
      ["a", 1000],
      ["b", 0],
      ["c", -1000],
    ],
  ),
  JSON.stringify(computeBalances(settled).map((e) => [e.memberId, e.netPaise])),
);
check(
  "a promised payment moves nothing",
  computeBalances({ ...settled, settlements: [{ ...settled.settlements[0], status: "pending" }] }).reduce(
    (sum, entry) => sum + entry.netPaise,
    0,
  ) === 0 &&
    computeBalances({ ...settled, settlements: [{ ...settled.settlements[0], status: "pending" }] })[0].netPaise === 2000,
);

const withDeleted: P = { ...trio, expenses: [expense("e1", "a", 3000), expense("e2", "b", 900, "food", true)] };
check("a soft-deleted expense leaves the balances", totalSpent(withDeleted) === 3000);
check("a soft-deleted expense is still listed for the audit trail", withDeleted.expenses.length === 2);
check(
  "category totals add up to the total",
  totalByCategory(withDeleted).reduce((sum, entry) => sum + entry.paise, 0) === 3000,
);

const six: P = {
  members: ["a", "b", "c", "d", "e", "f"].map((id) => member(id, id.toUpperCase())),
  expenses: [
    expense("x1", "a", 1000),
    expense("x2", "b", 2500),
    expense("x3", "c", 1750),
  ],
  splits: [
    { expense_id: "x1", member_id: "a", share_paise: 200 },
    { expense_id: "x1", member_id: "b", share_paise: 200 },
    { expense_id: "x1", member_id: "c", share_paise: 200 },
    { expense_id: "x1", member_id: "d", share_paise: 200 },
    { expense_id: "x1", member_id: "e", share_paise: 100 },
    { expense_id: "x1", member_id: "f", share_paise: 100 },
    { expense_id: "x2", member_id: "a", share_paise: 500 },
    { expense_id: "x2", member_id: "b", share_paise: 500 },
    { expense_id: "x2", member_id: "c", share_paise: 500 },
    { expense_id: "x2", member_id: "d", share_paise: 500 },
    { expense_id: "x2", member_id: "e", share_paise: 250 },
    { expense_id: "x2", member_id: "f", share_paise: 250 },
    { expense_id: "x3", member_id: "a", share_paise: 400 },
    { expense_id: "x3", member_id: "b", share_paise: 400 },
    { expense_id: "x3", member_id: "c", share_paise: 400 },
    { expense_id: "x3", member_id: "d", share_paise: 300 },
    { expense_id: "x3", member_id: "e", share_paise: 125 },
    { expense_id: "x3", member_id: "f", share_paise: 125 },
  ],
  settlements: [],
};
const sixBalances = computeBalances(six);
const sixTransfers = simplifyDebts(sixBalances);
check(
  "six people settle up in fewer than fifteen payments",
  sixTransfers.length > 0 && sixTransfers.length <= 5,
  `${sixTransfers.length} transfers`,
);
const afterPaying = new Map(sixBalances.map((entry) => [entry.memberId, entry.netPaise]));
for (const transfer of sixTransfers) {
  afterPaying.set(
    transfer.fromMemberId,
    (afterPaying.get(transfer.fromMemberId) ?? 0) + transfer.amountPaise,
  );
  afterPaying.set(
    transfer.toMemberId,
    (afterPaying.get(transfer.toMemberId) ?? 0) - transfer.amountPaise,
  );
}
check(
  "the suggested payments leave nobody owing anything",
  [...afterPaying.values()].every((net) => net === 0),
  JSON.stringify([...afterPaying.entries()]),
);
check("the polling key is recognised", isMoneyKey("/api/trips/x/money"));
check("the plan route is not the money key", !isMoneyKey("/api/trips/x/itinerary"));

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
      invite_code: `MON${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
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
        },
        member: {
          id: viewerId,
          role: viewerId === memberIds[0] ? "owner" : "member",
        },
      }) as never,
  };
}

const live = await makeTrip("verify-money-live", 1, 3);
const over = await makeTrip("verify-money-over", 10, 2);
const other = await makeTrip("verify-money-other", 1, 3);

const { readMoney, createExpense, updateExpense, softDeleteExpense, createSettlement, setSettlementStatus, MoneyError } =
  await import("../src/lib/money/service");

const [owner, second, third] = live.memberIds;
const ownerCtx = live.context(owner);
const secondCtx = live.context(second);

const chaiId = await createExpense(ownerCtx, {
  amountPaise: 30000,
  category: "food",
  note: "Evening chai",
  spentOn: live.startDate,
  payerId: owner,
  // The payer is left out on purpose: paying for yourself is implied.
  splitWith: [second, third],
});
check("logging an expense returns its id", typeof chaiId === "string" && chaiId.length > 0);

const { data: chaiSplits } = await db
  .from("expense_splits")
  .select("member_id, share_paise")
  .eq("expense_id", chaiId);
check("the payer is added to their own split", chaiSplits?.length === 3, JSON.stringify(chaiSplits));
check(
  "the shares add up to the amount",
  chaiSplits?.reduce((sum, row) => sum + row.share_paise, 0) === 30000,
);
check("the payer's share is one third", chaiSplits?.find((row) => row.member_id === owner)?.share_paise === 10000);

let outsiderError = "";
try {
  await createExpense(ownerCtx, {
    amountPaise: 100,
    category: "food",
    spentOn: live.startDate,
    payerId: OTHER_TRIP === live.tripId ? owner : BHOOMI,
    splitWith: [],
  });
} catch (error) {
  outsiderError = error instanceof MoneyError ? error.message : String(error);
}
check("a payer from another trip is refused", outsiderError.includes("not in this trip"), outsiderError);

let splitOutsiderError = "";
try {
  await createExpense(ownerCtx, {
    amountPaise: 100,
    category: "food",
    spentOn: live.startDate,
    payerId: owner,
    splitWith: [BHOOMI],
  });
} catch (error) {
  splitOutsiderError = error instanceof MoneyError ? error.message : String(error);
}
check("someone outside the trip cannot be in the split", splitOutsiderError.includes("not in this trip"), splitOutsiderError);

let dateError = "";
try {
  await createExpense(ownerCtx, {
    amountPaise: 100,
    category: "food",
    spentOn: "2020-01-01",
    payerId: owner,
    splitWith: [],
  });
} catch (error) {
  dateError = error instanceof MoneyError ? error.message : String(error);
}
check("a date outside the trip is refused", dateError.includes("outside the trip"), dateError);

await updateExpense(ownerCtx, chaiId, {
  amountPaise: 45000,
  category: "stay",
  note: "Two nights",
  spentOn: live.startDate,
  payerId: second,
  splitWith: [third],
});
const { data: updatedSplits } = await db
  .from("expense_splits")
  .select("member_id, share_paise")
  .eq("expense_id", chaiId);
check("editing replaces the split, not adds to it", updatedSplits?.length === 2, JSON.stringify(updatedSplits));
check(
  "the edited shares still add up",
  updatedSplits?.reduce((sum, row) => sum + row.share_paise, 0) === 45000,
);

const livePayload = await readMoney(live.tripId);
check("the ledger reads its own trip", livePayload.members.length === 3);
check("the ledger reads its expenses", livePayload.expenses.some((row) => row.id === chaiId));
check("the edited category stuck", livePayload.expenses.find((row) => row.id === chaiId)?.category === "stay");
const liveNets = computeBalances(livePayload);
check("balances still sum to zero on live data", liveNets.reduce((sum, entry) => sum + entry.netPaise, 0) === 0, JSON.stringify(liveNets.map((e) => [e.memberId, e.netPaise])));

await createExpense(live.context(second), {
  amountPaise: 20000,
  category: "transport",
  spentOn: live.startDate,
  payerId: second,
  splitWith: [],
});
await softDeleteExpense(secondCtx, chaiId);
const afterDelete = await readMoney(live.tripId);
const deleted = afterDelete.expenses.find((row) => row.id === chaiId);
check("removing an expense leaves the row", Boolean(deleted));
check("removing an expense sets deleted_at", Boolean(deleted?.deleted_at));
check("removing an expense takes it out of the total", totalSpent(afterDelete) === 20000, String(totalSpent(afterDelete)));
check("its splits stay as the audit trail", afterDelete.splits.filter((row) => row.expense_id === chaiId).length === 2);

const settlementId = await createSettlement(ownerCtx, {
  fromMemberId: second,
  toMemberId: owner,
  amountPaise: 20000,
});
const { data: settlementRow } = await db
  .from("settlements")
  .select("status")
  .eq("id", settlementId)
  .single();
check("a settlement starts as promised", settlementRow?.status === "pending");

const beforeConfirm = computeBalances(await readMoney(live.tripId));
check(
  "a promised settlement has not moved anything yet",
  beforeConfirm.every((entry) => entry.netPaise === 0),
  JSON.stringify(beforeConfirm.map((e) => [e.memberId, e.netPaise])),
);

let strangerError = "";
try {
  await setSettlementStatus(live.context(third), settlementId, "paid");
} catch (error) {
  strangerError = error instanceof MoneyError ? error.message : String(error);
}
check("someone uninvolved cannot mark it paid", strangerError.includes("owner can mark"), strangerError);

await setSettlementStatus(ownerCtx, settlementId, "paid");
await setSettlementStatus(live.context(second), settlementId, "confirmed");
const { data: finalSettlement } = await db
  .from("settlements")
  .select("status")
  .eq("id", settlementId)
  .single();
check("the owner and the payer can move it along", finalSettlement?.status === "confirmed");

let selfSettleError = "";
try {
  await createSettlement(ownerCtx, {
    fromMemberId: owner,
    toMemberId: owner,
    amountPaise: 100,
  });
} catch (error) {
  selfSettleError = error instanceof MoneyError ? error.message : String(error);
}
check("settling up with yourself is refused", selfSettleError.includes("yourself"), selfSettleError);

let endedWrite = "";
try {
  await createExpense(over.context(over.memberIds[0]), {
    amountPaise: 5000,
    category: "food",
    spentOn: over.startDate,
    payerId: over.memberIds[0],
    splitWith: [],
  });
} catch (error) {
  endedWrite = error instanceof MoneyError ? error.message : String(error);
}
check("an over trip refuses new expenses", endedWrite.includes("read-only"), endedWrite);

let endedSettle = "";
try {
  await createSettlement(over.context(over.memberIds[0]), {
    fromMemberId: over.memberIds[1],
    toMemberId: over.memberIds[0],
    amountPaise: 5000,
  });
} catch (error) {
  endedSettle = error instanceof MoneyError ? error.message : String(error);
}
check("an over trip refuses new settlements", endedSettle.includes("read-only"), endedSettle);

let foreignExpense = "";
try {
  await softDeleteExpense(secondCtx, "11111111-2222-4333-8444-555555555555");
} catch (error) {
  foreignExpense = error instanceof Error ? error.message : String(error);
}
check("an expense id from elsewhere is refused", foreignExpense.includes("not on this trip"), foreignExpense);

// Two trips at once: one trip's splits must never leak into another's ledger.
await createExpense(other.context(other.memberIds[0]), {
  amountPaise: 77700,
  category: "shopping",
  spentOn: other.startDate,
  payerId: other.memberIds[0],
  splitWith: [],
});
const otherPayload = await readMoney(other.tripId);
check(
  "another trip's expense is invisible here",
  !otherPayload.expenses.some((row) => row.id === chaiId),
);
check(
  "and its splits with it",
  otherPayload.splits.every((row) =>
    otherPayload.expenses.some((expense) => expense.id === row.expense_id),
  ),
);

// The seeded ledger, read-only: ten expenses must still balance to zero.
const seedPayload = await readMoney(SEED_TRIP);
check("the seeded ledger reads", seedPayload.expenses.length >= 10, String(seedPayload.expenses.length));
check("the seeded ledger balances to zero", computeBalances(seedPayload).reduce((sum, entry) => sum + entry.netPaise, 0) === 0);
// Bhoomi paid the most, Dev confirmed a 450 rupee handover, and Sana's 660 rupee
// settlement to Ravi is still only promised, so it must not move anything.
check(
  "the seeded balances are the ones the story says",
  equal(
    [...computeBalances(seedPayload)]
      .sort((a, b) => a.memberId.localeCompare(b.memberId))
      .map((entry) => [entry.memberId, entry.netPaise]),
    [
      ["22222222-2222-4222-8222-222222222201", 660800],
      ["22222222-2222-4222-8222-222222222202", -42600],
      ["22222222-2222-4222-8222-222222222203", -424000],
      ["22222222-2222-4222-8222-222222222204", -194200],
    ],
  ),
  JSON.stringify(computeBalances(seedPayload).map((e) => [e.memberId, e.netPaise])),
);
check(
  "the seeded ledger needs four members' worth of settling",
  simplifyDebts(computeBalances(seedPayload)).reduce((sum, transfer) => sum + transfer.amountPaise, 0) === 660800,
);
check("every seeded share belongs to a seeded expense", seedPayload.splits.every((row) => seedPayload.expenses.some((expense) => expense.id === row.expense_id)));

// -------------------------------------------------------------------- HTTP

const { signSession } = await import("../src/lib/auth/session");
async function cookie(tripId: string, memberId: string) {
  return `tc_session=${await signSession({ memberId, tripId })}`;
}

const liveCookie = await cookie(live.tripId, owner);
const moneyRes = await fetch(`${BASE}/money`, { headers: { cookie: liveCookie }, redirect: "manual" });
const moneyHtml = await moneyRes.text();
check("the money page opens for a member", moneyRes.status === 200, String(moneyRes.status));
check("the ledger shows the total", moneyHtml.includes("₹200.00"), moneyHtml.match(/₹[\d,.]+/g)?.slice(0, 3).join(" "));
check("the balances window is there", moneyHtml.includes("Who owes whom"));
check("a ledger with debts suggests payments", moneyHtml.includes("Fewest payments to square up"));
check("a live trip offers the log button", moneyHtml.includes("Log an expense") || moneyHtml.includes(">Log<"));
check("no PIN hashes in the money page", !moneyHtml.includes("pin_hash") && !moneyHtml.includes("$2b$"));

const overCookie = await cookie(over.tripId, over.memberIds[0]);
const overRes = await fetch(`${BASE}/money`, { headers: { cookie: overCookie }, redirect: "manual" });
const overHtml = await overRes.text();
check("an over trip still opens the ledger", overRes.status === 200, String(overRes.status));
check("an over trip is badged read-only", overHtml.includes("Read-only"));
check("an over trip offers no log button", !overHtml.includes("Log an expense"));
check("an over trip says it has no expenses", overHtml.includes("never logged an expense"));
check("an empty ledger says nobody owes anybody", overHtml.includes("Nobody owes anybody"));

const seedCookie = await cookie(SEED_TRIP, BHOOMI);
const seedRes = await fetch(`${BASE}/money`, { headers: { cookie: seedCookie }, redirect: "manual" });
const seedHtml = await seedRes.text();
check("the seeded ledger page opens", seedRes.status === 200, String(seedRes.status));
check("it totals the whole trip", seedHtml.includes("₹20,920.00"), seedHtml.match(/₹[\d,.]+/g)?.slice(0, 3).join(" "));
check("it shows who is owed", seedHtml.includes("Fewest payments to square up") && /pays/.test(seedHtml));
check("the promised settlement is badged as promised", seedHtml.includes("Promised"));
check("the confirmed one is badged as settled", seedHtml.includes("Settled"));
check("no PIN hashes on the seeded ledger either", !seedHtml.includes("pin_hash"));

const apiRes = await fetch(`${BASE}/api/trips/${live.tripId}/money`, { headers: { cookie: liveCookie } });
const apiBody = await apiRes.json();
check("the money polling route answers", apiRes.status === 200, String(apiRes.status));
check("it sends members, expenses and splits", Array.isArray(apiBody.members) && Array.isArray(apiBody.expenses) && Array.isArray(apiBody.splits));
check(
  "it leaks nothing private",
  !JSON.stringify(apiBody).includes("pin_hash") && !JSON.stringify(apiBody).includes("invite_code"),
);
const wrongTrip = await fetch(`${BASE}/api/trips/${OTHER_TRIP}/money`, { headers: { cookie: liveCookie } });
check("it refuses another trip", wrongTrip.status === 404, String(wrongTrip.status));
const signedOut = await fetch(`${BASE}/api/trips/${live.tripId}/money`);
check("it needs a session", signedOut.status === 401, String(signedOut.status));

// ----------------------------------------------------------------- cleanup

for (const fixture of [live.tripId, over.tripId, other.tripId]) {
  await db.from("trips").delete().eq("id", fixture);
}
const { data: left } = await db.from("trips").select("id").ilike("name", "verify-money-%");
check("no verify-money trips left behind", (left ?? []).length === 0, JSON.stringify(left));
const { data: seededExpenses } = await db.from("expenses").select("id").eq("trip_id", SEED_TRIP);
check("the seeded ledger is untouched", (seededExpenses ?? []).length >= 10, String(seededExpenses?.length));

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log(`failed: ${failures.join(", ")}`);
  process.exit(1);
}