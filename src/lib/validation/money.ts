import { z } from "zod";
import { EXPENSE_CATEGORIES, SETTLEMENT_STATUSES } from "@/lib/money/categories";
import { MAX_UPI_ID_LENGTH } from "@/lib/money/payment-qr-limits";

export { CATEGORY_LABELS, EXPENSE_CATEGORIES } from "@/lib/money/categories";

/** A checkbox list arrives as repeated fields; nonsense ids are dropped. */
const splitWithSchema = z
  .union([z.string(), z.array(z.string())])
  .transform((value) => (Array.isArray(value) ? value : [value]))
  .transform((values) =>
    values.filter((id) => z.string().uuid().safeParse(id).success),
  );

export const expenseSchema = z.object({
  amountRupees: z
    .string()
    .trim()
    .min(1, "How much was it?")
    .max(20, "That amount is too long"),
  category: z.enum(EXPENSE_CATEGORIES),
  note: z.string().trim().max(80).optional(),
  spentOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
  payerId: z.string().uuid("Pick who paid"),
  splitWith: splitWithSchema,
  /** "equal" splits the amount for everyone; "share" sends one `share-<id>` field per person. */
  splitMode: z.enum(["equal", "share"]).default("equal"),
});
export type ExpenseFormInput = z.infer<typeof expenseSchema>;

/** The hidden share field a custom split posts under, e.g. `share-<uuid>`. */
export function shareFieldName(memberId: string): string {
  return `share-${memberId}`;
}

export const settlementSchema = z.object({
  fromMemberId: z.string().uuid(),
  toMemberId: z.string().uuid("Pick who gets paid"),
  amountRupees: z
    .string()
    .trim()
    .min(1, "How much is being paid?")
    .max(20, "That amount is too long"),
  /**
   * `promise` logs a pending settlement; `paid` is the payer saying the money
   * already left their account. The service refuses a `paid` that does not come
   * from the payer, so the field is a claim, never a privilege.
   */
  intent: z.enum(["promise", "paid"]).default("promise"),
});
export type SettlementFormInput = z.infer<typeof settlementSchema>;

export const settlementStatusSchema = z.object({
  settlementId: z.string().uuid(),
  status: z.enum(SETTLEMENT_STATUSES),
});

export const budgetSchema = z.object({
  totalRupees: z
    .string()
    .trim()
    .min(1, "How much is the trip worth?")
    .max(20, "That budget is too long"),
});
export type BudgetFormInput = z.infer<typeof budgetSchema>;

/** Returns the cap field name a category posts under, e.g. `cap-stay`. */
export function capFieldName(category: (typeof EXPENSE_CATEGORIES)[number]): string {
  return `cap-${category}`;
}

/**
 * The UPI handle a member types next to their stored QR. Blank clears it; the
 * length bounds match the database check, so a rejected value never gets far
 * enough to look like a database error.
 */
export const upiIdSchema = z.object({
  upiId: z
    .string()
    .trim()
    .max(MAX_UPI_ID_LENGTH, "That UPI ID is too long")
    .optional(),
});
export type UpiIdFormInput = z.infer<typeof upiIdSchema>;