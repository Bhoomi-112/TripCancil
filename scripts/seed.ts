import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import type { Database, Enums } from "../src/lib/db/types";
const DRY_RUN = process.argv.includes("--dry-run");

const TRIP_ID = "11111111-1111-4111-8111-111111111111";
const INVITE_CODE = "KONKAN7X4QP2M";
const PIN = "123456";

const MEMBER_IDS = {
  Bhoomi: "22222222-2222-4222-8222-222222222201",
  Ravi: "22222222-2222-4222-8222-222222222202",
  Sana: "22222222-2222-4222-8222-222222222203",
  Dev: "22222222-2222-4222-8222-222222222204",
} as const;

type MemberKey = keyof typeof MEMBER_IDS;
const everyone: MemberKey[] = ["Bhoomi", "Ravi", "Sana", "Dev"];

const PLACE_IDS = {
  koramana: "33333333-3333-4333-8333-333333333301",
  kesari: "33333333-3333-4333-8333-333333333302",
  chandra: "33333333-3333-4333-8333-333333333303",
  nagardhan: "33333333-3333-4333-8333-333333333304",
  alibaug: "33333333-3333-4333-8333-333333333305",
  karli: "33333333-3333-4333-8333-333333333306",
} as const;

type Tables = Database["public"]["Tables"];
type ExpenseCategory = Enums<"expense_category">;

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    try {
      process.loadEnvFile(file);
    } catch {
      continue;
    }
  }
}

function equalShares(totalPaise: number, members: MemberKey[]) {
  const base = Math.floor(totalPaise / members.length);
  let remainder = totalPaise - base * members.length;
  return members.map((member) => {
    const extra = remainder > 0 ? 1 : 0;
    remainder -= extra;
    return { member_id: MEMBER_IDS[member], share_paise: base + extra };
  });
}

function buildExpense(
  id: string,
  payer: MemberKey,
  amountPaise: number,
  category: ExpenseCategory,
  spentOn: string,
  note: string,
  members: MemberKey[],
  exact: Partial<Record<MemberKey, number>> = {},
) {
  const splits =
    Object.keys(exact).length > 0
      ? members.map((member) => ({
          expense_id: id,
          member_id: MEMBER_IDS[member],
          share_paise: exact[member] ?? 0,
        }))
      : equalShares(amountPaise, members).map((split) => ({
          ...split,
          expense_id: id,
        }));
  const total = splits.reduce((sum, split) => sum + split.share_paise, 0);
  if (total !== amountPaise) {
    throw new Error(
      `Split mismatch on ${id}: splits total ${total} paise but the amount is ${amountPaise}`,
    );
  }
  return {
    expense: {
      id,
      trip_id: TRIP_ID,
      payer_id: MEMBER_IDS[payer],
      amount_paise: amountPaise,
      category,
      note,
      spent_on: spentOn,
    } satisfies Tables["expenses"]["Insert"],
    splits,
  };
}

