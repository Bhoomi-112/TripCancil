"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useSWRConfig } from "swr";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { idleState } from "@/lib/actions/state";
import { cn } from "@/lib/cn";
import { isMoneyKey, type MoneyExpense, type MoneyMember } from "@/lib/money/balances";
import {
  CATEGORY_LABELS,
  EXPENSE_CATEGORIES,
} from "@/lib/money/categories";
import { formatPaise, splitEqually } from "@/lib/money/paise";
import { createExpenseAction, updateExpenseAction } from "./actions";
import { AmountInput } from "./amount-input";

type Props = {
  members: MoneyMember[];
  startDate: string;
  endDate: string;
  today: string;
  viewerId: string;
  expense?: MoneyExpense;
  /** Who the expense was already split between, so an edit never changes that by accident. */
  splitMemberIds?: string[];
  onClose: () => void;
};

export function ExpenseForm({
  members,
  startDate,
  endDate,
  today,
  viewerId,
  expense,
  splitMemberIds,
  onClose,
}: Props) {
  const editing = Boolean(expense);
  const [createState, create, creating] = useActionState(
    createExpenseAction,
    idleState,
  );
  const [updateState, update, updating] = useActionState(
    updateExpenseAction,
    idleState,
  );
  const state = editing ? updateState : createState;
  const pending = editing ? updating : creating;

  const { mutate } = useSWRConfig();
  const toast = useToast();
  const [amount, setAmount] = useState<number | null>(expense?.amount_paise ?? null);

  const [payerId, setPayerId] = useState(expense?.payer_id ?? viewerId);
  const [splitWith, setSplitWith] = useState<string[]>(() =>
    expense ? (splitMemberIds ?? members.map((member) => member.id)) : members.map((member) => member.id),
  );

  useEffect(() => {
    if (!state.ok) return;
    toast.success(editing ? "Expense updated." : "Expense logged.");
    void mutate(isMoneyKey);
    onClose();
  }, [state, editing, mutate, onClose, toast]);

  const everyone = useMemo(
    () => members.map((member) => member.id).sort(),
    [members],
  );
  const everyoneOn = splitWith.length === members.length;

  // Mirrors the service: the payer is always in the split, even if every box was
  // cleared, so the preview never disagrees with what gets saved.
  const sharers = useMemo(
    () => [...new Set([...splitWith, payerId])].sort(),
    [splitWith, payerId],
  );

  const preview = useMemo(() => {
    if (!amount || sharers.length === 0) return null;
    const shares = [...splitEqually(amount, sharers).values()];
    const low = Math.min(...shares);
    const high = Math.max(...shares);
    return low === high ? formatPaise(low) : `${formatPaise(low)}–${formatPaise(high)}`;
  }, [amount, sharers]);

  function toggle(id: string) {
    setSplitWith((current) =>
      current.includes(id)
        ? current.filter((memberId) => memberId !== id)
        : [...current, id],
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? "Edit expense" : "Log an expense"}
      description="Paise only, split equally. Receipts arrive with the documents prompt."
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="expense-form"
            variant={editing ? "chrome" : "pop"}
            size="sm"
            loading={pending}
          >
            {editing ? "Save changes" : "Log it"}
          </Button>
        </>
      }
    >
      <form
        id="expense-form"
        action={editing ? update : create}
        className="flex flex-col gap-3"
      >
        {editing ? <input type="hidden" name="expenseId" value={expense?.id} /> : null}

        <AmountInput
          name="amountRupees"
          error={state.fieldErrors?.amountRupees}
          defaultValue={expense ? formatPaise(expense.amount_paise).replace("₹", "") : ""}
          onValueChange={setAmount}
          autoFocus
        />

        <Field label="Category">
          <Select name="category" defaultValue={expense?.category ?? "food"}>
            {EXPENSE_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {CATEGORY_LABELS[category]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="What was it" hint="Optional. Chai, petrol, the van…">
          <Input
            name="note"
            defaultValue={expense?.note ?? ""}
            maxLength={80}
            placeholder="Evening chai run"
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Paid by">
            <Select
              name="payerId"
              value={payerId}
              onChange={(event) => setPayerId(event.target.value)}
            >
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.id === viewerId
                    ? `${member.displayName} (you)`
                    : member.displayName}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Spent on"
            hint={`Between ${startDate} and ${endDate}`}
            error={state.fieldErrors?.spentOn}
          >
            <Input
              type="date"
              name="spentOn"
              defaultValue={expense?.spent_on ?? today}
              min={startDate}
              max={endDate}
            />
          </Field>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="font-display text-[9px] uppercase tracking-tight text-ink-soft">
              Split between
            </p>
            <button
              type="button"
              onClick={() => setSplitWith(everyoneOn ? [] : everyone)}
              className="rounded-full px-2 py-1 font-display text-[9px] uppercase tracking-tight text-electric underline-offset-2 hover:underline"
            >
              {everyoneOn ? "Clear all" : "Everyone"}
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {members.map((member) => {
              const on = splitWith.includes(member.id);
              return (
                <label
                  key={member.id}
                  className={cn(
                    "flex cursor-pointer items-center gap-1.5 rounded-full border-2 py-1 pl-1 pr-3 transition-transform duration-150 active:scale-[0.98]",
                    on
                      ? "border-ink bg-white shadow-sticker"
                      : "border-silver-deep bg-white/50",
                  )}
                >
                  <input
                    type="checkbox"
                    name="splitWith"
                    value={member.id}
                    checked={on}
                    onChange={() => toggle(member.id)}
                    className="sr-only"
                  />
                  <Avatar name={member.displayName} size="xs" />
                  <span className="font-display text-[9px] uppercase tracking-tight text-ink">
                    {member.id === viewerId ? "You" : member.displayName}
                  </span>
                </label>
              );
            })}
          </div>

          <p className="text-xs font-semibold text-ink-soft">
            {sharers.length} {sharers.length === 1 ? "person" : "people"}
            {preview ? ` · ${preview} each` : ""}
          </p>
        </div>

        {state.error ? (
          <p className="text-xs font-extrabold text-hotpink-deep">{state.error}</p>
        ) : null}
      </form>
    </Modal>
  );
}