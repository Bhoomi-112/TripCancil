/** Client-safe copy of the `payment-qrs` bucket limits, so the picker can turn
 * away a bad file before a byte crosses the wire. The server re-checks both. */
export const MAX_PAYMENT_QR_BYTES = 5 * 1024 * 1024;

export const PAYMENT_QR_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

export type AllowedPaymentQrMime = (typeof PAYMENT_QR_MIME_TYPES)[number];

export function isAllowedPaymentQrMime(mime: string): mime is AllowedPaymentQrMime {
  return (PAYMENT_QR_MIME_TYPES as readonly string[]).includes(mime);
}

/** The UPI handle as the database stores it: trimmed, 3 to 80 characters. */
export const MAX_UPI_ID_LENGTH = 80;
export const MIN_UPI_ID_LENGTH = 3;
