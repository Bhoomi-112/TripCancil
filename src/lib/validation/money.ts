import { z } from "zod";
import { EXPENSE_CATEGORIES, SETTLEMENT_STATUSES } from "@/lib/money/categories";

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
});
export type ExpenseFormInput = z.infer<typeof expenseSchema>;

export const settlementSchema = z.object({
  fromMemberId: z.string().uuid(),
  toMemberId: z.string().uuid("Pick who gets paid"),
  amountRupees: z
    .string()
    .trim()
    .min(1, "How much is being paid?")
    .max(20, "That amount is too long"),
});
export type SettlementFormInput = z.infer<typeof settlementSchema>;

export const settlementStatusSchema = z.object({
  settlementId: z.string().uuid(),
  status: z.enum(SETTLEMENT_STATUSES),
});