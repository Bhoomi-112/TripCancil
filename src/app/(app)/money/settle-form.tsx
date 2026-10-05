"use client";

import { useActionState, useEffect, useState } from "react";
import { useSWRConfig } from "swr";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { idleState } from "@/lib/actions/state";
import { isMoneyKey, type MoneyMember } from "@/lib/money/balances";
import { formatPaise } from "@/lib/money/paise";
import { createSettlementAction } from "./actions";
import { AmountInput } from "./amount-input";

type Props = {
  members: MoneyMember[];
  viewerId: string;
  fromMemberId: string;
  toMemberId: string;
  amountPaise?: number;
  onClose: () => void;
};

/**
 * Records a promise to pay, not the payment. It lands as `pending`, which moves
 * no money in the balances; marking it paid or settled is a separate tap, so a
 * claimed-but-not-sent UPI request cannot quietly rewrite the ledger.
 */
export function SettleForm({
  members,
  viewerId,
  fromMemberId,
  toMemberId,
  amountPaise,
  onClose,
}: Props) {
  const [state, create, creating] = useActionState(createSettlementAction, idleState);
  const { mutate } = useSWRConfig();
  const toast = useToast();
  const [amount, setAmount] = useState<number | null>(amountPaise ?? null);

  const [from, setFrom] = useState(fromMemberId);
  const [to, setTo] = useState(toMemberId);
  const nameOf = (id: string) =>
    members.find((member) => member.id === id)?.displayName ?? "someone";

  useEffect(() => {
    if (!state.ok) return;
    toast.success(`Promise to pay ${nameOf(to)} logged.`);
    void mutate(isMoneyKey);
    onClose();
  }, [state, mutate, onClose, toast]); // eslint-disable-line react-hooks/exhaustive-deps

  function changePayer(id: string) {
    setFrom(id);
    // Nobody settles up with themselves, so a swap swaps the other end too.
    if (id === to) {
      setTo(fromMemberId === id ? toMemberId : fromMemberId);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Settle up"
      description="Logs a promise first. Mark it paid once the money actually moves."
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="settle-form" variant="pop" size="sm" loading={creating}>
            Log promise
          </Button>
        </>
      }
    >
      <form id="settle-form" action={create} className="flex flex-col gap-3">
        <AmountInput
          name="amountRupees"
          error={state.fieldErrors?.amountRupees}
          defaultValue={amountPaise ? formatPaise(amountPaise).replace("₹", "") : ""}
          onValueChange={setAmount}
          autoFocus
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Who is paying">
            <Select name="fromMemberId" value={from} onChange={(event) => changePayer(event.target.value)}>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.id === viewerId
                    ? `${member.displayName} (you)`
                    : member.displayName}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Who gets paid" error={state.fieldErrors?.toMemberId}>
            <Select name="toMemberId" value={to} onChange={(event) => setTo(event.target.value)}>
              {members
                .filter((member) => member.id !== from)
                .map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.id === viewerId
                      ? `${member.displayName} (you)`
                      : member.displayName}
                  </option>
                ))}
            </Select>
          </Field>
        </div>

        <div className="flex items-center gap-2 rounded-2xl border-2 border-dashed border-silver-deep bg-white/60 px-3 py-2">
          <Avatar name={nameOf(from)} size="xs" />
          <span className="font-display text-[9px] uppercase tracking-tight text-ink">
            {from === viewerId ? "You" : nameOf(from)}
          </span>
          <span className="text-ink-soft">pays</span>
          <Avatar name={nameOf(to)} size="xs" />
          <span className="font-display text-[9px] uppercase tracking-tight text-ink">
            {to === viewerId ? "you" : nameOf(to)}
          </span>
          {amount ? (
            <span className="ml-auto font-extrabold text-electric">
              {formatPaise(amount)}
            </span>
          ) : null}
        </div>

        {state.error ? (
          <p className="text-xs font-extrabold text-hotpink-deep">{state.error}</p>
        ) : null}
      </form>
    </Modal>
  );
}