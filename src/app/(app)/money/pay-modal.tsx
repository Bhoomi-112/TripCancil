"use client";

import { useActionState, useEffect, useState } from "react";
import { useSWRConfig } from "swr";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { CopyIcon, SparkleIcon } from "@/components/ui/icons";
import { idleState } from "@/lib/actions/state";
import { isMoneyKey, type MoneyMember } from "@/lib/money/balances";
import { formatPaise } from "@/lib/money/paise";
import { createSettlementAction } from "./actions";

type Props = {
  viewerId: string;
  fromMemberId: string;
  toMemberId: string;
  amountPaise: number;
  members: MoneyMember[];
  onClose: () => void;
};

/**
 * The settle-up screen for one payment: the person you owe, their stored QR big
 * enough to scan off the phone in front of you, their UPI ID to copy, and one
 * "I paid" tap that records the payment as already sent. The creditor then
 * confirms it landed — the app never moves money, it only keeps the score.
 */
export function PayModal({
  viewerId,
  fromMemberId,
  toMemberId,
  amountPaise,
  members,
  onClose,
}: Props) {
  const [state, markPaid, marking] = useActionState(
    createSettlementAction,
    idleState,
  );
  const { mutate } = useSWRConfig();
  const toast = useToast();
  const [zoom, setZoom] = useState(false);

  const creditor = members.find((member) => member.id === toMemberId);
  const debtor = members.find((member) => member.id === fromMemberId);
  const creditorName = creditor?.displayName ?? "the person you owe";

  useEffect(() => {
    if (!state.ok) return;
    toast.success(
      `Marked as paid. ${creditorName} confirms when it lands.`,
    );
    void mutate(isMoneyKey);
    onClose();
  }, [state, mutate, onClose, toast, creditorName]);

  async function copyUpi() {
    if (!creditor?.upiId) return;
    try {
      await navigator.clipboard.writeText(creditor.upiId);
      toast.success("UPI ID copied.");
    } catch {
      toast.error("Could not copy. Select it and copy by hand.");
    }
  }

  return (
    <>
      <Modal
        open
        onClose={onClose}
        title={`Pay ${creditorName}`}
        description="Scan the code or copy the UPI ID, then say the money is gone."
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={onClose}>
              Not yet
            </Button>
            <Button
              type="submit"
              form="pay-form"
              variant="pop"
              size="sm"
              loading={marking}
            >
              I paid {formatPaise(amountPaise)}
            </Button>
          </>
        }
      >
        <form id="pay-form" action={markPaid} className="flex flex-col gap-3">
          <input type="hidden" name="fromMemberId" value={fromMemberId} />
          <input type="hidden" name="toMemberId" value={toMemberId} />
          <input
            type="hidden"
            name="amountRupees"
            value={formatPaise(amountPaise).replace("₹", "")}
          />
          <input type="hidden" name="intent" value="paid" />

          <div className="flex items-center justify-between gap-2 rounded-2xl border-2 border-dashed border-silver-deep bg-white/70 px-3 py-2">
            <span className="font-display text-[9px] uppercase tracking-tight text-ink-soft">
              {debtor?.id === viewerId ? "You owe" : `${debtor?.displayName ?? "Someone"} owes`}
            </span>
            <span className="font-display text-xl uppercase leading-none text-electric">
              {formatPaise(amountPaise)}
            </span>
            <span className="font-display text-[9px] uppercase tracking-tight text-ink-soft">
              to {creditorName}
            </span>
          </div>

          {creditor?.qrUrl ? (
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => setZoom(true)}
                title="Show the QR full screen"
                className="w-full max-w-[17rem] rounded-window border-2 border-silver-deep bg-white p-3 shadow-sticker transition-transform duration-150 active:translate-y-[2px]"
              >
                {/* Signed URL into a private bucket; nothing to optimise. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={creditor.qrUrl}
                  alt={`${creditorName}'s payment QR`}
                  className="mx-auto aspect-square w-full object-contain"
                />
                <span className="mt-1 block font-display text-[8px] uppercase tracking-tight text-ink-soft">
                  Tap for full screen
                </span>
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border-2 border-dashed border-silver-deep bg-cream px-3 py-3 text-center">
              <p className="font-display text-[10px] uppercase tracking-tight text-ink">
                {creditorName} has not added a QR yet
              </p>
              <p className="mt-1 text-xs font-semibold text-ink-soft">
                Ask them to drop it in Money → My payment QR, then come back here.
              </p>
            </div>
          )}

          {creditor?.upiId ? (
            <div className="flex items-center gap-2 rounded-2xl border-2 border-silver-deep bg-white/70 px-3 py-2">
              <span className="min-w-0 flex-1 truncate font-bold text-ink">
                {creditor.upiId}
              </span>
              <Button
                type="button"
                variant="chrome"
                size="sm"
                onClick={() => void copyUpi()}
              >
                <CopyIcon className="size-3.5" />
                Copy
              </Button>
            </div>
          ) : creditor?.qrUrl ? (
            <p className="text-center text-xs font-semibold text-ink-soft">
              No UPI ID saved — scanning the code is the way.
            </p>
          ) : null}

          {!creditor?.qrUrl && !creditor?.upiId ? (
            <p className="flex items-center justify-center gap-1.5 text-center text-xs font-semibold text-ink-soft">
              <SparkleIcon className="size-3.5 shrink-0 text-hotpink" />
              Nothing to scan or copy yet — pay them any way you like and tap I paid.
            </p>
          ) : null}

          {state.error ? (
            <p className="text-xs font-extrabold text-hotpink-deep">{state.error}</p>
          ) : null}
        </form>
      </Modal>

      {zoom && creditor?.qrUrl ? (
        <button
          type="button"
          onClick={() => setZoom(false)}
          aria-label="Close the full-screen QR"
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-3 bg-ink/85 p-6"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={creditor.qrUrl}
            alt={`${creditorName}'s payment QR`}
            className="max-h-[70vh] w-full max-w-md rounded-window bg-white object-contain p-4"
          />
          <span className="font-display text-xs uppercase tracking-tight text-white">
            {formatPaise(amountPaise)} → {creditorName}
          </span>
          <span className="font-display text-[9px] uppercase tracking-tight text-white/70">
            Tap anywhere to close
          </span>
        </button>
      ) : null}
    </>
  );
}
