/** Client-safe copy of the `receipts` bucket limits, so the picker can refuse a
 * bad bill before a single byte crosses the wire. The server re-checks both. */
export const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;

export const RECEIPT_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

export type AllowedReceiptMime = (typeof RECEIPT_MIME_TYPES)[number];

export function isAllowedReceiptMime(mime: string): mime is AllowedReceiptMime {
  return (RECEIPT_MIME_TYPES as readonly string[]).includes(mime);
}