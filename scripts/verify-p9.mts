/**
 * Live checks for P9: balances, settle-up and stored payment QRs. Run with the
 * dev server up:
 *
 *   NODE_OPTIONS=--conditions=react-server npx tsx scripts/verify-p9.mts
 *
 * Everything it creates it deletes again, including the QR files it parked in
 * the `payment-qrs` bucket; the seeded trip is only ever read.
 */
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import type { Database } from "../src/lib/db/types";

const SEED_TRIP = "11111111-1111-4111-8111-111111111111";
const OTHER_TRIP = "aaaaaaaa-9999-4999-8999-999999999999";
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

/**
 * True when a storage path shows up anywhere except as part of a signed link —
 * the URL has to contain the object it points at, the wire never does.
 */
function leaksPath(haystack: string, path: string | null | undefined): boolean {
  if (!path) return false;
  let index = haystack.indexOf(path);
  while (index !== -1) {
    const before = haystack.slice(Math.max(0, index - 40), index);
    if (!before.includes("/object/sign/payment-qrs/")) return true;
    index = haystack.indexOf(path, index + 1);
  }
  return false;
}

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

const { computeBalances, simplifyDebts } = await import("../src/lib/money/balances");

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
      invite_code: `P9${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
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

const live = await makeTrip("verify-p9-live", 1, 3);
const over = await makeTrip("verify-p9-over", 10, 2);
const [owner, second, third] = live.memberIds;

const {
  readMoney,
  createExpense,
  createSettlement,
  setSettlementStatus,
  PAYMENT_QR_URL_TTL_SECONDS,
} = await import("../src/lib/money/service");
const { setPaymentQr, removePaymentQr, setUpiId } = await import(
  "../src/lib/money/payment-qr"
);
const {
  MAX_PAYMENT_QR_BYTES,
  isAllowedPaymentQrMime,
  MAX_UPI_ID_LENGTH,
} = await import("../src/lib/money/payment-qr-limits");
const { upiIdSchema, settlementSchema } = await import("../src/lib/validation/money");

const ownerCtx = live.context(owner);
const secondCtx = live.context(second);

const pngFile = (name = "qr.png") => ({
  name,
  mimeType: "image/png",
  size: PNG_BYTES.length,
  // A copy of the bytes, not the pooled Buffer's backing array behind them.
  bytes: new Uint8Array(PNG_BYTES).buffer as ArrayBuffer,
});

// ------------------------------------------------------------------ the UPI id

check("QR images are capped at 5 MB", MAX_PAYMENT_QR_BYTES === 5 * 1024 * 1024);
check("only images are accepted as a QR", isAllowedPaymentQrMime("image/png") && !isAllowedPaymentQrMime("application/pdf"));
check("the schema keeps the database's 80-character ceiling", MAX_UPI_ID_LENGTH === 80);
check("a blank UPI id means clear it", upiIdSchema.parse({ upiId: "   " }).upiId === "");
check("the pay form's paid intent is a valid settlement", settlementSchema.parse({
  fromMemberId: "11111111-1111-4111-8111-111111111111",
  toMemberId: "22222222-2222-4222-8222-222222222222",
  amountRupees: "500",
  intent: "paid",
}).intent === "paid");
check(
  "confirming is not a starting intent",
  !settlementSchema.safeParse({
    fromMemberId: "11111111-1111-4111-8111-111111111111",
    toMemberId: "22222222-2222-4222-8222-222222222222",
    amountRupees: "500",
    intent: "confirmed",
  }).success,
);

await setUpiId(ownerCtx, "  bhoomi@okaxis  ");
const withUpi = await readMoney(live.tripId);
check(
  "a UPI id is stored trimmed on the caller's own row",
  withUpi.members.find((member) => member.id === owner)?.upiId === "bhoomi@okaxis",
  JSON.stringify(withUpi.members.map((member) => member.upiId)),
);
check(
  "everyone else starts with none",
  withUpi.members.filter((member) => member.upiId === null).length === 2,
);

const shortUpi = await rejected(() => setUpiId(ownerCtx, "ab"), "between 3 and 80");
check("a two-character UPI id is refused", shortUpi === "", shortUpi);
const longUpi = await rejected(() => setUpiId(ownerCtx, "a".repeat(81)), "between 3 and 80");
check("an 81-character UPI id is refused", longUpi === "", longUpi);
const overUpi = await rejected(() => setUpiId(over.context(over.memberIds[0]), "x@ybl"), "read-only");
check("an over trip refuses a UPI edit", overUpi === "", overUpi);

await setUpiId(ownerCtx, "   ");
check(
  "a blank box clears the UPI id",
  (await readMoney(live.tripId)).members.find((member) => member.id === owner)?.upiId === null,
);
await setUpiId(ownerCtx, "bhoomi@okaxis");

// ---------------------------------------------------------------- the QR image

const emptyQr = await rejected(
  () => setPaymentQr(ownerCtx, { ...pngFile(), size: 0, bytes: new ArrayBuffer(0) }),
  "empty",
);
check("an empty QR file is refused", emptyQr === "", emptyQr);

const badMime = await rejected(
  () =>
    setPaymentQr(ownerCtx, {
      name: "qr.pdf",
      mimeType: "application/pdf",
      size: 9,
      bytes: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9]).buffer as ArrayBuffer,
    }),
  "image QRs",
);
check("a non-image QR is refused", badMime === "", badMime);

const bigQr = await rejected(
  () => setPaymentQr(ownerCtx, { ...pngFile(), size: MAX_PAYMENT_QR_BYTES + 1 }),
  "5 MB",
);
check("an oversized QR is refused", bigQr === "", bigQr);

const overQr = await rejected(
  () => setPaymentQr(over.context(over.memberIds[0]), pngFile()),
  "read-only",
);
check("an over trip refuses a new QR", overQr === "", overQr);

await setPaymentQr(ownerCtx, pngFile("my-code.png"));
const { data: qrRow } = await db
  .from("members")
  .select("payment_qr_path")
  .eq("id", owner)
  .single();
check("storing a QR records a path on the caller's row", Boolean(qrRow?.payment_qr_path), qrRow?.payment_qr_path ?? "none");
check(
  "the path is namespaced to the trip and the member",
  (qrRow?.payment_qr_path ?? "").startsWith(`${live.tripId}/${owner}/`),
  qrRow?.payment_qr_path ?? "",
);

const afterQr = await readMoney(live.tripId);
const me = afterQr.members.find((member) => member.id === owner);
check("the ledger ships a signed QR URL", Boolean(me?.qrUrl), me?.qrUrl ?? "none");
check(
  "the signed URL points into the private payment-qrs bucket",
  (me?.qrUrl ?? "").includes(`/object/sign/payment-qrs/${live.tripId}/${owner}/`),
  me?.qrUrl ?? "",
);
check(
  "the polling payload never carries the raw path",
  !JSON.stringify(afterQr).includes("payment_qr_path") &&
    !leaksPath(JSON.stringify(afterQr), qrRow?.payment_qr_path),
);
check("QR links live as long as receipts do", PAYMENT_QR_URL_TTL_SECONDS === 300);

let qrBytes = 0;
if (me?.qrUrl) qrBytes = (await (await fetch(me.qrUrl)).arrayBuffer()).byteLength;
check("a minted QR URL serves the image", qrBytes === PNG_BYTES.length, String(qrBytes));

await setPaymentQr(ownerCtx, { ...pngFile("second-code.jpg"), mimeType: "image/jpeg" });
const { data: replacedRow } = await db
  .from("members")
  .select("payment_qr_path")
  .eq("id", owner)
  .single();
const { data: myShelf } = await db.storage
  .from("payment-qrs")
  .list(`${live.tripId}/${owner}`, { limit: 100 });
check(
  "a replacement swaps the file and keeps one copy",
  (replacedRow?.payment_qr_path ?? "").endsWith(".jpg") &&
    (replacedRow?.payment_qr_path ?? "") !== qrRow?.payment_qr_path &&
    (myShelf ?? []).length === 1,
  JSON.stringify({ path: replacedRow?.payment_qr_path, shelf: myShelf }),
);

await removePaymentQr(ownerCtx);
const { data: clearedRow } = await db
  .from("members")
  .select("payment_qr_path")
  .eq("id", owner)
  .single();
const { data: emptiedShelf } = await db.storage
  .from("payment-qrs")
  .list(`${live.tripId}/${owner}`, { limit: 100 });
check("removing clears the row", clearedRow?.payment_qr_path === null);
check("removing empties the member's folder", (emptiedShelf ?? []).length === 0, JSON.stringify(emptiedShelf));
check(
  "removing again is a no-op",
  (await removePaymentQr(ownerCtx)) === undefined,
);

// --------------------------------------------------- a debt, and who settles

const debtId = await createExpense(ownerCtx, {
  amountPaise: 3000,
  category: "food",
  note: "Beach shack dinner",
  spentOn: live.startDate,
  payerId: second,
  splitWith: [owner, third],
});
check("an expense exists to settle", Boolean(debtId));

const beforeSettle = computeBalances(await readMoney(live.tripId));
const owedToSecond = beforeSettle.find((entry) => entry.memberId === second);
check("the payer is owed by the other two", owedToSecond?.netPaise === 2000, JSON.stringify(beforeSettle));
const suggested = simplifyDebts(beforeSettle);
check(
  "two payments square the group",
  suggested.length === 2 && suggested.every((transfer) => transfer.toMemberId === second),
  JSON.stringify(suggested),
);

const zero = await rejected(
  () => createSettlement(ownerCtx, { fromMemberId: owner, toMemberId: second, amountPaise: 0 }),
  "positive number of paise",
);
check("a zero-rupee settlement is refused", zero === "", zero);

const notMe = await rejected(
  () =>
    createSettlement(secondCtx, {
      fromMemberId: third,
      toMemberId: second,
      amountPaise: 1000,
      initialStatus: "paid",
    }),
  "Only the person who paid",
);
check("the person being paid cannot claim it was paid", notMe === "", notMe);

const overSettle = await rejected(
  () =>
    createSettlement(over.context(over.memberIds[0]), {
      fromMemberId: over.memberIds[0],
      toMemberId: over.memberIds[1],
      amountPaise: 500,
    }),
  "read-only",
);
check("an over trip refuses a settlement", overSettle === "", overSettle);

// A promise: logged, but nothing has moved.
const promisedId = await createSettlement(ownerCtx, {
  fromMemberId: owner,
  toMemberId: second,
  amountPaise: 1000,
});
const { data: promisedRow } = await db
  .from("settlements")
  .select("status")
  .eq("id", promisedId)
  .single();
check("a promise starts as pending", promisedRow?.status === "pending");

const promiseNets = computeBalances(await readMoney(live.tripId)).map((entry) => [
  entry.memberId,
  entry.netPaise,
]);
check(
  "the promise has not moved anybody's money",
  equal(promiseNets, [
    [second, 2000],
    [owner, -1000],
    [third, -1000],
  ]),
  JSON.stringify(promiseNets),
);

// "I paid": the debtor records the payment as already sent.
const paidId = await createSettlement(ownerCtx, {
  fromMemberId: owner,
  toMemberId: second,
  amountPaise: 1000,
  initialStatus: "paid",
});
const { data: paidRow } = await db
  .from("settlements")
  .select("status")
  .eq("id", paidId)
  .single();
check("I paid lands as paid", paidRow?.status === "paid");

const paidNets = computeBalances(await readMoney(live.tripId)).map((entry) => [
  entry.memberId,
  entry.netPaise,
]);
check(
  "the payment the payer claims has already moved the balance",
  equal(paidNets, [
    [second, 1000],
    [owner, 0],
    [third, -1000],
  ]),
  JSON.stringify(paidNets),
);

// Only the two people in the payment (or the owner) can move it along.
const strangerConfirm = await rejected(
  () => setSettlementStatus(live.context(third), paidId, "confirmed"),
  "Only the two of you",
);
check("a stranger to the payment cannot confirm it", strangerConfirm === "", strangerConfirm);

await setSettlementStatus(secondCtx, paidId, "confirmed");
const { data: confirmedRow } = await db
  .from("settlements")
  .select("status")
  .eq("id", paidId)
  .single();
check("the creditor confirms it landed", confirmedRow?.status === "confirmed");

const confirmedNets = computeBalances(await readMoney(live.tripId)).map((entry) => [
  entry.memberId,
  entry.netPaise,
]);
check(
  "confirming does not move the same money twice",
  equal(confirmedNets, [
    [second, 1000],
    [owner, 0],
    [third, -1000],
  ]),
  JSON.stringify(confirmedNets),
);

// --------------------------------------------------------------------- HTTP

const { signSession } = await import("../src/lib/auth/session");
async function cookie(tripId: string, memberId: string) {
  return `tc_session=${await signSession({ memberId, tripId })}`;
}

const ownerCookie = await cookie(live.tripId, owner);
const secondCookie = await cookie(live.tripId, second);
const thirdCookie = await cookie(live.tripId, third);

// The creditor stores their own QR through the route, so the debtor has one to scan.
const uploadForm = new FormData();
uploadForm.set("file", new File([new Uint8Array(PNG_BYTES)], "ravi-code.png", { type: "image/png" }));
const uploadRes = await fetch(`${BASE}/api/trips/${live.tripId}/payment-qr`, {
  method: "POST",
  headers: { cookie: secondCookie },
  body: uploadForm,
});
const uploadBody = (await uploadRes.json()) as { ok?: boolean; error?: string };
check("the QR route accepts a multipart upload", uploadRes.status === 200 && uploadBody.ok === true, JSON.stringify(uploadBody));

const { data: creditorRow } = await db
  .from("members")
  .select("payment_qr_path")
  .eq("id", second)
  .single();
check(
  "the upload landed on the caller's own row",
  (creditorRow?.payment_qr_path ?? "").startsWith(`${live.tripId}/${second}/`),
  creditorRow?.payment_qr_path ?? "",
);

const wrongTripRes = await fetch(`${BASE}/api/trips/${OTHER_TRIP}/payment-qr`, {
  method: "POST",
  headers: { cookie: ownerCookie },
  body: new FormData(),
});
check("the QR route refuses another trip", wrongTripRes.status === 404, String(wrongTripRes.status));

const signedOutRes = await fetch(`${BASE}/api/trips/${live.tripId}/payment-qr`, {
  method: "POST",
  body: new FormData(),
});
check("the QR route needs a session", signedOutRes.status === 401, String(signedOutRes.status));

// `third` is the one still left holding a debt after the settlements above.
const moneyRes = await fetch(`${BASE}/money`, {
  headers: { cookie: thirdCookie },
  redirect: "manual",
});
const moneyHtml = await moneyRes.text();
check("the money page opens for a member", moneyRes.status === 200, String(moneyRes.status));
check("the settle-up screen offers My QR", moneyHtml.includes("My QR"));
check(
  "the debtor gets a Pay button",
  moneyHtml.includes(">Pay<") || moneyHtml.includes("Pay ₹"),
);
check(
  "the creditor's QR is on the settle-up list as a signed link",
  moneyHtml.includes("/object/sign/payment-qrs/"),
);
check(
  "the QR preview never leaks the storage path",
  !moneyHtml.includes("payment_qr_path") &&
    !leaksPath(moneyHtml, creditorRow?.payment_qr_path),
);
check("the money page still leaks no PIN hash", !moneyHtml.includes("pin_hash") && !moneyHtml.includes("$2b$"));

const pendingRes = await fetch(`${BASE}/money`, { headers: { cookie: ownerCookie } });
const pendingHtml = await pendingRes.text();
check(
  "the debtor's tap on a promise is I paid",
  pendingHtml.includes("I paid"),
  "no I paid button",
);

// Another payment the payer has already sent, so the creditor has a button to tap.
await createSettlement(live.context(third), {
  fromMemberId: third,
  toMemberId: second,
  amountPaise: 500,
  initialStatus: "paid",
});
const creditorHtml = await (
  await fetch(`${BASE}/money`, { headers: { cookie: secondCookie } })
).text();
check(
  "the creditor's tap is Confirm received",
  creditorHtml.includes("Confirm received"),
  "no Confirm received button",
);

const pollRes = await fetch(`${BASE}/api/trips/${live.tripId}/money`, {
  headers: { cookie: ownerCookie },
});
const pollBody = (await pollRes.json()) as { members?: Record<string, unknown>[] };
const wire = JSON.stringify(pollBody);
check(
  "the polling payload carries the QR as a signed URL",
  Boolean(pollBody.members?.some((member) => typeof member.qrUrl === "string")),
);
check(
  "and never the raw path behind it",
  !wire.includes("payment_qr_path") && !leaksPath(wire, creditorRow?.payment_qr_path),
);
check(
  "members ship their UPI id too",
  Boolean(pollBody.members?.some((member) => member.upiId === "bhoomi@okaxis")),
);

const removeRes = await fetch(`${BASE}/api/trips/${live.tripId}/payment-qr`, {
  method: "DELETE",
  headers: { cookie: secondCookie },
});
const removeBody = (await removeRes.json()) as { ok?: boolean; error?: string };
check("the QR route removes a QR", removeRes.status === 200 && removeBody.ok === true, JSON.stringify(removeBody));
const { data: afterRemoveRow } = await db
  .from("members")
  .select("payment_qr_path")
  .eq("id", second)
  .single();
check("the creditor's row is clear again", afterRemoveRow?.payment_qr_path === null);

// The seeded trip reads with the new wire shape and nothing private in it.
const seedPayload = await readMoney(SEED_TRIP);
check(
  "seeded members ship a UPI id and QR slot",
  seedPayload.members.every((member) => "upiId" in member && "qrUrl" in member),
);
check(
  "seeded members have no QR of their own",
  seedPayload.members.every((member) => member.qrUrl === null),
);
const seedHtml = await (
  await fetch(`${BASE}/money`, {
    headers: { cookie: `tc_session=${await signSession({ memberId: "22222222-2222-4222-8222-222222222201", tripId: SEED_TRIP })}` },
  })
).text();
check("the seeded settle-up screen still opens", seedHtml.includes("Fewest payments to square up"));
check("the seeded page offers My QR", seedHtml.includes("My QR"));

// ----------------------------------------------------------------- cleanup

for (const fixture of [live.tripId, over.tripId]) {
  const { data: folders } = await db.storage.from("payment-qrs").list(fixture, { limit: 100 });
  for (const folder of folders ?? []) {
    await db.storage.from("payment-qrs").remove([`${fixture}/${folder.name}`]);
  }
  await db.from("trips").delete().eq("id", fixture);
}

const { data: leftTrips } = await db.from("trips").select("id").ilike("name", "verify-p9-%");
check("no verify-p9 trips left behind", (leftTrips ?? []).length === 0, JSON.stringify(leftTrips));
const { data: topLevel } = await db.storage.from("payment-qrs").list("", { limit: 100 });
check(
  "no verify-p9 folders are left in the payment-qrs bucket",
  !(topLevel ?? []).some((file) => file.name === live.tripId || file.name === over.tripId),
  JSON.stringify(topLevel),
);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log(`failed: ${failures.join(", ")}`);
  process.exit(1);
}
process.exit(0);
