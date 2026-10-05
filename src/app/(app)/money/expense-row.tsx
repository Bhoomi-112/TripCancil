"use client";

import { useActionState, useEffect, useState } from "react";
import { useSWRConfig } from "swr";
import { Button, IconButton } from "@/components/ui/button";
import { PencilIcon, TrashIcon } from "@/components/ui/icons";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { idleState } from "@/lib/actions/state";
import { isMoneyKey, type MoneyExpense } from "@/lib/money/balances";
import { CATEGORY_COLOURS, CATEGORY_LABELS } from "@/lib/money/categories";
import { describeSplit, formatPaise } from "@/lib/money/paise";
import { deleteExpenseAction } from "./actions";

type Props = {
  expense: MoneyExpense;
  /** member id -> their share of this expense. */
  shares: Map<string, number>;
  names: Map<string, string>;
  viewerId: string;
  editable: boolean;
  onEdit: (expense: MoneyExpense, sharerIds: string[]) => void;
};

export function ExpenseRow({
  expense,
  shares,
  names,
  viewerId,
  editable,
  onEdit,
}: Props) {
  const [state, remove, removing] = useActionState(deleteExpenseAction, idleState);
  const [confirming, setConfirming] = useState(false);
  const { mutate } = useSWRConfig();
  const toast = useToast();

  useEffect(() => {
    if (!state.ok) return;
    toast.success("Removed. The row stays as an audit trail.");
    void mutate(isMoneyKey);
  }, [state, mutate, toast]);

  const label = expense.note?.trim() || CATEGORY_LABELS[expense.category];
  const payer = expense.payer_id === viewerId ? "You" : (names.get(expense.payer_id) ?? "Someone");
  const title = `${payer} paid`;

  return (
    <div className="flex items-center gap-2 rounded-2xl border-2 border-silver-deep bg-white/70 px-3 py-2.5 sm:gap-3">
      <span
        className="size-3 shrink-0 rounded-full border border-ink/20"
        style={{ background: CATEGORY_COLOURS[expense.category] }}
        aria-hidden="true"
      />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-extrabold text-ink">{label}</p>
        <p className="truncate text-[11px] font-semibold text-ink-soft">
          {title} · {describeSplit(expense.amount_paise, shares, names)}
        </p>
      </div>

      <p className="shrink-0 font-display text-xs text-ink">
        {formatPaise(expense.amount_paise)}
      </p>

      {editable ? (
        <div className="flex shrink-0 gap-1">
          <IconButton
            label={`Edit ${label}`}
            variant="ghost"
            size="sm"
            onClick={() => onEdit(expense, [...shares.keys()])}
          >
            <PencilIcon className="size-4" />
          </IconButton>
          <IconButton
            label={`Remove ${label}`}
            variant="ghost"
            size="sm"
            onClick={() => setConfirming(true)}
          >
            <TrashIcon className="size-4" />
          </IconButton>
        </div>
      ) : null}

      <Modal
        // Closes on its own once the action succeeds, rather than an effect
        // reaching in to flip state.
        open={confirming && !state.ok}
        onClose={() => setConfirming(false)}
        title="Remove this expense?"
        description={`${label} · ${formatPaise(expense.amount_paise)}`}
        size="sm"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
              Keep it
            </Button>
            <Button
              type="submit"
              form="delete-expense"
              variant="danger"
              size="sm"
              loading={removing}
            >
              Remove
            </Button>
          </>
        }
      >
        <form id="delete-expense" action={remove} className="flex flex-col gap-2">
          <input type="hidden" name="expenseId" value={expense.id} />
          <p className="text-sm font-semibold text-ink-soft">
            Balances drop it, but the row stays in the database so the ledger cannot be
            quietly rewritten later.
          </p>
          {state.error ? (
            <p className="text-xs font-extrabold text-hotpink-deep">{state.error}</p>
          ) : null}
        </form>
      </Modal>
    </div>
  );
}