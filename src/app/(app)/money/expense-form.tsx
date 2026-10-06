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
import { formatPaise, parsePaise, splitEqually } from "@/lib/money/paise";
import { shareFieldName } from "@/lib/validation/money";
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
  /** The saved paise per person, present only while editing a custom split. */
  sharesById?: Map<string, number>;
  onClose: () => void;
};

type SplitMode = "equal" | "share";

/** The rupee text a controlled share input shows, e.g. 450000 -> "4500". */
function paiseToRupeeText(paise: number): string {
  return (paise / 100).toFixed(2).replace(/\.00$/, "");
}

export function ExpenseForm({
  members,
  startDate,
  endDate,
  today,
  viewerId,
  expense,
  splitMemberIds,
  sharesById,
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
    expense
      ? sharesById
        ? [...sharesById.keys()]
        : splitMemberIds ?? members.map((member) => member.id)
      : members.map((member) => member.id),
  );

  // Editing an expense that was split unevenly opens straight back into the
  // share boxes with the saved numbers; everything else splits equally.
  const [splitMode, setSplitMode] = useState<SplitMode>(() => {
    if (!expense || !sharesById) return "equal";
    const values = [...sharesById.values()];
    return values.some((value) => value !== values[0]) ? "share" : "equal";
  });
  const [shareText, setShareText] = useState<Record<string, string>>(() => {
    if (!expense || !sharesById) return {};
    return Object.fromEntries(
      [...sharesById.entries()].map(([memberId, paise]) => [
        memberId,
        paiseToRupeeText(paise),
      ]),
    );
  });

  useEffect(() => {
    if (!state.ok) return;
    toast.success(editing ? "Expense updated." : "Expense logged.");
    void mutate(isMoneyKey);
    onClose();
  }, [state, editing, mutate, onClose, toast]);

  const memberById = useMemo(
    () => new Map(members.map((member) => [member.id, member])),
    [members],
  );
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
    if (splitMode !== "equal" || !amount || sharers.length === 0) return null;
    const shares = [...splitEqually(amount, sharers).values()];
    const low = Math.min(...shares);
    const high = Math.max(...shares);
    return low === high ? formatPaise(low) : `${formatPaise(low)}–${formatPaise(high)}`;
  }, [splitMode, amount, sharers]);

  // Live read of the share boxes so the sum never surprises the server.
  const shareTally = useMemo(() => {
    let placed = 0;
    let filled = 0;
    const values = new Map<string, number | null>();
    for (const memberId of sharers) {
      const text = (shareText[memberId] ?? "").trim();
      if (text === "") {
        values.set(memberId, null);
        continue;
      }
      const paise = text === "0" ? 0 : parsePaise(text);
      values.set(memberId, paise);
      if (paise !== null) {
        placed += paise;
        filled += 1;
      }
    }
    return { placed, filled, values };
  }, [shareText, sharers]);

  function enterShareMode() {
    setSplitMode("share");
    const base = amount ? splitEqually(amount, sharers) : new Map(sharers.map((id) => [id, 0]));
    setShareText(
      Object.fromEntries([...base.entries()].map(([memberId, paise]) => [memberId, paiseToRupeeText(paise)])),
    );
  }

  function setShare(memberId: string, text: string) {
    setShareText((current) => ({ ...current, [memberId]: text }));
  }

  function toggle(id: string) {
    const alreadyOn = splitWith.includes(id);
    const next = alreadyOn ? splitWith.filter((memberId) => memberId !== id) : [...splitWith, id];
    setSplitWith(next);

    if (splitMode === "share") {
      if (alreadyOn) {
        // A box was unticked: that person's share leaves the form with them.
        setShareText((current) => {
          const rest: Record<string, string> = {};
          for (const [memberId, text] of Object.entries(current)) {
            if (memberId !== id) rest[memberId] = text;
          }
          return rest;
        });
      } else {
        // A person who just joined the split owes an equal cut, pre-filled so
        // the form never slams a blank share box into the action.
        const prospective = [...new Set([...next, payerId])];
        const share = amount ? splitEqually(amount, prospective).get(id) ?? 0 : 0;
        setShareText((current) => ({ ...current, [id]: paiseToRupeeText(share) }));
      }
    }
  }

  const sumLine = useMemo(() => {
    if (amount === null) return "Set the amount first — the shares add up to it.";
    const left = amount - shareTally.placed;
    if (left === 0 && shareTally.filled === sharers.length) {
      return `All ${formatPaise(amount)} placed.`;
    }
    if (left > 0) return `${formatPaise(shareTally.placed)} of ${formatPaise(amount)} placed · ${formatPaise(left)} left`;
    return `Over by ${formatPaise(-left)} — shares can't top the amount.`;
  }, [amount, shareTally.placed, shareTally.filled, sharers.length]);

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? "Edit expense" : "Log an expense"}
      description="Equal or custom shares, paise only. You can snap a photo of the bill later."
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
        <input type="hidden" name="splitMode" value={splitMode} />

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

        <div className="flex gap-1 rounded-full border-2 border-silver-deep bg-white/60 p-0.5">
          <button
            type="button"
            onClick={() => setSplitMode("equal")}
            className={cn(
              "flex-1 rounded-full py-1 font-display text-[9px] uppercase tracking-tight transition-colors",
              splitMode === "equal"
                ? "bg-electric text-white shadow-sticker"
                : "text-ink-soft hover:text-ink",
            )}
          >
            Equally
          </button>
          <button
            type="button"
            onClick={enterShareMode}
            className={cn(
              "flex-1 rounded-full py-1 font-display text-[9px] uppercase tracking-tight transition-colors",
              splitMode === "share"
                ? "bg-hotpink text-white shadow-sticker"
                : "text-ink-soft hover:text-ink",
            )}
          >
            By share
          </button>
        </div>

        {splitMode === "equal" ? (
          <p className="text-xs font-semibold text-ink-soft">
            {sharers.length} {sharers.length === 1 ? "person" : "people"}
            {preview ? ` · ${preview} each` : ""}
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {sharers.map((memberId) => {
              const member = memberById.get(memberId);
              const field = shareFieldName(memberId);
              const invalid = Boolean(state.fieldErrors?.[field]);
              return (
                <div key={memberId}>
                  <div className="flex items-center gap-2">
                    <Avatar name={member?.displayName ?? "?"} size="xs" />
                    <span className="w-24 truncate font-display text-[9px] uppercase tracking-tight text-ink">
                      {member
                        ? member.id === viewerId
                          ? "You"
                          : member.displayName
                        : "Someone"}
                    </span>
                    <div className="relative flex-1">
                      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm font-black text-ink-soft">
                        ₹
                      </span>
                      <Input
                        type="text"
                        inputMode="decimal"
                        name={field}
                        value={shareText[memberId] ?? ""}
                        onChange={(event) => setShare(memberId, event.target.value)}
                        placeholder="0"
                        invalid={invalid}
                        className="pl-8 text-right"
                        aria-label={`${member?.displayName ?? "Someone"}'s share`}
                      />
                    </div>
                  </div>
                  {invalid ? (
                    <p className="mt-0.5 text-xs font-extrabold text-hotpink-deep">
                      {state.fieldErrors?.[field]}
                    </p>
                  ) : null}
                </div>
              );
            })}
            <p
              className={cn(
                "text-xs font-semibold",
                shareTally.placed === amount ? "text-lime-deep" : "text-ink-soft",
              )}
            >
              {sumLine}
            </p>
          </div>
        )}

        {state.error ? (
          <p className="text-xs font-extrabold text-hotpink-deep">{state.error}</p>
        ) : null}
      </form>
    </Modal>
  );
}