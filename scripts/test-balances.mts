/**
 * Pure unit tests for the balance and debt-simplification maths. No server, no
 * database — just `npx tsx scripts/test-balances.mts`.
 *
 * Five-plus scenarios for `simplifyDebts`, including the zero-balance case the
 * algorithm must quietly skip, plus the settlement rules the ledger leans on.
 */
import {
  computeBalances,
  simplifyDebts,
  totalSpent,
  type MoneyPayload,
  type Transfer,
} from "../src/lib/money/balances";

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

const TRIP = "11111111-1111-4111-8111-111111111111";

const member = (id: string) => ({
  id,
  displayName: id.toUpperCase(),
  role: "member" as const,
  upiId: null,
  qrUrl: null,
});

function payload(
  memberIds: string[],
  expenses: {
    id: string;
    payer: string;
    amount: number;
    shares: Record<string, number>;
    deleted?: boolean;
  }[],
  settlements: MoneyPayload["settlements"] = [],
): MoneyPayload {
  return {
    members: memberIds.map(member),
    expenses: expenses.map((expense) => ({
      id: expense.id,
      trip_id: TRIP,
      payer_id: expense.payer,
      amount_paise: expense.amount,
      category: "food" as const,
      note: null,
      spent_on: "2026-10-02",
      receiptUrl: null,
      deleted_at: expense.deleted ? "2026-10-03T00:00:00Z" : null,
      created_at: "2026-10-02T00:00:00Z",
    })),
    splits: expenses.flatMap((expense) =>
      Object.entries(expense.shares).map(([member_id, share_paise]) => ({
        expense_id: expense.id,
        member_id,
        share_paise: share_paise as number,
      })),
    ),
    settlements,
    budget: null,
  };
}

