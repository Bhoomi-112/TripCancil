"use server";

import { revalidatePath } from "next/cache";
import { failed, runAction, type ActionState } from "@/lib/actions/state";
import { requireSession } from "@/lib/auth/context";
import { parsePaise } from "@/lib/money/paise";
import {
  createExpense,
  createSettlement,
  setSettlementStatus,
  softDeleteExpense,
  updateExpense,
} from "@/lib/money/service";
import { formToObject } from "@/lib/validation/auth";
import {
  expenseSchema,
  settlementSchema,
  settlementStatusSchema,
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
};

function readExpenseInput(
  formData: FormData,
): { input: ExpenseInput; error?: ActionState } {
  const parsed = expenseSchema.safeParse({
    ...formToObject(formData),
    splitWith: formData.getAll("splitWith"),
  });

  if (!parsed.success) {
    return {
      input: { amountPaise: 0, category: "other", spentOn: "", payerId: "", splitWith: [] },
      error: failed(
        "That expense could not be read.",
        parsed.error.flatten().fieldErrors as Record<string, string>,
      ),
    };
  }

  const amountPaise = parsePaise(parsed.data.amountRupees);
  if (amountPaise === null) {
    return {
      input: { amountPaise: 0, category: "other", spentOn: "", payerId: "", splitWith: [] },
      error: failed("That amount is not money.", {
        amountRupees: "Try something like 1,200.50",
      }),
    };
  }

  return {
    input: {
      amountPaise,
      category: parsed.data.category,
      note: parsed.data.note,
      spentOn: parsed.data.spentOn,
      payerId: parsed.data.payerId,
      splitWith: parsed.data.splitWith,
    },
  };
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