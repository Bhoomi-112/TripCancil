import "server-only";

import type { SessionContext } from "@/lib/auth/context";
import { tripHasEnded } from "@/lib/constants";
import { getSupabase } from "@/lib/db/client";
import {
  MAX_RECEIPT_BYTES,
  isAllowedReceiptMime,
} from "./receipt-limits";

export { MAX_RECEIPT_BYTES, isAllowedReceiptMime } from "./receipt-limits";

/** A problem the receipt UI can show verbatim, e.g. "Files are capped at 10 MB." */
export class ReceiptError extends Error {}

function fileExtensionFor(mime: string): string {
  switch (mime) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return "jpg";
  }
}

/**
 * Past trips are read-only, same rule as the ledger: a bill can be pinned to an
 * expense while the trip is live, and not a paise moves on a trip that is over.
 */
function assertTripEditable(context: SessionContext): void {
  if (tripHasEnded(context.trip.end_date)) {
    throw new ReceiptError(
      `"${context.trip.name}" is over, so the ledger is read-only now.`,
    );
  }
}

async function loadExpenseForTrip(
  tripId: string,
  expenseId: string,
): Promise<{ id: string; receipt_path: string | null; deleted_at: string | null } | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("expenses")
    .select("id, trip_id, receipt_path, deleted_at")
    .eq("id", expenseId)
    .maybeSingle();
  if (error) throw new ReceiptError(error.message);
  return data && data.trip_id === tripId ? data : null;
}

export type ReceiptFile = {
  name: string;
  mimeType: string;
  size: number;
  bytes: ArrayBuffer;
};

/**
 * Pins a bill image to an expense. Stored under `<trip>/<uuid>-<slug>.<ext>` in
 * the private `receipts` bucket; the row just records the path and every poll
 * re-mints a signed URL. Any member can attach one, exactly like editing the
 * expense itself. Replaces an existing receipt rather than stacking them.
 */
export async function attachReceipt(
  context: SessionContext,
  expenseId: string,
  file: ReceiptFile,
): Promise<void> {
  assertTripEditable(context);

  if (file.size === 0) {
    throw new ReceiptError("That file is empty.");
  }
  if (file.size > MAX_RECEIPT_BYTES) {
    throw new ReceiptError("Receipts are capped at 10 MB.");
  }
  if (!isAllowedReceiptMime(file.mimeType)) {
    throw new ReceiptError("Only image receipts (PNG, JPG, WebP) are accepted.");
  }

  const existing = await loadExpenseForTrip(context.trip.id, expenseId);
  if (!existing) {
    throw new ReceiptError("That expense is not on this trip's ledger.");
  }
  if (existing.deleted_at) {
    throw new ReceiptError("That expense has already been removed.");
  }

  const slugBase = file.name.trim().toLowerCase().replace(/\.[^.]+$/, "");
  const slug =
    slugBase.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "receipt";
  const path = `${context.trip.id}/${crypto.randomUUID()}-${slug}.${fileExtensionFor(file.mimeType)}`;

  const supabase = getSupabase();

  // The old file goes before the new one lands so a failure never leaves two
  // copies of the same bill in storage.
  if (existing.receipt_path) {
    const { error: oldRemoveError } = await supabase.storage
      .from("receipts")
      .remove([existing.receipt_path]);
    if (oldRemoveError) {
      throw new ReceiptError("The old receipt could not be deleted. Try again.");
    }
  }

  const { error: uploadError } = await supabase.storage
    .from("receipts")
    .upload(path, file.bytes, {
      contentType: file.mimeType,
      upsert: false,
    });
  if (uploadError) {
    throw new ReceiptError("The receipt could not be stored. Try again.");
  }

  const { error: rowError } = await supabase
    .from("expenses")
    .update({ receipt_path: path })
    .eq("id", expenseId)
    .eq("trip_id", context.trip.id);
  if (rowError) {
    await supabase.storage.from("receipts").remove([path]);
    throw new ReceiptError(rowError.message);
  }
}

/**
 * Unpins the bill. Storage goes first so the expense row can never keep pointing
 * at a file that is gone; on a failed storage removal nothing changes.
 */
export async function removeReceipt(
  context: SessionContext,
  expenseId: string,
): Promise<void> {
  assertTripEditable(context);

  const existing = await loadExpenseForTrip(context.trip.id, expenseId);
  if (!existing) {
    throw new ReceiptError("That expense is not on this trip's ledger.");
  }
  if (!existing.receipt_path) {
    return;
  }

  const supabase = getSupabase();
  const { error: removeError } = await supabase.storage
    .from("receipts")
    .remove([existing.receipt_path]);
  if (removeError) {
    throw new ReceiptError("The receipt could not be deleted. Try again.");
  }

  const { error: rowError } = await supabase
    .from("expenses")
    .update({ receipt_path: null })
    .eq("id", expenseId)
    .eq("trip_id", context.trip.id);
  if (rowError) throw new ReceiptError(rowError.message);
}