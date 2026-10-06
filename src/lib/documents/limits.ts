/** Uploads are capped at 10 MB and only PDFs and images make it to the vault. */
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

export const DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
] as const;

export type AllowedDocumentMime = (typeof DOCUMENT_MIME_TYPES)[number];

export function isAllowedDocumentMime(mime: string): mime is AllowedDocumentMime {
  return (DOCUMENT_MIME_TYPES as readonly string[]).includes(mime);
}

/** A safe, storage-friendly extension for the stored path name. */
export function fileExtensionFor(mime: string): string {
  switch (mime) {
    case "application/pdf":
      return "pdf";
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    case "image/heic":
      return "heic";
    case "image/heif":
      return "heif";
    default:
      return "bin";
  }
}