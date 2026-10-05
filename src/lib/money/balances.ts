import type { Enums, Tables } from "@/lib/db/types";

/**
 * Balances are computed, never stored. Everything here is pure arithmetic on
 * integer paise so the same numbers come out on the server, in the 5s poll and
 * in the browser after a write.
 */

export type MemberBalance = {
  memberId: string;
  /** What they fronted. */
  paidPaise: number;
  /** What the trip owes them for their own share. */
  sharePaise: number;
  /** Positive: the group owes them. Negative: they owe the group. */
  netPaise: number;
};

export type Transfer = {
  fromMemberId: string;
  toMemberId: string;
  amountPaise: number;
};

export type MoneyMember = {
  id: string;
  displayName: string;
  role: Enums<"member_role">;
};

export type MoneyExpense = Tables<"expenses">;
export type MoneySplit = Tables<"expense_splits">;
export type MoneySettlement = Tables<"settlements">;

/** The wire shape both the page and the polling route hand to the board. */
export type MoneyPayload = {
  members: MoneyMember[];
  expenses: MoneyExpense[];
  splits: MoneySplit[];
  settlements: MoneySettlement[];
};

function isLive(settlement: MoneySettlement): boolean {
  // A pending settlement is a promise, not a payment, so it does not move money.
  return settlement.status === "paid" || settlement.status === "confirmed";
}

/**
 * One member's position: what they paid minus what the trip owes them, with
 * settled payments already moved across. Soft-deleted expenses are excluded
 * here rather than filtered at the call site, so every view agrees.
 */
export function computeBalances(payload: MoneyPayload): MemberBalance[] {
  const splitsByExpense = new Map<string, MoneySplit[]>();
  for (const split of payload.splits) {
    const list = splitsByExpense.get(split.expense_id) ?? [];
    list.push(split);
    splitsByExpense.set(split.expense_id, list);
  }

  const balances = new Map<string, MemberBalance>();
  for (const member of payload.members) {
    balances.set(member.id, {
      memberId: member.id,
      paidPaise: 0,
      sharePaise: 0,
      netPaise: 0,
    });
  }

  for (const expense of payload.expenses) {
    if (expense.deleted_at) continue;
    const payer = balances.get(expense.payer_id);
    if (payer) payer.paidPaise += expense.amount_paise;

    // A member removed mid-trip has their splits cascade away, so a share row
    // can point at nobody: it is skipped rather than credited to the payer.
    for (const split of splitsByExpense.get(expense.id) ?? []) {
      const member = balances.get(split.member_id);
      if (member) member.sharePaise += split.share_paise;
    }
  }

  for (const settlement of payload.settlements) {
    if (!isLive(settlement)) continue;
    const from = balances.get(settlement.from_member);
    const to = balances.get(settlement.to_member);
    if (from) from.netPaise += settlement.amount_paise;
    if (to) to.netPaise -= settlement.amount_paise;
  }

  for (const balance of balances.values()) {
    balance.netPaise += balance.paidPaise - balance.sharePaise;
  }

  return [...balances.values()].sort((a, b) => b.netPaise - a.netPaise);
}

/**
 * Turns net positions into the fewest transfers that clear them: the biggest
 * debtor pays the biggest creditor until one of them is square. Six members
 * square up in at most five payments instead of fifteen.
 */
export function simplifyDebts(balances: MemberBalance[]): Transfer[] {
  const debtors = balances
    .filter((balance) => balance.netPaise < 0)
    .map((balance) => ({ id: balance.memberId, amount: -balance.netPaise }))
    .sort((a, b) => b.amount - a.amount || a.id.localeCompare(b.id));
  const creditors = balances
    .filter((balance) => balance.netPaise > 0)
    .map((balance) => ({ id: balance.memberId, amount: balance.netPaise }))
    .sort((a, b) => b.amount - a.amount || a.id.localeCompare(b.id));

  const transfers: Transfer[] = [];
  let debtor = 0;
  let creditor = 0;

  while (debtor < debtors.length && creditor < creditors.length) {
    const from = debtors[debtor];
    const to = creditors[creditor];
    const amount = Math.min(from.amount, to.amount);
    if (amount > 0) {
      transfers.push({
        fromMemberId: from.id,
        toMemberId: to.id,
        amountPaise: amount,
      });
    }
    from.amount -= amount;
    to.amount -= amount;
    if (from.amount === 0) debtor += 1;
    if (to.amount === 0) creditor += 1;
  }

  return transfers;
}

export function totalSpent(payload: MoneyPayload): number {
  return payload.expenses
    .filter((expense) => !expense.deleted_at)
    .reduce((total, expense) => total + expense.amount_paise, 0);
}

export function totalByCategory(
  payload: MoneyPayload,
): { category: Enums<"expense_category">; paise: number }[] {
  const totals = new Map<Enums<"expense_category">, number>();
  for (const expense of payload.expenses) {
    if (expense.deleted_at) continue;
    totals.set(expense.category, (totals.get(expense.category) ?? 0) + expense.amount_paise);
  }
  return [...totals.entries()]
    .map(([category, paise]) => ({ category, paise }))
    .sort((a, b) => b.paise - a.paise);
}

/** Everything the balances window needs, in one call. */
export function summarise(payload: MoneyPayload) {
  const balances = computeBalances(payload);
  return {
    totalPaise: totalSpent(payload),
    balances,
    transfers: simplifyDebts(balances),
    categories: totalByCategory(payload),
  };
}

/**
 * The SWR key the money board polls. Filter form so any form in the ledger can
 * say "re-read the numbers" without being handed the trip id.
 */
export function isMoneyKey(key: unknown): boolean {
  return (
    typeof key === "string" &&
    key.startsWith("/api/trips/") &&
    key.endsWith("/money")
  );
}

export function namesFor(payload: MoneyPayload): Map<string, string> {
  return new Map(payload.members.map((member) => [member.id, member.displayName]));
}

/** "Ravi paid" / "you paid" / "Bhoomi paid", for expense rows. */
export function payerName(
  payload: MoneyPayload,
  memberId: string,
  viewerId: string,
): string {
  if (memberId === viewerId) return "You";
  return payload.members.find((member) => member.id === memberId)?.displayName ?? "Someone";
}