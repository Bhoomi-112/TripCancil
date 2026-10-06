/**
 * Document types and their colours. Client-safe and dependency-free so the
 * vault, the upload form and the validation schemas all read the same list.
 */

export const DOCUMENT_TYPES = [
  "ticket",
  "hotel",
  "id",
  "insurance",
  "other",
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  ticket: "Ticket",
  hotel: "Hotel",
  id: "ID",
  insurance: "Insurance",
  other: "Other",
};

export const DOCUMENT_TYPE_COLOURS: Record<DocumentType, string> = {
  ticket: "#0369a1",
  hotel: "#7c2d12",
  id: "#db2777",
  insurance: "#15803d",
  other: "#5d4c85",
};