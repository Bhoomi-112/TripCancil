import "server-only";

import type { SessionContext } from "@/lib/auth/context";
import { getSupabase } from "@/lib/db/client";
import { tripHasEnded } from "@/lib/constants";
import type { MoneyPayload } from "@/lib/money/balances";
import { splitEqually } from "@/lib/money/paise";
import { EXPENSE_CATEGORIES, type ExpenseCategory } from "@/lib/money/categories";
import type { Enums } from "@/lib/db/types";
import type { SettlementStatus } from "@/lib/money/categories";

/** A problem the money UI can show verbatim, e.g. "That date is outside the trip." */
export class MoneyError extends Error {}

/** Paise, not rupees: the actions do the parsing so the ledger never sees text. */
export type CreateExpenseInput = {
  amountPaise: number;
  category: Enums<"expense_category">;
  note?: string;
  spentOn: string;
  payerId: string;
  splitWith: string[];
};

export type CreateSettlementInput = {
  fromMemberId: string;
  toMemberId: string;
  amountPaise: number;
};

/**
 * Past trips are read-only, same rule as the plan and the map: a trip whose
 * last day has passed no longer takes edits.
 */
function assertTripEditable(context: SessionContext): void {
  if (tripHasEnded(context.trip.end_date)) {
    throw new MoneyError(
      `"${context.trip.name}" is over, so the ledger is read-only now.`,
    );
  }
}

