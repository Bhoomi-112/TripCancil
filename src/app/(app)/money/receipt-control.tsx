"use client";

import { useState } from "react";
import { useSWRConfig } from "swr";
import { Button, IconButton } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { isMoneyKey } from "@/lib/money/balances";
import {
  MAX_RECEIPT_BYTES,
  isAllowedReceiptMime,
} from "@/lib/money/receipt-limits";
import { TrashIcon, UploadIcon } from "@/components/ui/icons";

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 KB";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

type Props = {
  tripId: string;
  expenseId: string;
  /** Fresh signed URL from the last poll; null when nothing is pinned yet. */
  receiptUrl: string | null;
  editable: boolean;
};

async function postReceipt(tripId: string, expenseId: string, file: File) {
  const form = new FormData();
  form.set("file", file);
  const response = await fetch(
    `/api/trips/${tripId}/expenses/${expenseId}/receipt`,
    { method: "POST", body: form },
  );
  const json = (await response.json()) as { ok?: boolean; error?: string };
  if (!response.ok || !json.ok) throw new Error(json.error ?? "Could not attach that receipt.");
}

export function ReceiptControl({ tripId, expenseId, receiptUrl, editable }: Props) {
  const toast = useToast();
  const { mutate } = useSWRConfig();

  const [attaching, setAttaching] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function attach() {
    if (busy) return;
    if (!file) {
      setError("Choose an image of the bill.");
      return;
    }
    if (file.size > MAX_RECEIPT_BYTES) {
      setError("Receipts are capped at 10 MB.");
      return;
    }
    if (!isAllowedReceiptMime(file.type)) {
      setError("Only image receipts (PNG, JPG, WebP) are accepted.");
      return;
    }

    setError(null);
    setBusy(true);
    try {
      await postReceipt(tripId, expenseId, file);
      toast.success("Receipt attached.");
      void mutate(isMoneyKey);
      setFile(null);
      setAttaching(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not attach that receipt.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const response = await fetch(
        `/api/trips/${tripId}/expenses/${expenseId}/receipt`,
        { method: "DELETE" },
      );
      const json = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !json.ok) {
        throw new Error(json.error ?? "Could not remove that receipt.");
      }
      toast.success("Receipt removed.");
      void mutate(isMoneyKey);
      setRemoving(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not remove that receipt.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {receiptUrl ? (
        <>
          <a
            href={receiptUrl}
            target="_blank"
            rel="noreferrer"
            title="Open the receipt"
            className="block size-7 shrink-0 overflow-hidden rounded-lg border-2 border-silver-deep bg-white shadow-sticker transition-transform duration-150 hover:scale-105"
          >
            {
              // The URL is a short-lived signed link to a private bucket, so
              // next/image has nothing to optimise.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={receiptUrl}
                alt="Receipt for this expense"
                loading="lazy"
                className="size-full object-cover"
              />
            }
          </a>
          {editable ? (
            <IconButton
              label="Remove receipt"
              variant="ghost"
              size="sm"
              onClick={() => {
                setError(null);
                setRemoving(true);
              }}
            >
              <TrashIcon className="size-4" />
            </IconButton>
          ) : null}
        </>
      ) : editable ? (
        <IconButton
          label="Attach a receipt"
          variant="ghost"
          size="sm"
          onClick={() => {
            setError(null);
            setFile(null);
            setAttaching(true);
          }}
        >
          <UploadIcon className="size-4" />
        </IconButton>
      ) : null}

      <Modal
        open={attaching}
        onClose={() => setAttaching(false)}
        title="Receipt"
        description="A photo of the bill, private to the trip. Replacing uploads and deletes the old copy."
        size="sm"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setAttaching(false)}>
              Cancel
            </Button>
            <Button variant="pop" size="sm" loading={busy} onClick={() => void attach()}>
              Attach
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-2">
          <label
            className={cn(
              "flex w-full cursor-pointer flex-col items-center gap-1 rounded-2xl border-2 border-dashed px-3.5 py-4 text-center transition-transform duration-150 active:translate-y-[2px]",
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
            {file ? (
              <>
                <span className="max-w-full truncate text-sm font-extrabold text-ink">
                  {file.name}
                </span>
                <span className="text-xs font-bold text-ink-soft">
                  {formatSize(file.size)} · tap to swap
                </span>
              </>
            ) : (
              <>
                <span className="font-display text-[10px] uppercase tracking-tight text-electric-deep">
                  Pick a PNG, JPG or WebP
                </span>
                <span className="text-xs font-semibold text-ink-soft">
                  Max 10 MB · stored in a private bucket
                </span>
              </>
            )}
          </label>
          {error ? (
            <p className="text-xs font-extrabold text-hotpink-deep">{error}</p>
          ) : null}
        </div>
      </Modal>

      <Modal
        open={removing}
        onClose={() => setRemoving(false)}
        title="Remove this receipt?"
        description="The picture is deleted from storage; the expense stays in the ledger."
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
        {error ? (
          <p className="text-xs font-extrabold text-hotpink-deep">{error}</p>
        ) : (
          <p className="text-sm font-semibold text-ink-soft">
            Any member can attach or remove a receipt while the trip is live.
          </p>
        )}
      </Modal>
    </>
  );
}