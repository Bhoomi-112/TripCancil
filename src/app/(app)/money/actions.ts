"use server";

import { revalidatePath } from "next/cache";
import { failed, runAction, type ActionState } from "@/lib/actions/state";
import { requireSession } from "@/lib/auth/context";
import { EXPENSE_CATEGORIES, type ExpenseCategory } from "@/lib/money/categories";
import { formatPaise, parsePaise } from "@/lib/money/paise";
import {
  createExpense,
  createSettlement,
  setBudget,
  setSettlementStatus,
  softDeleteExpense,
  updateExpense,
} from "@/lib/money/service";
import { formToObject } from "@/lib/validation/auth";
import {
  budgetSchema,
  capFieldName,
  expenseSchema,
  settlementSchema,
  settlementStatusSchema,
  shareFieldName,
  type ExpenseFormInput,
} from "@/lib/validation/money";

/**
 * Rupees typed by a human become paise here, once, so no action ever passes a
 * float to the service and no service has to guess what "1,200" meant.
 */
type ExpenseInput = {
  amountPaise: number;
  category: ExpenseFormInput["category"];
  note?: string;
  spentOn: string;
  payerId: string;
  splitWith: string[];
  /** Present only when the form posted a custom split (splitMode = "share"). */
  shares?: Record<string, number>;
};

const EMPTY_INPUT: ExpenseInput = {
  amountPaise: 0,
  category: "other",
  spentOn: "",
  payerId: "",
  splitWith: [],
};

/**
 * Custom shares arrive as one `share-<memberId>` text field per person. Every
 * field has to parse to paise (a bare "0" counts as a free seat), the keys are
 * never trusted, and the sum must come to the exact amount or the split is
 * refused right here rather than half-saved.
 */
function readShares(
  formData: FormData,
  amountPaise: number,
  sharerIds: string[],
): { shares?: Record<string, number>; error?: ActionState } {
  const shares: Record<string, number> = {};
  const fieldErrors: Record<string, string> = {};

  for (const memberId of sharerIds) {
    const field = shareFieldName(memberId);
    const text = formData.get(field);
    if (typeof text !== "string" || text.trim() === "") {
      fieldErrors[field] = "Give every person a share.";
      continue;
    }
    if (text.trim() === "0") {
      shares[memberId] = 0;
      continue;
    }
    const paise = parsePaise(text);
    if (paise === null) {
      fieldErrors[field] = "Not money.";
      continue;
    }
    shares[memberId] = paise;
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { error: failed("Some of those shares could not be read.", fieldErrors) };
  }

  const total = Object.values(shares).reduce((sum, paise) => sum + paise, 0);
  if (total !== amountPaise) {
    return {
      error: failed(
        `The shares come to ${formatPaise(total)}, not ${formatPaise(amountPaise)}.`,
      ),
    };
  }
  return { shares };
}

function readExpenseInput(
  formData: FormData,
): { input: ExpenseInput; error?: ActionState } {
  const parsed = expenseSchema.safeParse({
    ...formToObject(formData),
    splitWith: formData.getAll("splitWith"),
  });

  if (!parsed.success) {
    return {
      input: EMPTY_INPUT,
      error: failed(
        "That expense could not be read.",
        parsed.error.flatten().fieldErrors as Record<string, string>,
      ),
    };
  }

  const amountPaise = parsePaise(parsed.data.amountRupees);
  if (amountPaise === null) {
    return {
      input: EMPTY_INPUT,
      error: failed("That amount is not money.", {
        amountRupees: "Try something like 1,200.50",
      }),
    };
  }

  const baseInput: ExpenseInput = {
    amountPaise,
    category: parsed.data.category,
    note: parsed.data.note,
    spentOn: parsed.data.spentOn,
    payerId: parsed.data.payerId,
    splitWith: parsed.data.splitWith,
  };

  // The payer is always in the split, so the form renders a share box for them
  // too; the service re-checks the same set before saving.
  const sharerIds = [...new Set([...parsed.data.splitWith, parsed.data.payerId])];
  if (parsed.data.splitMode === "share") {
    const { shares, error } = readShares(formData, amountPaise, sharerIds);
    if (error) return { input: EMPTY_INPUT, error };
    return { input: { ...baseInput, shares } };
  }

  return { input: baseInput };
}

export async function createExpenseAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const context = await requireSession();
    const { input, error } = readExpenseInput(formData);
    if (error) return error;

    const id = await createExpense(context, input);
    revalidatePath("/money");
    return { ok: true, payload: { id } };
  });
}

export async function updateExpenseAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const context = await requireSession();
    const expenseId = formData.get("expenseId");
    if (typeof expenseId !== "string" || !expenseId) {
      return failed("That expense is not on this trip's ledger.");
    }

    const { input, error } = readExpenseInput(formData);
    if (error) return error;

    await updateExpense(context, expenseId, input);
    revalidatePath("/money");
    return { ok: true };
  });
}

export async function deleteExpenseAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const context = await requireSession();
    const expenseId = formData.get("expenseId");
    if (typeof expenseId !== "string" || !expenseId) {
      return failed("That expense is not on this trip's ledger.");
    }

    await softDeleteExpense(context, expenseId);
    revalidatePath("/money");
    return { ok: true };
  });
}

export async function createSettlementAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const context = await requireSession();
    const parsed = settlementSchema.safeParse(formToObject(formData));
    if (!parsed.success) {
      return failed(
        "That payment could not be read.",
        parsed.error.flatten().fieldErrors as Record<string, string>,
      );
    }

    const amountPaise = parsePaise(parsed.data.amountRupees);
    if (amountPaise === null) {
      return failed("That amount is not money.", {
        amountRupees: "Try something like 1,200.50",
      });
    }

    await createSettlement(context, {
      fromMemberId: parsed.data.fromMemberId,
      toMemberId: parsed.data.toMemberId,
      amountPaise,
    });
    revalidatePath("/money");
    return { ok: true };
  });
}

export async function setSettlementStatusAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const context = await requireSession();
    const parsed = settlementStatusSchema.safeParse(formToObject(formData));
    if (!parsed.success) return failed("That payment could not be found.");

    await setSettlementStatus(
      context,
      parsed.data.settlementId,
      parsed.data.status,
    );
    revalidatePath("/money");
    return { ok: true };
  });
}

export async function setBudgetAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const context = await requireSession();
    const parsed = budgetSchema.safeParse(formToObject(formData));
    if (!parsed.success) {
      return failed(
        "That budget could not be read.",
        parsed.error.flatten().fieldErrors as Record<string, string>,
      );
    }

    const totalPaise = parsePaise(parsed.data.totalRupees);
    if (totalPaise === null) {
      return failed("That budget amount is not money.", {
        totalRupees: "Try something like 20,000",
      });
    }

    const caps: Partial<Record<ExpenseCategory, number>> = {};
    const fieldErrors: Record<string, string> = {};
    for (const category of EXPENSE_CATEGORIES) {
      const field = capFieldName(category);
      const text = formData.get(field);
      if (typeof text !== "string" || text.trim() === "") continue;
      const paise = parsePaise(text);
      if (paise === null) {
        fieldErrors[field] = "Not money. Leave blank to cap nothing.";
        continue;
      }
      if (paise < 0) {
        fieldErrors[field] = "A cap can't be negative.";
        continue;
      }
      caps[category] = paise;
    }

    if (Object.keys(fieldErrors).length > 0) {
      return failed("Some of those caps do not make sense.", fieldErrors);
    }

    await setBudget(context, { totalPaise, caps });
    revalidatePath("/money");
    return { ok: true };
  });
}