export async function readMoney(tripId: string): Promise<MoneyPayload> {
  const supabase = getSupabase();

  const [members, expenses, settlements, budget] = await Promise.all([
    supabase
      .from("members")
      .select("id, display_name, role")
      .eq("trip_id", tripId)
      .order("created_at", { ascending: true }),
    supabase
      .from("expenses")
      .select("*")
      .eq("trip_id", tripId)
      .order("spent_on", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("settlements")
      .select("*")
      .eq("trip_id", tripId)
      .order("created_at", { ascending: false }),
    supabase
      .from("budgets")
      .select("*")
      .eq("trip_id", tripId)
      .maybeSingle(),
  ]);

  if (members.error) throw new MoneyError(members.error.message);
  if (expenses.error) throw new MoneyError(expenses.error.message);
  if (settlements.error) throw new MoneyError(settlements.error.message);
  if (budget.error) throw new MoneyError(budget.error.message);

  // `expense_splits` has no trip_id of its own, so the trip's rows are found
  // through the expense ids that came back with the ledger. Soft-deleted
  // expenses keep their splits: the audit trail includes who was in the split.
  const expenseIds = (expenses.data ?? []).map((expense) => expense.id);
  let splits: MoneyPayload["splits"] = [];
  if (expenseIds.length > 0) {
    const result = await supabase
      .from("expense_splits")
      .select("expense_id, member_id, share_paise")
      .in("expense_id", expenseIds);
    if (result.error) throw new MoneyError(result.error.message);
    splits = result.data ?? [];
  }

  return {
    members: (members.data ?? []).map((member) => ({
      id: member.id,
      displayName: member.display_name,
      role: member.role,
    })),
    expenses: expenses.data ?? [],
    splits,
    settlements: settlements.data ?? [],
    budget: budget.data ?? null,
  };
}

export type SetBudgetInput = {
  totalPaise: number;
  /** Only recognised expense categories survive; a zero cap means "no cap". */
  caps: Partial<Record<ExpenseCategory, number>>;
};

/**
 * Saves the whole budget in one upsert: a total to pace against plus optional
 * per-category caps. Any member can set it, same as logging an expense, and the
 * caps object is scrubbed to known categories with non-negative whole paise so
 * the script next to the JSON could never hand back a float or a stranger key.
 */
export async function setBudget(
  context: SessionContext,
  input: SetBudgetInput,
): Promise<void> {
  assertTripEditable(context);

  const totalPaise = Math.floor(input.totalPaise);
  if (!Number.isFinite(input.totalPaise) || totalPaise < 0) {
    throw new MoneyError("A budget is a number of paise, not this.");
  }

  const categoryCaps: Record<string, number> = {};
  for (const category of EXPENSE_CATEGORIES) {
    const value = input.caps[category];
    if (value === undefined) continue;
    const paise = Math.floor(value);
    if (!Number.isFinite(value) || paise < 0) {
      throw new MoneyError("A cap is a number of paise, not this.");
    }
    if (paise > 0) categoryCaps[category] = paise;
  }

  const supabase = getSupabase();
  const { error } = await supabase
    .from("budgets")
    .upsert(
      {
        trip_id: context.trip.id,
        total_paise: totalPaise,
        category_caps: categoryCaps,
      },
      { onConflict: "trip_id" },
    );
  if (error) throw new MoneyError(error.message);
}

async function assertMemberInTrip(tripId: string, memberId: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("members")
    .select("id, trip_id")
    .eq("id", memberId)
    .maybeSingle();
  if (error) throw new MoneyError(error.message);
  // A member from another trip reads as "not in this trip" so a stale client
  // cannot pay a stranger's dinner from this ledger.
  return data && data.trip_id === tripId;
}

export async function createExpense(
  context: SessionContext,
  input: CreateExpenseInput,
): Promise<string> {
  assertTripEditable(context);

  if (input.spentOn < context.trip.start_date || input.spentOn > context.trip.end_date) {
    throw new MoneyError("That date is outside the trip.");
  }
  if (!(await assertMemberInTrip(context.trip.id, input.payerId))) {
    throw new MoneyError("That payer is not in this trip.");
  }

  // Payer included by default: paying for yourself and not owing yourself is
  // the normal case, not an oversight.
  const members = new Set(input.splitWith);
  members.add(input.payerId);
  for (const memberId of members) {
    if (!(await assertMemberInTrip(context.trip.id, memberId))) {
      throw new MoneyError("One of the people in the split is not in this trip.");
    }
  }

  const shares = splitEqually(input.amountPaise, [...members]);

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("expenses")
    .insert({
      trip_id: context.trip.id,
      payer_id: input.payerId,
      amount_paise: input.amountPaise,
      category: input.category,
      note: input.note || null,
      spent_on: input.spentOn,
    })
    .select("id")
    .single();
  if (error) throw new MoneyError(error.message);

  const { error: splitError } = await supabase.from("expense_splits").insert(
    [...shares.entries()].map(([member_id, share_paise]) => ({
      expense_id: data.id,
      member_id,
      share_paise,
    })),
  );
  if (splitError) {
    // The expense row exists with no splits, so it would read as paid-by-all-free.
    // Soft-delete it rather than leave a half-written expense in the ledger.
    await supabase
      .from("expenses")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", data.id);
    throw new MoneyError(splitError.message);
  }

  return data.id;
}

async function loadExpenseForTrip(
  tripId: string,
  expenseId: string,
): Promise<{ id: string; deleted_at: string | null } | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("expenses")
    .select("id, trip_id, deleted_at")
    .eq("id", expenseId)
    .maybeSingle();
  if (error) throw new MoneyError(error.message);
  return data && data.trip_id === tripId ? data : null;
}

