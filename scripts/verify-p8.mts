/**
 * Live checks for P8: uneven splits + receipts. Run with the dev server up:
 *
 *   NODE_OPTIONS=--conditions=react-server npx tsx scripts/verify-p8.mts
 *
 * Everything it creates it deletes again, including the receipt files it
 * parked in the `receipts` bucket; the seeded trip is only ever read.
 */
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import type { Database } from "../src/lib/db/types";

const SEED_TRIP = "11111111-1111-4111-8111-111111111111";
const OTHER_TRIP = "aaaaaaaa-9999-4999-8999-999999999999";
const OUTSIDER_MEMBER = "22222222-2222-4222-8222-222222222202";
const BASE = process.env.BASE_URL ?? "http://localhost:3000";

/** A real 1x1 transparent PNG, small enough to inline. */
const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

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

/** Runs the promise and returns truthy when it rejects with `fragment` in the message. */
async function rejected(fn: () => Promise<unknown>, fragment: string): Promise<string> {
  try {
    await fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return message.includes(fragment) ? "" : `wrong message: ${message}`;
  }
  return "no error thrown";
}

const { computeBalances } = await import("../src/lib/money/balances");
const { splitEqually } = await import("../src/lib/money/paise");

// --------------------------------------------------------------- live setup

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
      invite_code: `P8${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
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

const live = await makeTrip("verify-p8-live", 1, 3);
const over = await makeTrip("verify-p8-over", 10, 2);

const {
  readMoney,
  createExpense,
  updateExpense,
  RECEIPT_URL_TTL_SECONDS,
} = await import("../src/lib/money/service");
const { attachReceipt } = await import("../src/lib/money/receipts");
const { isAllowedReceiptMime, MAX_RECEIPT_BYTES } = await import(
  "../src/lib/money/receipt-limits"
);

// ------------------------------------------------------------- uneven splits

const [owner, second, third] = live.memberIds;
const ownerCtx = live.context(owner);

const customId = await createExpense(ownerCtx, {
  amountPaise: 5000,
  category: "food",
  note: "Chai, unevenly",
  spentOn: live.startDate,
  payerId: owner,
  splitWith: [second, third],
  // The payer chips in nothing; the two guests split the whole bill.
  shares: { [owner]: 0, [second]: 2000, [third]: 3000 },
});
const { data: customSplits } = await db
  .from("expense_splits")
  .select("member_id, share_paise")
  .eq("expense_id", customId);
const sortedSplits = (rows: { member_id: string; share_paise: number }[]) =>
  [...rows].sort((a, b) => a.member_id.localeCompare(b.member_id));
const sharePairs = (rows: { member_id: string; share_paise: number }[]) =>
  sortedSplits(rows).map((r) => [r.member_id, r.share_paise] as [string, number]);
const regularPairs = (pairs: [string, number][]) =>
  [...pairs].sort((a, b) => a[0].localeCompare(b[0]));
check("a custom split stores the exact shares", equal(sharePairs(customSplits ?? []), regularPairs([[owner, 0], [second, 2000], [third, 3000]])), JSON.stringify(customSplits));
check(
  "the payer can be given zero in a custom split",
  (customSplits ?? []).find((row) => row.member_id === owner)?.share_paise === 0,
);

const customNets = computeBalances(await readMoney(live.tripId))
  .map((entry) => entry.netPaise)
  .sort((a, b) => a - b);
check(
  "balances follow the custom shares, not an equal split",
  equal(customNets, [-3000, -2000, 5000]),
  JSON.stringify(customNets),
);

const equalShares = splitEqually(100, ["a", "b", "c"]);
check(
  "the equal fallback still adds up",
  [...equalShares.values()].reduce((sum, share) => sum + share, 0) === 100,
  JSON.stringify([...equalShares.entries()]),
);

// The form posts one share box per person under a stable field name; the action
// and the form both derive it from this helper, so a rename would be caught.
const { shareFieldName } = await import("../src/lib/validation/money");
const SOME_UUID = "11111111-2222-4333-8444-555555555555";
check("a share field is named share-<memberId>", shareFieldName(SOME_UUID) === `share-${SOME_UUID}`);
const { expenseSchema } = await import("../src/lib/validation/money");
const parsedSplit = expenseSchema.parse({
  amountRupees: "50",
  category: "food",
  spentOn: "2026-10-02",
  payerId: SOME_UUID,
  splitWith: [],
  splitMode: "share",
});
check("a custom splitMode survives the schema", parsedSplit.splitMode === "share");
const defaultedSplit = expenseSchema.parse({
  amountRupees: "50",
  category: "food",
  spentOn: "2026-10-02",
  payerId: SOME_UUID,
  splitWith: [],
});
check("absent splitMode means an equal split", defaultedSplit.splitMode === "equal");

const sumError = await rejected(
  () =>
    createExpense(ownerCtx, {
      amountPaise: 5000,
      category: "food",
      spentOn: live.startDate,
      payerId: owner,
      splitWith: [second, third],
      shares: { [owner]: 1000, [second]: 1000, [third]: 1000 },
    }),
  "add up to the amount",
);
check("shares that do not add up are refused", sumError === "", sumError);

const outsiderError = await rejected(
  () =>
    createExpense(ownerCtx, {
      amountPaise: 5000,
      category: "food",
      spentOn: live.startDate,
      payerId: owner,
      splitWith: [second],
      shares: { [owner]: 2500, [second]: 2500, [OUTSIDER_MEMBER]: 0 },
    }),
  "not in this trip",
);
check("a share for someone outside the trip is refused", outsiderError === "", outsiderError);

const partialError = await rejected(
  () =>
    createExpense(ownerCtx, {
      amountPaise: 5000,
      category: "food",
      spentOn: live.startDate,
      payerId: owner,
      splitWith: [second, third],
      shares: { [owner]: 2500, [second]: 2500 },
    }),
  "needs a share",
);
check("a split that skips a member is refused", partialError === "", partialError);

const floatError = await rejected(
  () =>
    createExpense(ownerCtx, {
      amountPaise: 5000,
      category: "food",
      spentOn: live.startDate,
      payerId: owner,
      splitWith: [second],
      shares: { [owner]: 2500, [second]: 2500.5 },
    }),
  "whole number of paise",
);
check("a floating share is refused", floatError === "", floatError);

// Editing swaps shares wholesale, exactly like the equal path.
await updateExpense(ownerCtx, customId, {
  amountPaise: 10000,
  category: "stay",
  spentOn: live.startDate,
  payerId: second,
  splitWith: [third],
  shares: { [second]: 2000, [third]: 8000 },
});
const { data: replacedSplits } = await db
  .from("expense_splits")
  .select("member_id, share_paise")
  .eq("expense_id", customId);
check("editing replaces custom shares wholesale", equal(sharePairs(replacedSplits ?? []), regularPairs([[second, 2000], [third, 8000]])), JSON.stringify(replacedSplits));

// -------------------------------------------------------------------- receipt

const pngFile = () => ({
  name: "bill.png",
  mimeType: "image/png",
  size: PNG_BYTES.length,
  bytes: new Uint8Array(PNG_BYTES).buffer as ArrayBuffer,
});

check("PNG is an accepted receipt", isAllowedReceiptMime("image/png"));
check("a PDF is not a receipt", !isAllowedReceiptMime("application/pdf"));
check("receipts share the 10 MB bucket cap", MAX_RECEIPT_BYTES === 10 * 1024 * 1024);

await attachReceipt(ownerCtx, customId, pngFile());
const { data: receiptRow } = await db
  .from("expenses")
  .select("receipt_path")
  .eq("id", customId)
  .single();
check("attaching a receipt records a storage path", Boolean(receiptRow?.receipt_path), receiptRow?.receipt_path ?? "none");
check(
  "the path is namespaced to the trip",
  (receiptRow?.receipt_path ?? "").startsWith(`${live.tripId}/`),
  receiptRow?.receipt_path ?? "",
);

const afterAttach = await readMoney(live.tripId);
const attachedExpense = afterAttach.expenses.find((row) => row.id === customId);
check("the ledger ships a signed receipt URL, not the path", Boolean(attachedExpense?.receiptUrl), attachedExpense?.receiptUrl ?? "none");
check(
  "the signed URL points into the private bucket",
  (attachedExpense?.receiptUrl ?? "").includes(`/object/sign/receipts/${live.tripId}/`),
  attachedExpense?.receiptUrl ?? "none",
);

// Signed URLs are fetchable without a session cookie — that is their point.
let servedStatus = 0;
let servedBytesLength = 0;
if (attachedExpense?.receiptUrl) {
  const receiptFetch = await fetch(attachedExpense.receiptUrl);
  servedStatus = receiptFetch.status;
  servedBytesLength = (await receiptFetch.arrayBuffer()).byteLength;
}
check("a minted receipt URL actually serves bytes", servedStatus === 200, `status ${servedStatus}`);
check("the served bytes are the uploaded image", servedBytesLength === PNG_BYTES.length, String(servedBytesLength));
check("the URL TTL is the vault-consistent 300s", RECEIPT_URL_TTL_SECONDS === 300);
check(
  "the polling payload still hides receipt_path as a field",
  !JSON.stringify(afterAttach).includes('"receipt_path"'),
);

// Replacing a receipt leaves exactly one file on the trip's shelf.
await attachReceipt(ownerCtx, customId, {
  ...pngFile(),
  name: "bill-replaced.jpg",
  mimeType: "image/jpeg",
});
const { data: replacedRow } = await db
  .from("expenses")
  .select("receipt_path")
  .eq("id", customId)
  .single();
const { data: shelf } = await db.storage.from("receipts").list(live.tripId, { limit: 100 });
check("a replacement swaps the stored file", (replacedRow?.receipt_path ?? "").endsWith(".jpg") && (replacedRow?.receipt_path ?? "") !== receiptRow?.receipt_path, replacedRow?.receipt_path ?? "");
check("the old copy is gone from storage", (shelf ?? []).length === 1, JSON.stringify(shelf));

const overReceipt = await rejected(
  () => attachReceipt(over.context(over.memberIds[0]), customId, pngFile()),
  "read-only",
);
check("an over trip refuses to pin receipts", overReceipt === "", overReceipt);

const strangerReceipt = await rejected(
  () => attachReceipt(ownerCtx, "99999999-9999-4999-8999-999999999999", pngFile()),
  "not on this trip",
);
check("a receipt can only be pinned to this trip's expenses", strangerReceipt === "", strangerReceipt);

const emptyReceipt = await rejected(
  () =>
    attachReceipt(ownerCtx, customId, {
      name: "empty.png",
      mimeType: "image/png",
      size: 0,
      bytes: new ArrayBuffer(0),
    }),
  "empty",
);
check("an empty file is refused", emptyReceipt === "", emptyReceipt);

const badMimeReceipt = await rejected(
  () =>
    attachReceipt(ownerCtx, customId, {
      name: "bill.pdf",
      mimeType: "application/pdf",
      size: 5,
      bytes: new Uint8Array([1, 2, 3, 4, 5]).buffer as ArrayBuffer,
    }),
  "image receipts",
);
check("a non-image receipt is refused", badMimeReceipt === "", badMimeReceipt);

// --------------------------------------------------------------------- HTTP

const { signSession } = await import("../src/lib/auth/session");
async function cookie(tripId: string, memberId: string) {
  return `tc_session=${await signSession({ memberId, tripId })}`;
}

const liveCookie = await cookie(live.tripId, owner);
const moneyRes = await fetch(`${BASE}/money`, { headers: { cookie: liveCookie }, redirect: "manual" });
const moneyHtml = await moneyRes.text();
check("the money page shows the pinned receipt", moneyHtml.includes("Receipt for this expense"));
check("the receipt preview never leaks the storage path", !moneyHtml.includes(receiptRow?.receipt_path ?? "___none___"));

const attachForm = new FormData();
attachForm.set("file", new File([new Uint8Array(PNG_BYTES)], "via-route.png", { type: "image/png" }));
const attachRes = await fetch(
  `${BASE}/api/trips/${live.tripId}/expenses/${customId}/receipt`,
  { method: "POST", headers: { cookie: liveCookie }, body: attachForm },
);
const attachBody = (await attachRes.json()) as { ok?: boolean; error?: string };
check("the receipt route accepts a multipart upload", attachRes.status === 200 && attachBody.ok === true, JSON.stringify(attachBody));

const wrongTripRes = await fetch(
  `${BASE}/api/trips/${OTHER_TRIP}/expenses/${customId}/receipt`,
  { method: "POST", headers: { cookie: liveCookie }, body: new FormData() },
);
check("the receipt route refuses another trip", wrongTripRes.status === 404, String(wrongTripRes.status));

const signedOutRes = await fetch(
  `${BASE}/api/trips/${live.tripId}/expenses/${customId}/receipt`,
  { method: "POST", body: new FormData() },
);
check("the receipt route needs a session", signedOutRes.status === 401, String(signedOutRes.status));

const delRes = await fetch(
  `${BASE}/api/trips/${live.tripId}/expenses/${customId}/receipt`,
  { method: "DELETE", headers: { cookie: liveCookie } },
);
const delBody = (await delRes.json()) as { ok?: boolean; error?: string };
check("the receipt route removes a receipt", delRes.status === 200 && delBody.ok === true, JSON.stringify(delBody));

const afterRemove = await readMoney(live.tripId);
check("the ledger no longer has a receipt URL", afterRemove.expenses.find((row) => row.id === customId)?.receiptUrl === null);
const { data: emptyShelf } = await db.storage.from("receipts").list(live.tripId, { limit: 100 });
check("removal emptied the trip's receipt shelf", (emptyShelf ?? []).length === 0, JSON.stringify(emptyShelf));

const delAgainRes = await fetch(
  `${BASE}/api/trips/${live.tripId}/expenses/${customId}/receipt`,
  { method: "DELETE", headers: { cookie: liveCookie } },
);
check("removing again is a no-op, not an error", delAgainRes.status === 200, String(delAgainRes.status));

// The seeded ledger is untouched and the wire shape is still complete there.
const seedPayload = await readMoney(SEED_TRIP);
check("the seeded ledger still reads", seedPayload.expenses.length >= 10, String(seedPayload.expenses.length));
check(
  "seeded expenses carry a receiptUrl, just null",
  seedPayload.expenses.every((row) => "receiptUrl" in row && row.receiptUrl === null),
);
check(
  "and the seeded shared pair still owes what the story says",
  computeBalances(seedPayload).find((entry) => entry.memberId === "22222222-2222-4222-8222-222222222201")?.netPaise === 660800,
);

// ----------------------------------------------------------------- cleanup

for (const fixture of [live.tripId, over.tripId]) {
  const leftover = await db.storage.from("receipts").list(fixture, { limit: 100 });
  if ((leftover.data ?? []).length > 0) {
    await db.storage
      .from("receipts")
      .remove((leftover.data ?? []).map((file) => `${fixture}/${file.name}`));
  }
  await db.from("trips").delete().eq("id", fixture);
}

const { data: leftTrips } = await db.from("trips").select("id").ilike("name", "verify-p8-%");
check("no verify-p8 trips left behind", (leftTrips ?? []).length === 0, JSON.stringify(leftTrips));
const { data: topLevel } = await db.storage.from("receipts").list("", { limit: 100 });
check(
  "no verify-p8 trip folders are left in the receipts bucket",
  !(topLevel ?? []).some((file) => file.name === live.tripId || file.name === over.tripId),
  JSON.stringify(topLevel),
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log(`failed: ${failures.join(", ")}`);
  process.exit(1);
}
process.exit(0);