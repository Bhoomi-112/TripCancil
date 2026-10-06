import "server-only";

import type { SessionContext } from "@/lib/auth/context";
import { tripHasEnded } from "@/lib/constants";
import { getSupabase } from "@/lib/db/client";
import {
  MAX_PAYMENT_QR_BYTES,
  MAX_UPI_ID_LENGTH,
  MIN_UPI_ID_LENGTH,
  isAllowedPaymentQrMime,
} from "./payment-qr-limits";

export {
  MAX_PAYMENT_QR_BYTES,
  MAX_UPI_ID_LENGTH,
  MIN_UPI_ID_LENGTH,
  isAllowedPaymentQrMime,
  PAYMENT_QR_MIME_TYPES,
} from "./payment-qr-limits";

/** A problem the QR UI can show verbatim, e.g. "QR images are capped at 5 MB." */
export class PaymentQrError extends Error {}

const PAYMENT_QRS_BUCKET = "payment-qrs";

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
 * Past trips are read-only, the same rule as the ledger: a payment QR is only
 * ever useful while money is still moving on the trip.
 */
function assertTripEditable(context: SessionContext): void {
  if (tripHasEnded(context.trip.end_date)) {
    throw new PaymentQrError(
      `"${context.trip.name}" is over, so the trip is read-only now.`,
    );
  }
}

export type PaymentQrFile = {
  name: string;
  mimeType: string;
  size: number;
  bytes: ArrayBuffer;
};

async function currentQrPath(memberId: string): Promise<string | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("members")
    .select("payment_qr_path")
    .eq("id", memberId)
    .maybeSingle();
  if (error) throw new PaymentQrError(error.message);
  return data?.payment_qr_path ?? null;
}

/**
 * Stores the member's own payment QR in the private `payment-qrs` bucket,
 * namespaced under `<trip>/<member>/` so one person's upload can never land in
 * another's folder. The app never generates a QR; it only keeps the image the
 * member already has. An existing QR is deleted before the new one lands, so a
 * member never has two codes in storage.
 *
 * Only the signed-in member can touch their own row — there is no argument for
 * someone else's id to pass in.
 */
export async function setPaymentQr(
  context: SessionContext,
  file: PaymentQrFile,
): Promise<void> {
  assertTripEditable(context);

  if (file.size === 0) {
    throw new PaymentQrError("That file is empty.");
  }
  if (file.size > MAX_PAYMENT_QR_BYTES) {
    throw new PaymentQrError("QR images are capped at 5 MB.");
  }
  if (!isAllowedPaymentQrMime(file.mimeType)) {
    throw new PaymentQrError("Only image QRs (PNG, JPG, WebP) are accepted.");
  }

  const memberId = context.member.id;
  const previous = await currentQrPath(memberId);
  const path = `${context.trip.id}/${memberId}/qr-${crypto.randomUUID()}.${fileExtensionFor(file.mimeType)}`;

  const supabase = getSupabase();

  if (previous) {
    const { error: oldRemoveError } = await supabase.storage
      .from(PAYMENT_QRS_BUCKET)
      .remove([previous]);
    if (oldRemoveError) {
      throw new PaymentQrError("Your old QR could not be deleted. Try again.");
    }
  }

  const { error: uploadError } = await supabase.storage
    .from(PAYMENT_QRS_BUCKET)
    .upload(path, file.bytes, { contentType: file.mimeType, upsert: false });
  if (uploadError) {
    throw new PaymentQrError("The QR could not be stored. Try again.");
  }

  const { error: rowError } = await supabase
    .from("members")
    .update({ payment_qr_path: path })
    .eq("id", memberId)
    .eq("trip_id", context.trip.id);
  if (rowError) {
    await supabase.storage.from(PAYMENT_QRS_BUCKET).remove([path]);
    throw new PaymentQrError(rowError.message);
  }
}

/** Takes the QR down again: storage first, so the row never points at a ghost. */
export async function removePaymentQr(context: SessionContext): Promise<void> {
  assertTripEditable(context);

  const previous = await currentQrPath(context.member.id);
  if (!previous) return;

  const supabase = getSupabase();
  const { error: removeError } = await supabase.storage
    .from(PAYMENT_QRS_BUCKET)
    .remove([previous]);
  if (removeError) {
    throw new PaymentQrError("Your QR could not be deleted. Try again.");
  }

  const { error: rowError } = await supabase
    .from("members")
    .update({ payment_qr_path: null })
    .eq("id", context.member.id)
    .eq("trip_id", context.trip.id);
  if (rowError) throw new PaymentQrError(rowError.message);
}

/**
 * Saves the UPI handle shown next to the QR. Blank means "clear it", because
 * the database column is a trimmed 3-80 character text or null — an empty
 * string would be a handle nobody can pay.
 */
export async function setUpiId(
  context: SessionContext,
  upiId: string | null,
): Promise<void> {
  assertTripEditable(context);

  const value = upiId?.trim() ?? "";
  if (value.length > 0 && (value.length < MIN_UPI_ID_LENGTH || value.length > MAX_UPI_ID_LENGTH)) {
    throw new PaymentQrError(
      `A UPI ID is between ${MIN_UPI_ID_LENGTH} and ${MAX_UPI_ID_LENGTH} characters.`,
    );
  }
  if (value.length > 0 && /[\r\n\t]/.test(value)) {
    throw new PaymentQrError("A UPI ID is a single line.");
  }

  const supabase = getSupabase();
  const { error } = await supabase
    .from("members")
    .update({ upi_id: value.length > 0 ? value : null })
    .eq("id", context.member.id)
    .eq("trip_id", context.trip.id);
  if (error) throw new PaymentQrError(error.message);
}