export async function updateExpense(
  context: SessionContext,
  expenseId: string,
  input: CreateExpenseInput,
): Promise<void> {
  assertTripEditable(context);
  const existing = await loadExpenseForTrip(context.trip.id, expenseId);
  if (!existing || existing.deleted_at) {
    throw new MoneyError("That expense is not on this trip's ledger.");
  }

  if (input.spentOn < context.trip.start_date || input.spentOn > context.trip.end_date) {
    throw new MoneyError("That date is outside the trip.");
  }
  if (!(await assertMemberInTrip(context.trip.id, input.payerId))) {
    throw new MoneyError("That payer is not in this trip.");
  }

  const members = new Set(input.splitWith);
  members.add(input.payerId);
  for (const memberId of members) {
    if (!(await assertMemberInTrip(context.trip.id, memberId))) {
      throw new MoneyError("One of the people in the split is not in this trip.");
    }
  }

  const shares = splitEqually(input.amountPaise, [...members]);
  const supabase = getSupabase();

  const { error } = await supabase
    .from("expenses")
    .update({
      payer_id: input.payerId,
      amount_paise: input.amountPaise,
      category: input.category,
      note: input.note || null,
      spent_on: input.spentOn,
    })
    .eq("id", expenseId)
    .eq("trip_id", context.trip.id);
  if (error) throw new MoneyError(error.message);

  // Shares are replaced wholesale rather than diffed: an equal split of a new
  // amount has different numbers for everyone, and "who is in this split" is a
  // single decision made in one place.
  const { error: clearError } = await supabase
    .from("expense_splits")
    .delete()
    .eq("expense_id", expenseId);
  if (clearError) throw new MoneyError(clearError.message);

  const { error: splitError } = await supabase.from("expense_splits").insert(
    [...shares.entries()].map(([member_id, share_paise]) => ({
      expense_id: expenseId,
      member_id,
      share_paise,
    })),
  );
  if (splitError) throw new MoneyError(splitError.message);
}

/** Soft delete: the row and its splits stay as the audit trail. */
export async function softDeleteExpense(
  context: SessionContext,
  expenseId: string,
): Promise<void> {
  assertTripEditable(context);
  const existing = await loadExpenseForTrip(context.trip.id, expenseId);
  if (!existing) throw new MoneyError("That expense is not on this trip's ledger.");
  if (existing.deleted_at) return;

  const supabase = getSupabase();
  const { error } = await supabase
    .from("expenses")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", expenseId)
    .eq("trip_id", context.trip.id);
  if (error) throw new MoneyError(error.message);
}

export async function createSettlement(
  context: SessionContext,
  input: CreateSettlementInput,
): Promise<string> {
  assertTripEditable(context);
  if (input.fromMemberId === input.toMemberId) {
    throw new MoneyError("You cannot settle up with yourself.");
  }
  if (!(await assertMemberInTrip(context.trip.id, input.fromMemberId))) {
    throw new MoneyError("That payer is not in this trip.");
  }
  if (!(await assertMemberInTrip(context.trip.id, input.toMemberId))) {
    throw new MoneyError("That person is not in this trip.");
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("settlements")
    .insert({
      trip_id: context.trip.id,
      from_member: input.fromMemberId,
      to_member: input.toMemberId,
      amount_paise: input.amountPaise,
      status: "pending",
    })
    .select("id")
    .single();
  if (error) throw new MoneyError(error.message);
  return data.id;
}

const SETTLEMENT_STATUSES: SettlementStatus[] = ["pending", "paid", "confirmed"];

/**
 * Moving a settlement along is allowed for the two people in it and for the trip
 * owner, because the person who received the money is the one who can say it
 * arrived. A `pending` settlement is a promise, so only paid and confirmed move
 * money in the balances.
 */
export async function setSettlementStatus(
  context: SessionContext,
  settlementId: string,
  status: SettlementStatus,
): Promise<void> {
  assertTripEditable(context);
  if (!SETTLEMENT_STATUSES.includes(status)) {
    throw new MoneyError("That status is not a thing.");
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("settlements")
    .select("id, trip_id, from_member, to_member")
    .eq("id", settlementId)
    .maybeSingle();
  if (error) throw new MoneyError(error.message);
  if (!data || data.trip_id !== context.trip.id) {
    throw new MoneyError("That settlement is not on this trip's ledger.");
  }

  const involved =
    data.from_member === context.member.id || data.to_member === context.member.id;
  if (!involved && context.member.role !== "owner") {
    throw new MoneyError("Only the two of you or the trip owner can mark this paid.");
  }

  const { error: updateError } = await supabase
    .from("settlements")
    .update({ status })
    .eq("id", settlementId)
    .eq("trip_id", context.trip.id);
  if (updateError) throw new MoneyError(updateError.message);
}