async function main() {
  loadEnv();

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!DRY_RUN && (!url || !serviceKey)) {
    console.error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.\n" +
        "Copy .env.example to .env.local, paste your project URL and service role key, then run: npm run seed",
    );
    process.exit(1);
  }

  const supabase = createClient<Database>(
    url ?? "http://127.0.0.1",
    serviceKey ?? "dry-run",
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const WRITES = { defaultToNull: false } as const;

  async function save(
    label: string,
    run: () => PromiseLike<{ error: { message: string } | null }>,
  ) {
    if (DRY_RUN) {
      console.log(`  · ${label} (dry run, not written)`);
      return;
    }
    const { error } = await run();
    if (error) throw new Error(`${label}: ${error.message}`);
    console.log(`  ✓ ${label}`);
  }

  const pinHash = await bcrypt.hash(PIN, 10);

  const members = everyone.map((key) => ({
    id: MEMBER_IDS[key],
    trip_id: TRIP_ID,
    display_name: key,
    pin_hash: pinHash,
    role: (key === "Bhoomi" ? "owner" : "member") as Enums<"member_role">,
    created_at: new Date(Date.UTC(2026, 9, 20, 9, 0, 0)).toISOString(),
  }));

  const places: Tables["places"]["Insert"][] = [
    {
      id: PLACE_IDS.koramana,
      trip_id: TRIP_ID,
      name: "Koramana Beach",
      lat: 18.5023,
      lng: 72.8746,
      category: "beach",
      location_type: "beach",
      proposed_by: MEMBER_IDS.Bhoomi,
      status: "locked",
    },
    {
      id: PLACE_IDS.kesari,
      trip_id: TRIP_ID,
      name: "Kesari Beach sunset",
      lat: 18.6404,
      lng: 72.8701,
      category: "beach",
      location_type: "beach",
      proposed_by: MEMBER_IDS.Ravi,
      status: "locked",
    },
    {
      id: PLACE_IDS.chandra,
      trip_id: TRIP_ID,
      name: "Chandra Talav camping",
      lat: 18.7549,
      lng: 72.8152,
      category: "camping",
      location_type: "forest",
      proposed_by: MEMBER_IDS.Sana,
      status: "locked",
    },
    {
      id: PLACE_IDS.nagardhan,
      trip_id: TRIP_ID,
      name: "Nagardhan viewpoint",
      lat: 18.4402,
      lng: 73.1408,
      category: "viewpoint",
      location_type: "heritage",
      proposed_by: MEMBER_IDS.Dev,
      status: "proposed",
    },
    {
      id: PLACE_IDS.alibaug,
      trip_id: TRIP_ID,
      name: "Alibaug beach resort",
      lat: 18.6679,
      lng: 72.8869,
      category: "stay",
      location_type: "beach",
      proposed_by: MEMBER_IDS.Ravi,
      status: "proposed",
    },
    {
      id: PLACE_IDS.karli,
      trip_id: TRIP_ID,
      name: "Karli Caves",
      lat: 18.5089,
      lng: 73.8221,
      category: "heritage",
      location_type: "heritage",
      proposed_by: MEMBER_IDS.Bhoomi,
      status: "proposed",
    },
  ];

  const votes: Tables["place_votes"]["Insert"][] = [
    { place_id: PLACE_IDS.koramana, member_id: MEMBER_IDS.Bhoomi, value: 1 },
    { place_id: PLACE_IDS.koramana, member_id: MEMBER_IDS.Ravi, value: 1 },
    { place_id: PLACE_IDS.koramana, member_id: MEMBER_IDS.Sana, value: 1 },
    { place_id: PLACE_IDS.koramana, member_id: MEMBER_IDS.Dev, value: 1 },
    { place_id: PLACE_IDS.kesari, member_id: MEMBER_IDS.Bhoomi, value: 1 },
    { place_id: PLACE_IDS.kesari, member_id: MEMBER_IDS.Ravi, value: 1 },
    { place_id: PLACE_IDS.kesari, member_id: MEMBER_IDS.Sana, value: 1 },
    { place_id: PLACE_IDS.kesari, member_id: MEMBER_IDS.Dev, value: -1 },
    { place_id: PLACE_IDS.chandra, member_id: MEMBER_IDS.Bhoomi, value: 1 },
    { place_id: PLACE_IDS.chandra, member_id: MEMBER_IDS.Ravi, value: -1 },
    { place_id: PLACE_IDS.chandra, member_id: MEMBER_IDS.Sana, value: 1 },
    { place_id: PLACE_IDS.chandra, member_id: MEMBER_IDS.Dev, value: 1 },
    { place_id: PLACE_IDS.nagardhan, member_id: MEMBER_IDS.Bhoomi, value: 1 },
    { place_id: PLACE_IDS.nagardhan, member_id: MEMBER_IDS.Sana, value: 1 },
    { place_id: PLACE_IDS.nagardhan, member_id: MEMBER_IDS.Dev, value: -1 },
    { place_id: PLACE_IDS.alibaug, member_id: MEMBER_IDS.Ravi, value: 1 },
    { place_id: PLACE_IDS.alibaug, member_id: MEMBER_IDS.Dev, value: 1 },
    { place_id: PLACE_IDS.karli, member_id: MEMBER_IDS.Bhoomi, value: -1 },
    { place_id: PLACE_IDS.karli, member_id: MEMBER_IDS.Ravi, value: -1 },
  ];

  const itinerary: Tables["itinerary_items"]["Insert"][] = [
    {
      id: "44444444-4444-4444-8444-444444444401",
      trip_id: TRIP_ID,
      day_index: 0,
      position: 0,
      title: "Drive to Alibaug, check in",
      start_time: "08:30:00",
      place_id: PLACE_IDS.alibaug,
      notes: "Stop for breakfast at Chaukhandi",
      location_type: "roadtrip",
    },
    {
      id: "44444444-4444-4444-8444-444444444402",
      trip_id: TRIP_ID,
      day_index: 0,
      position: 1,
      title: "Koramana Beach sunset",
      start_time: "16:30:00",
      place_id: PLACE_IDS.koramana,
      notes: "Carry the speaker, sunset at 18:02",
      location_type: "beach",
    },
    {
      id: "44444444-4444-4444-8444-444444444403",
      trip_id: TRIP_ID,
      day_index: 1,
      position: 0,
      title: "Kesari Beach morning walk",
      start_time: "07:00:00",
      place_id: PLACE_IDS.kesari,
      location_type: "beach",
    },
    {
      id: "44444444-4444-4444-8444-444444444404",
      trip_id: TRIP_ID,
      day_index: 1,
      position: 1,
      title: "Lunch at the village fish market",
      start_time: "12:30:00",
      notes: "Cash only, ask for surmai",
      location_type: "city",
    },
    {
      id: "44444444-4444-4444-8444-444444444405",
      trip_id: TRIP_ID,
      day_index: 2,
      position: 0,
      title: "Chandra Talav camping setup",
      start_time: "15:00:00",
      place_id: PLACE_IDS.chandra,
      notes: "Tents and generator already with Sana",
      location_type: "forest",
    },
    {
      id: "44444444-4444-4444-8444-444444444406",
      trip_id: TRIP_ID,
      day_index: 2,
      position: 1,
      title: "Night drive back to Mumbai",
      start_time: "21:30:00",
      notes: "Whoever is sober takes the wheel",
      location_type: "roadtrip",
    },
  ];

  const packing: Tables["packing_items"]["Insert"][] = [
    { id: "55555555-5555-4555-8555-555555555501", trip_id: TRIP_ID, name: "Sunscreen SPF 50", category: "toiletries", is_shared: true, created_by: MEMBER_IDS.Bhoomi },
    { id: "55555555-5555-4555-8555-555555555502", trip_id: TRIP_ID, name: "Beach towel", category: "gear", is_shared: true, created_by: MEMBER_IDS.Bhoomi },
    { id: "55555555-5555-4555-8555-555555555503", trip_id: TRIP_ID, name: "Waterproof phone pouch", category: "gear", is_shared: true, created_by: MEMBER_IDS.Ravi },
    { id: "55555555-5555-4555-8555-555555555504", trip_id: TRIP_ID, name: "Portable speaker", category: "gear", is_shared: true, checked: true, created_by: MEMBER_IDS.Ravi },
    { id: "55555555-5555-4555-8555-555555555505", trip_id: TRIP_ID, name: "Mosquito repellent", category: "toiletries", is_shared: true, created_by: MEMBER_IDS.Sana },
    { id: "55555555-5555-4555-8555-555555555506", trip_id: TRIP_ID, name: "Quick dry clothes", category: "clothes", is_shared: true, assigned_to: MEMBER_IDS.Sana, created_by: MEMBER_IDS.Sana },
    { id: "55555555-5555-4555-8555-555555555507", trip_id: TRIP_ID, name: "Flip flops", category: "clothes", is_shared: false, assigned_to: MEMBER_IDS.Dev, created_by: MEMBER_IDS.Dev },
    { id: "55555555-5555-4555-8555-555555555508", trip_id: TRIP_ID, name: "Tent poles", category: "gear", is_shared: true, created_by: MEMBER_IDS.Sana },
    { id: "55555555-5555-4555-8555-555555555509", trip_id: TRIP_ID, name: "First aid kit", category: "gear", is_shared: true, checked: true, created_by: MEMBER_IDS.Bhoomi },
    { id: "55555555-5555-4555-8555-555555555510", trip_id: TRIP_ID, name: "Snack box for the drive", category: "snacks", is_shared: true, created_by: MEMBER_IDS.Ravi },
    { id: "55555555-5555-4555-8555-555555555511", trip_id: TRIP_ID, name: "Swimwear", category: "clothes", is_shared: false, assigned_to: MEMBER_IDS.Bhoomi, created_by: MEMBER_IDS.Bhoomi },
    { id: "55555555-5555-4555-8555-555555555512", trip_id: TRIP_ID, name: "ID prints", category: "docs", is_shared: false, checked: true, created_by: MEMBER_IDS.Dev },
  ];

  const expenses = [
    buildExpense("66666666-6666-4666-8666-666666666601", "Bhoomi", 840000, "stay", "2026-11-12", "Two nights at the Alibaug resort", everyone),
    buildExpense("66666666-6666-4666-8666-666666666602", "Ravi", 185000, "transport", "2026-11-12", "Fuel from Mumbai to Alibaug", everyone),
    buildExpense("66666666-6666-4666-8666-666666666603", "Sana", 64300, "food", "2026-11-12", "Chaukhandi breakfast", ["Bhoomi", "Ravi", "Sana"], {
      Bhoomi: 21000,
      Ravi: 21300,
      Sana: 22000,
    }),
    buildExpense("66666666-6666-4666-8666-666666666604", "Dev", 128000, "food", "2026-11-12", "Corn + chai at Koramana", everyone),
    buildExpense("66666666-6666-4666-8666-666666666605", "Bhoomi", 45000, "transport", "2026-11-12", "Auto to the beach", ["Bhoomi", "Dev"]),
    buildExpense("66666666-6666-4666-8666-666666666606", "Sana", 36700, "food", "2026-11-13", "Fish market lunch", everyone),
    buildExpense("66666666-6666-4666-8666-666666666607", "Ravi", 219900, "activities", "2026-11-13", "Kayak rental at Kesari", ["Ravi", "Sana", "Dev"]),
    buildExpense("66666666-6666-4666-8666-666666666608", "Dev", 152300, "shopping", "2026-11-13", "Shell necklaces and kite", everyone),
    // Unequal shares on purpose: the ledger has to show something other than
    // a perfect third. They still add up to the amount, or the balances lie.
    buildExpense("66666666-6666-4666-8666-666666666609", "Bhoomi", 324000, "activities", "2026-11-14", "Camping at Chandra Talav", everyone, {
      Bhoomi: 100000,
      Ravi: 90000,
      Sana: 70000,
      Dev: 64000,
    }),
    buildExpense("66666666-6666-4666-8666-666666666610", "Ravi", 96800, "transport", "2026-11-14", "Night drive fuel back", everyone),
  ];

  const settlements: Tables["settlements"]["Insert"][] = [
    {
      id: "77777777-7777-4777-8777-777777777701",
      trip_id: TRIP_ID,
      from_member: MEMBER_IDS.Dev,
      to_member: MEMBER_IDS.Bhoomi,
      amount_paise: 45000,
      status: "confirmed",
      created_at: new Date(Date.UTC(2026, 10, 12, 20, 30, 0)).toISOString(),
    },
    {
      id: "77777777-7777-4777-8777-777777777702",
      trip_id: TRIP_ID,
      from_member: MEMBER_IDS.Sana,
      to_member: MEMBER_IDS.Ravi,
      amount_paise: 66000,
      status: "pending",
      created_at: new Date(Date.UTC(2026, 10, 13, 22, 10, 0)).toISOString(),
    },
  ];

  console.log(
    `${DRY_RUN ? "Dry run: " : "Seeding "}TripCancil · trip ${TRIP_ID} · invite ${INVITE_CODE} · PIN ${PIN}`,
  );

  await save("trip (owner link set after members)", () =>
    supabase.from("trips").upsert({
      id: TRIP_ID,
      name: "Konkan Coast Run",
      destination: "Alibaug, Maharashtra",
      start_date: "2026-11-12",
      end_date: "2026-11-14",
      location_type: "beach",
      invite_code: INVITE_CODE,
      base_currency: "INR",
      created_at: new Date(Date.UTC(2026, 9, 20, 8, 30, 0)).toISOString(),
    }, WRITES),
  );

  await save(`members (${members.length})`, () =>
    supabase.from("members").upsert(members, WRITES),
  );

  await save("trip owner", () =>
    supabase
      .from("trips")
      .update({ owner_member_id: MEMBER_IDS.Bhoomi })
      .eq("id", TRIP_ID),
  );

  await save(`places (${places.length})`, () =>
    supabase.from("places").upsert(places, WRITES),
  );

  await save(`place votes (${votes.length})`, () =>
    supabase.from("place_votes").upsert(votes, WRITES),
  );

  await save(`itinerary items (${itinerary.length})`, () =>
    supabase.from("itinerary_items").upsert(itinerary, WRITES),
  );

  await save(`packing items (${packing.length})`, () =>
    supabase.from("packing_items").upsert(packing, WRITES),
  );

  await save("budget", () =>
    supabase.from("budgets").upsert({
      trip_id: TRIP_ID,
      total_paise: 3000000,
      category_caps: {
        food: 500000,
        stay: 1000000,
        transport: 500000,
        activities: 600000,
        shopping: 200000,
        other: 200000,
      },
    }, WRITES),
  );

  await save(`expenses (${expenses.length})`, () =>
    supabase.from("expenses").upsert(expenses.map((entry) => entry.expense), WRITES),
  );

  await save("expense splits", async () => {
    const ids = expenses.map((entry) => entry.expense.id);
    const { error } = await supabase
      .from("expense_splits")
      .delete()
      .in("expense_id", ids);
    if (error) return { error };
    return supabase
      .from("expense_splits")
      .insert(expenses.flatMap((entry) => entry.splits), WRITES);
  });

  await save(`settlements (${settlements.length})`, () =>
    supabase.from("settlements").upsert(settlements, WRITES),
  );

  const totalSpent = expenses.reduce((sum, entry) => sum + entry.expense.amount_paise, 0);
  const perMemberPaid = new Map<MemberKey, number>(everyone.map((key) => [key, 0]));
  const perMemberShare = new Map<MemberKey, number>(everyone.map((key) => [key, 0]));
  for (const entry of expenses) {
    const payer = everyone.find(
      (key) => MEMBER_IDS[key] === entry.expense.payer_id,
    )!;
    perMemberPaid.set(payer, perMemberPaid.get(payer)! + entry.expense.amount_paise);
    for (const split of entry.splits) {
      const member = everyone.find((key) => MEMBER_IDS[key] === split.member_id)!;
      perMemberShare.set(member, perMemberShare.get(member)! + split.share_paise);
    }
  }

  console.log("");
  console.log(`Trip      Konkan Coast Run · Alibaug · 12-14 Nov 2026`);
  console.log(`Invite    ${INVITE_CODE}`);
  console.log(`Members   ${everyone.join(", ")} (PIN ${PIN})`);
  console.log(`Places    ${places.length} · Itinerary ${itinerary.length} items · Packing ${packing.length}`);
  console.log(`Spent     Rs ${(totalSpent / 100).toFixed(2)} of Rs 30,000.00 budget`);
  console.log("");
  console.log("member   paid       share      net");
  for (const key of everyone) {
    const paid = perMemberPaid.get(key)!;
    const share = perMemberShare.get(key)!;
    const net = share - paid;
    console.log(
      `${key.padEnd(8)} ${(paid / 100).toFixed(2).padStart(9)} ${(share / 100)
        .toFixed(2)
        .padStart(10)} ${net === 0 ? "0.00" : (net / 100).toFixed(2).padStart(9)}`,
    );
  }
}

main().catch((error) => {
  console.error(`\nSeed failed: ${(error as Error).message}`);
  process.exit(1);
});
