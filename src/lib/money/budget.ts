import type { Enums, Tables } from "@/lib/db/types";
import {
  EXPENSE_CATEGORIES,
  type ExpenseCategory,
} from "@/lib/money/categories";
import type { MoneyPayload } from "@/lib/money/balances";

/**
 * Budget arithmetic on integer paise, mirroring the balances module: computed
 * from the ledger, never stored, so the page and the 5s poll draw the same
 * bars. Client-safe so the budget window can use it without a server.
 */

export type BudgetRow = Tables<"budgets">;

export type CategoryCap = {
  category: ExpenseCategory;
  capPaise: number;
};

/**
 * The stored `category_caps` JSON is just allowed to be a JSON object, so the
 * shape is read defensively: unknown keys, negative numbers and nonsense are
 * dropped, and leftover keys that no longer match a real category disappear.
 */
export function capsOf(budget: BudgetRow | null): CategoryCap[] {
  const raw = typeof budget?.category_caps === "object"
    ? (budget.category_caps as Record<string, unknown>)
    : {};
  const recognised = new Set<string>(EXPENSE_CATEGORIES);
  const caps = new Map<ExpenseCategory, number>();
  for (const [key, value] of Object.entries(raw)) {
    if (!recognised.has(key)) continue;
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    const paise = Math.floor(value);
    if (paise < 0) continue;
    caps.set(key as ExpenseCategory, paise);
  }
  return EXPENSE_CATEGORIES.filter((category) => caps.has(category)).map(
    (category) => ({ category, capPaise: caps.get(category) ?? 0 }),
  );
}

function spentForCategory(payload: MoneyPayload, category: Enums<"expense_category">): number {
  return payload.expenses
    .filter((expense) => !expense.deleted_at && expense.category === category)
    .reduce((total, expense) => total + expense.amount_paise, 0);
}

export type BudgetLine = {
  category: ExpenseCategory;
  capPaise: number;
  spentPaise: number;
  /** Negative means the cap is blown; the window shows `overPaise`. */
  remainingPaise: number;
  overPaise: number;
};

/** One row per capped category, in the canonical category order. */
export function budgetLines(payload: MoneyPayload, budget: BudgetRow | null): BudgetLine[] {
  return capsOf(budget).map(({ category, capPaise }) => {
    const spentPaise = spentForCategory(payload, category);
    return {
      category,
      capPaise,
      spentPaise,
      remainingPaise: capPaise - spentPaise,
      overPaise: Math.max(0, spentPaise - capPaise),
    };
  });
}

export type BudgetTotals = {
  totalPaise: number;
  spentPaise: number;
  remainingPaise: number;
  overPaise: number;
};

export function budgetTotals(payload: MoneyPayload, budget: BudgetRow | null): BudgetTotals {
  const totalPaise = Math.max(0, budget?.total_paise ?? 0);
  const spentPaise = payload.expenses
    .filter((expense) => !expense.deleted_at)
    .reduce((total, expense) => total + expense.amount_paise, 0);
  return {
    totalPaise,
    spentPaise,
    remainingPaise: totalPaise - spentPaise,
    overPaise: Math.max(0, spentPaise - totalPaise),
  };
}

/** Guarded division so a zero total renders a bar-less "of ₹0" instead of a NaN. */
export function ratioPaise(spentPaise: number, capPaise: number): number {
  if (capPaise <= 0) return 0;
  return Math.min(1, Math.max(0, spentPaise / capPaise));
}