/** Applies the suggested payments back onto the nets, as a real settle-up would. */
function apply(transfers: Transfer[], balances: { memberId: string; netPaise: number }[]) {
  const nets = new Map(balances.map((entry) => [entry.memberId, entry.netPaise]));
  for (const transfer of transfers) {
    nets.set(
      transfer.fromMemberId,
      (nets.get(transfer.fromMemberId) ?? 0) + transfer.amountPaise,
    );
    nets.set(
      transfer.toMemberId,
      (nets.get(transfer.toMemberId) ?? 0) - transfer.amountPaise,
    );
  }
  return [...nets.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

const sorted = (transfers: Transfer[]) =>
  transfers
    .map((transfer) => [transfer.fromMemberId, transfer.toMemberId, transfer.amountPaise])
    .sort((a, b) => `${a[0]}${a[1]}`.localeCompare(`${b[0]}${b[1]}`));

// ------------------------------------------------- case 1: three friends

const trio = payload(
  ["a", "b", "c"],
  [{ id: "e1", payer: "a", amount: 3000, shares: { a: 1000, b: 1000, c: 1000 } }],
);
const trioBalances = computeBalances(trio);
const trioTransfers = simplifyDebts(trioBalances);
check(
  "case 1: three friends, one bill, two payments at most",
  trioTransfers.length <= 2 && equal(sorted(trioTransfers), [
    ["b", "a", 1000],
    ["c", "a", 1000],
  ]),
  JSON.stringify(sorted(trioTransfers)),
);
check(
  "case 1: those payments leave everyone square",
  equal(
    apply(trioTransfers, trioBalances),
    [["a", 0], ["b", 0], ["c", 0]],
  ),
  JSON.stringify(apply(trioTransfers, trioBalances)),
);

// ------------------------------------------------- case 2: all square

const square = payload(["a", "b", "c"], []);
const squareBalances = computeBalances(square);
check(
  "case 2: no expenses means no debt at all",
  equal(squareBalances.map((entry) => entry.netPaise), [0, 0, 0]),
);
check(
  "case 2: zero balances suggest no payments",
  simplifyDebts(squareBalances).length === 0,
  JSON.stringify(simplifyDebts(squareBalances)),
);

// ------------------------------------- case 3: a zero member in a busy group

const mixed = payload(
  ["a", "b", "c", "d"],
  [
    { id: "e1", payer: "a", amount: 4000, shares: { a: 1000, b: 1000, c: 1000, d: 1000 } },
    // d covers c's chai entirely: exactly what d owes the group, so d is square.
    { id: "e2", payer: "d", amount: 1000, shares: { c: 1000 } },
  ],
);
const mixedBalances = computeBalances(mixed);
const zeroMember = mixedBalances.find((entry) => entry.memberId === "d");
check(
  "case 3: the member who paid exactly their share sits at zero",
  zeroMember?.netPaise === 0 && zeroMember.paidPaise === 1000 && zeroMember.sharePaise === 1000,
  JSON.stringify(zeroMember),
);
const mixedTransfers = simplifyDebts(mixedBalances);
check(
  "case 3: a zero balance is never put in a payment",
  mixedTransfers.every(
    (transfer) => transfer.fromMemberId !== "d" && transfer.toMemberId !== "d",
  ),
  JSON.stringify(sorted(mixedTransfers)),
);
check(
  "case 3: the busy group still squares up",
  equal(apply(mixedTransfers, mixedBalances), [["a", 0], ["b", 0], ["c", 0], ["d", 0]]),
  JSON.stringify(apply(mixedTransfers, mixedBalances)),
);

// --------------------------------------------- case 4: one debtor, one creditor

const pair = payload(
  ["a", "b"],
  // a covered the whole bill and took no share of it: b owes all of it.
  [{ id: "e1", payer: "a", amount: 99999, shares: { a: 0, b: 99999 } }],
);
const pairBalances = computeBalances(pair);
const pairTransfers = simplifyDebts(pairBalances);
check(
  "case 4: one debtor and one creditor means exactly one payment",
  pairTransfers.length === 1 &&
    equal(pairTransfers, [{ fromMemberId: "b", toMemberId: "a", amountPaise: 99999 }]),
  JSON.stringify(pairTransfers),
);
check(
  "case 4: the payment is the whole debt, to the paise",
  pairTransfers[0]?.amountPaise === -pairBalances.find((b) => b.memberId === "b")!.netPaise,
);

// ---------------------------------------------------- case 5: six uneven

const six = payload(
  ["a", "b", "c", "d", "e", "f"],
  [
    { id: "e1", payer: "a", amount: 60000, shares: { a: 10000, b: 10000, c: 10000, d: 10000, e: 10000, f: 10000 } },
    { id: "e2", payer: "b", amount: 45500, shares: { b: 45500 } },
    { id: "e3", payer: "c", amount: 12345, shares: { c: 12345 } },
    { id: "e4", payer: "e", amount: 7777, shares: { f: 7777 } },
  ],
);
const sixBalances = computeBalances(six);
const sixTransfers = simplifyDebts(sixBalances);
const totalDebt = sixBalances
  .filter((entry) => entry.netPaise < 0)
  .reduce((sum, entry) => sum + -entry.netPaise, 0);
check(
  "case 5: six people need fewer payments than pairs",
  sixTransfers.length <= 5 && sixTransfers.length > 0,
  String(sixTransfers.length),
);
check(
  "case 5: every rupee of debt is carried exactly once",
  sixTransfers.reduce((sum, transfer) => sum + transfer.amountPaise, 0) === totalDebt &&
    sixTransfers.every((transfer) => transfer.amountPaise > 0),
  `${sixTransfers.reduce((sum, t) => sum + t.amountPaise, 0)} vs ${totalDebt}`,
);
check(
  "case 5: applying them clears the whole group",
  equal(
    apply(sixTransfers, sixBalances),
    [...sixBalances]
      .reverse()
      .map((entry) => [entry.memberId, 0])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
  ),
  JSON.stringify(apply(sixTransfers, sixBalances)),
);
check(
  "case 5: the suggestion is the same every time it is drawn",
  equal(simplifyDebts(sixBalances), sixTransfers),
);

// --------------------------------------------------- settlement bookkeeping

const settlement = (
  id: string,
  from: string,
  to: string,
  amountPaise: number,
  status: "pending" | "paid" | "confirmed",
) => ({
  id,
  trip_id: TRIP,
  from_member: from,
  to_member: to,
  amount_paise: amountPaise,
  status,
  created_at: "2026-10-03T00:00:00Z",
});

const owed = payload(
  ["a", "b"],
  [
    { id: "e1", payer: "a", amount: 2000, shares: { a: 1000, b: 1000 } },
  ],
);
check(
  "a promise to pay moves nothing yet",
  equal(
    computeBalances({
      ...owed,
      settlements: [settlement("s1", "b", "a", 1000, "pending")],
    }).map((entry) => [entry.memberId, entry.netPaise]),
    [["a", 1000], ["b", -1000]],
  ),
);
check(
  "a payment the payer claims has moved",
  equal(
    computeBalances({
      ...owed,
      settlements: [settlement("s1", "b", "a", 1000, "paid")],
    }).map((entry) => [entry.memberId, entry.netPaise]),
    [["a", 0], ["b", 0]],
  ),
);
check(
  "the creditor confirming does not move the same money twice",
  equal(
    computeBalances({
      ...owed,
      settlements: [settlement("s1", "b", "a", 1000, "confirmed")],
    }).map((entry) => [entry.memberId, entry.netPaise]),
    [["a", 0], ["b", 0]],
  ),
);
check(
  "a soft-deleted expense drops out of the maths",
  totalSpent(payload(["a"], [{ id: "e1", payer: "a", amount: 500, shares: { a: 500 }, deleted: true }])) === 0 &&
    computeBalances(payload(["a"], [{ id: "e1", payer: "a", amount: 500, shares: { a: 500 }, deleted: true }]))[0]
      .netPaise === 0,
);
check(
  "a member removed mid-trip leaves no ghost behind",
  equal(
    computeBalances({
      members: [member("a")],
      expenses: [
        {
          id: "e1",
          trip_id: TRIP,
          payer_id: "a",
          amount_paise: 1000,
          category: "food" as const,
          note: null,
          spent_on: "2026-10-02",
          receiptUrl: null,
          deleted_at: null,
          created_at: "2026-10-02T00:00:00Z",
        },
      ],
      splits: [
        { expense_id: "e1", member_id: "a", share_paise: 500 },
        { expense_id: "e1", member_id: "gone", share_paise: 500 },
      ],
      settlements: [],
      budget: null,
    }).map((entry) => [entry.memberId, entry.netPaise]),
    [["a", 500]],
  ),
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log(`failed: ${failures.join(", ")}`);
  process.exit(1);
}
