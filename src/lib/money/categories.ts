/**
 * Expense categories and their colours. Client-safe and dependency-free so the
 * ledger, the expense form and the validation schemas all read the same list
 * without importing each other.
 */

export const EXPENSE_CATEGORIES = [
  "food",
  "stay",
  "transport",
  "activities",
  "shopping",
  "other",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  food: "Food & chai",
  stay: "Stay",
  transport: "Transport",
  activities: "Activities",
  shopping: "Shopping",
  other: "Other",
};

export const CATEGORY_COLOURS: Record<ExpenseCategory, string> = {
  food: "#db2777",
  stay: "#6d28d9",
  transport: "#0369a1",
  activities: "#15803d",
  shopping: "#b45309",
  other: "#5d4c85",
};

export const SETTLEMENT_STATUSES = ["pending", "paid", "confirmed"] as const;
export type SettlementStatus = (typeof SETTLEMENT_STATUSES)[number];

export const SETTLEMENT_STATUS_LABELS: Record<SettlementStatus, string> = {
  pending: "Promised",
  paid: "Paid",
  confirmed: "Settled",
};