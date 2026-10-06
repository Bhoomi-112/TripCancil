"use client";

import { useActionState, useState } from "react";
import { useSWRConfig } from "swr";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { UploadIcon } from "@/components/ui/icons";
import { idleState } from "@/lib/actions/state";
import { cn } from "@/lib/cn";
import { isMoneyKey } from "@/lib/money/balances";
import {
  MAX_PAYMENT_QR_BYTES,
  isAllowedPaymentQrMime,
} from "@/lib/money/payment-qr-limits";
import { setUpiIdAction } from "./actions";

type Props = {
  tripId: string;
  /** Fresh signed URL from the last poll; null when nothing is stored yet. */
  qrUrl: string | null;
  upiId: string | null;
  onClose: () => void;
};

async function postQr(tripId: string, file: File) {
  const form = new FormData();
  form.set("file", file);
  const response = await fetch(`/api/trips/${tripId}/payment-qr`, {
    method: "POST",
    body: form,
  });
  const json = (await response.json()) as { ok?: boolean; error?: string };
  if (!response.ok || !json.ok) {
    throw new Error(json.error ?? "Could not store that QR.");
  }
}

/**
 * Where a member keeps the payment QR they already have. The app never
 * generates a code and never shows one to anybody but its owner: the image
 * lives in a private bucket and is served to the settle-up screen as a
 * short-lived signed URL.
 */
export function PaymentQrModal({ tripId, qrUrl, upiId, onClose }: Props) {
  const toast = useToast();
  const { mutate } = useSWRConfig();

  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [upiState, saveUpi, savingUpi] = useActionState(setUpiIdAction, idleState);

  async function store() {
    if (busy) return;
    if (!file) {
      setError("Pick an image of your QR first.");
      return;
    }
    if (file.size > MAX_PAYMENT_QR_BYTES) {
      setError("QR images are capped at 5 MB.");
      return;
    }
    if (!isAllowedPaymentQrMime(file.type)) {
      setError("Only image QRs (PNG, JPG, WebP) are accepted.");
      return;
    }

    setError(null);
    setBusy(true);
    try {
      await postQr(tripId, file);
      toast.success("QR stored.");
      void mutate(isMoneyKey);
      setFile(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not store that QR.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const response = await fetch(`/api/trips/${tripId}/payment-qr`, {
        method: "DELETE",
      });
      const json = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !json.ok) {
        throw new Error(json.error ?? "Could not remove your QR.");
      }
      toast.success("QR removed.");
      void mutate(isMoneyKey);
      setRemoving(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not remove that QR.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="My payment QR"
      description="Stored for you, shown to whoever owes you. The app never makes the code."
      footer={
        <Button variant="ghost" size="sm" onClick={onClose}>
          Done
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <div className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-2xl border-2 border-silver-deep bg-white shadow-sticker">
            {qrUrl ? (
              // Short-lived signed link to a private bucket: nothing to optimise.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrUrl} alt="Your payment QR" className="size-full object-contain" />
            ) : (
              <span className="px-2 text-center font-display text-[8px] uppercase leading-tight text-ink-soft">
                No QR yet
              </span>
            )}
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <label
              className={cn(
                "flex w-full cursor-pointer flex-col items-center gap-1 rounded-2xl border-2 border-dashed px-3 py-3 text-center transition-transform duration-150 active:translate-y-[2px]",
                file
                  ? "border-electric bg-electric/5"
                  : error
                    ? "border-hotpink bg-white/60"
                    : "border-silver-deep bg-white/70",
              )}
            >
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={(event) => {
                  setFile(event.target.files?.[0] ?? null);
                  setError(null);
                }}
              />
              <span className="flex items-center gap-1.5 font-display text-[9px] uppercase tracking-tight text-electric-deep">
                <UploadIcon className="size-3.5" />
                {file ? "Swap the image" : "Pick an image"}
              </span>
              <span className="max-w-full truncate text-xs font-bold text-ink">
                {file ? file.name : "PNG, JPG or WebP · max 5 MB"}
              </span>
            </label>

            <div className="flex gap-2">
              <Button
                variant="pop"
                size="sm"
                loading={busy}
                disabled={!file}
                onClick={() => void store()}
              >
                Store QR
              </Button>
              {qrUrl ? (
                <Button variant="danger" size="sm" onClick={() => setRemoving(true)}>
                  Remove
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        <form action={saveUpi} className="flex flex-col gap-2 rounded-2xl border-2 border-dashed border-silver-deep bg-white/60 p-3">
          <Field
            label="upi id (optional)"
            hint="The handle people type if they would rather pay by UPI ID."
            error={upiState.fieldErrors?.upiId}
          >
            <Input
              name="upiId"
              defaultValue={upiId ?? ""}
              placeholder="bhoomi@okaxis"
              maxLength={80}
              autoComplete="off"
            />
          </Field>
          <div className="flex items-center gap-2">
            <Button type="submit" variant="chrome" size="sm" loading={savingUpi}>
              Save UPI ID
            </Button>
            {upiState.ok ? (
              <span role="status" className="text-xs font-extrabold text-lime-deep">
                Saved.
              </span>
            ) : null}
          </div>
          {upiState.error ? (
            <p className="text-xs font-extrabold text-hotpink-deep">{upiState.error}</p>
          ) : null}
        </form>

        {error ? (
          <p className="text-xs font-extrabold text-hotpink-deep">{error}</p>
        ) : null}
      </div>

      <Modal
        open={removing}
        onClose={() => setRemoving(false)}
        title="Remove your QR?"
        description="People who owe you will see a nudge to ask for it again."
        size="sm"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setRemoving(false)}>
              Keep it
            </Button>
            <Button variant="danger" size="sm" loading={busy} onClick={() => void remove()}>
              Remove
            </Button>
          </>
        }
      >
        <div className="flex items-center gap-2">
          {qrUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrUrl} alt="Your payment QR" className="size-14 rounded-xl border-2 border-silver-deep bg-white object-contain" />
          ) : null}
          <p className="text-sm font-semibold text-ink-soft">
            Only the image goes. Your UPI ID text stays.
          </p>
        </div>
        {error ? (
          <p className="mt-2 text-xs font-extrabold text-hotpink-deep">{error}</p>
        ) : null}
      </Modal>
    </Modal>
  );
}
