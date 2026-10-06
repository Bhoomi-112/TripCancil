import type { Enums } from "@/lib/db/types";

export type VaultMember = {
  id: string;
  displayName: string;
};

/**
 * A document plus its short-lived preview URL. The raw `storage_path` never
 * leaves the server; the signed URL is the only thing the browser ever holds.
 * `kind` is derived from the stored file so the vault knows to render a PDF
 * viewer or an image without ever seeing the path itself.
 */
export type DocumentPreview = {
  id: string;
  title: string;
  type: Enums<"document_type">;
  uploaderId: string;
  itineraryItemId: string | null;
  createdAt: string;
  previewUrl: string;
  kind: "pdf" | "image";
};

export type ItineraryOption = {
  id: string;
  label: string;
};

/** The wire shape both the trip page and the polling route hand to the vault. */
export type DocumentsPayload = {
  documents: DocumentPreview[];
  itineraryOptions: ItineraryOption[];
  members: VaultMember[];
};

/**
 * The SWR key the documents vault polls. Filter form so any component in the
 * board can say "re-read the vault" without being handed the trip id.
 */
export function isDocumentsKey(key: unknown): boolean {
  return (
    typeof key === "string" &&
    key.startsWith("/api/trips/") &&
    key.endsWith("/documents")
  );
}