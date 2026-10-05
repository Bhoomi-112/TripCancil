"use client";

import { useActionState, useEffect, useRef } from "react";
import { useSWRConfig } from "swr";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { idleState } from "@/lib/actions/state";
import { isMoneyKey, type MoneySettlement } from "@/lib/money/balances";
import {
  SETTLEMENT_STATUS_LABELS,
  type SettlementStatus,
} from "@/lib/money/categories";
import { formatPaise } from "@/lib/money/paise";
import { setSettlementStatusAction } from "./actions";

type Props = {
  settlement: MoneySettlement;
  names: Map<string, string>;
  viewerId: string;
  isOwner: boolean;
  editable: boolean;
};

const BADGE_TONE: Record<SettlementStatus, "sunny" | "pop" | "bubble"> = {
  pending: "sunny",
  paid: "pop",
  confirmed: "bubble",
};

/**
 * The move along is deliberately a button rather than a dropdown: money that
 * moved and money that was promised are the two things a group argues about, and
 * they should never be one tap apart by accident.
 */
export function SettlementRow({
  settlement,
  names,
  viewerId,
  isOwner,
  editable,
}: Props) {
  const [state, mark, marking] = useActionState(
    setSettlementStatusAction,
    idleState,
  );
  const { mutate } = useSWRConfig();
  const toast = useToast();
  const announced = useRef(false);

  useEffect(() => {
    if (!state.ok || announced.current) return;
    announced.current = true;
    toast.success(
      settlement.status === "pending"
        ? "Marked as paid."
        : settlement.status === "paid"
          ? "Settled for good."
          : "Reopened.",
    );
    void mutate(isMoneyKey);
  }, [state, mutate, toast, settlement.status]);

  const from = names.get(settlement.from_member) ?? "Someone";
  const to = names.get(settlement.to_member) ?? "Someone";
  const involved =
    settlement.from_member === viewerId || settlement.to_member === viewerId;
  const mayAct = editable && (involved || isOwner);

  const next: { status: SettlementStatus; label: string } | null =
    settlement.status === "pending"
      ? { status: "paid", label: "Mark paid" }
      : settlement.status === "paid"
        ? { status: "confirmed", label: "Confirm settled" }
        : null;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border-2 border-silver-deep bg-white/70 px-3 py-2">
      <Avatar name={from} size="xs" />
      <span className="font-display text-[9px] uppercase tracking-tight text-ink">
        {settlement.from_member === viewerId ? "You" : from}
      </span>
      <span className="text-ink-soft">paid</span>
      <Avatar name={to} size="xs" />
      <span className="font-display text-[9px] uppercase tracking-tight text-ink">
        {settlement.to_member === viewerId ? "you" : to}
      </span>

      <span className="ml-auto font-display text-xs text-ink">
        {formatPaise(settlement.amount_paise)}
      </span>

      <Badge tone={BADGE_TONE[settlement.status]}>
        {SETTLEMENT_STATUS_LABELS[settlement.status]}
      </Badge>

      {mayAct && next ? (
        <button
          type="submit"
          form={`settle-${settlement.id}`}
          disabled={marking}
          className={buttonClass({
            variant: settlement.status === "pending" ? "pop" : "chrome",
            size: "sm",
          })}
        >
          {next.label}
        </button>
      ) : null}

      {mayAct && settlement.status !== "pending" ? (
        <button
          type="submit"
          form={`reopen-${settlement.id}`}
          disabled={marking}
          className={buttonClass({ variant: "ghost", size: "sm" })}
        >
          Undo
        </button>
      ) : null}

      <form id={`settle-${settlement.id}`} action={mark}>
        <input type="hidden" name="settlementId" value={settlement.id} />
        <input type="hidden" name="status" value={next?.status ?? "paid"} />
      </form>
      <form id={`reopen-${settlement.id}`} action={mark}>
        <input type="hidden" name="settlementId" value={settlement.id} />
        <input type="hidden" name="status" value="pending" />
      </form>

      {state.error ? (
        <p className="w-full text-xs font-extrabold text-hotpink-deep">{state.error}</p>
      ) : null}
    </div>
  );
}