import "server-only";

import type { SessionContext } from "@/lib/auth/context";
import { tripHasEnded } from "@/lib/constants";
import { getSupabase } from "@/lib/db/client";
import type { Enums } from "@/lib/db/types";
import { fileExtensionFor, isAllowedDocumentMime, MAX_DOCUMENT_BYTES } from "./limits";
import type { DocumentsPayload } from "./types";

/** A problem the documents UI can show verbatim, e.g. "Files are capped at 10 MB." */
export class DocumentsError extends Error {}

/** Signed URLs stay fresh long enough for a glance and the next 5s poll. */
const PREVIEW_TTL_SECONDS = 300;

/**
 * Past trips are read-only, same rule as everywhere else: uploading a ticket
 * after the trip is over is nobody's plan, so the vault stops taking writes.
 */
function assertTripEditable(context: SessionContext): void {
  if (tripHasEnded(context.trip.end_date)) {
    throw new DocumentsError(
      `"${context.trip.name}" is over, so the vault is read-only now.`,
    );
  }
}

async function assertItineraryItemInTrip(tripId: string, itemId: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("itinerary_items")
    .select("id, trip_id")
    .eq("id", itemId)
    .maybeSingle();
  if (error) throw new DocumentsError(error.message);
  return Boolean(data && data.trip_id === tripId);
}

/**
 * The vault's wire shape: every document is paired with a fresh signed URL so
 * the browser never sees a raw storage path. The URLs are re-minted on every
 * 5s poll, so an open preview refreshes itself before it expires.
 */
export async function readDocuments(tripId: string): Promise<DocumentsPayload> {
  const supabase = getSupabase();

  const [rows, items, members] = await Promise.all([
    supabase
      .from("documents")
      .select("*")
      .eq("trip_id", tripId)
      .order("created_at", { ascending: false }),
    supabase
      .from("itinerary_items")
      .select("id, day_index, title")
      .eq("trip_id", tripId)
      .order("day_index", { ascending: true })
      .order("position", { ascending: true }),
    supabase
      .from("members")
      .select("id, display_name")
      .eq("trip_id", tripId)
      .order("created_at", { ascending: true }),
  ]);

  if (rows.error) throw new DocumentsError(rows.error.message);
  if (items.error) throw new DocumentsError(items.error.message);
  if (members.error) throw new DocumentsError(members.error.message);

  const documents = await Promise.all(
    (rows.data ?? []).map(async (row) => {
      const { data, error } = await supabase.storage
        .from("documents")
        .createSignedUrl(row.storage_path, PREVIEW_TTL_SECONDS);
      if (error) throw new DocumentsError(error.message);
      return {
        id: row.id,
        title: row.title,
        type: row.type,
        uploaderId: row.uploader_id,
        itineraryItemId: row.itinerary_item_id,
        createdAt: row.created_at,
        previewUrl: data?.signedUrl ?? "",
        kind: row.storage_path.toLowerCase().endsWith(".pdf")
          ? ("pdf" as const)
          : ("image" as const),
      };
    }),
  );

  return {
    documents,
    itineraryOptions: (items.data ?? []).map((item) => ({
      id: item.id,
      label: `Day ${item.day_index + 1} · ${item.title}`,
    })),
    members: (members.data ?? []).map((member) => ({
      id: member.id,
      displayName: member.display_name,
    })),
  };
}

export type UploadDocumentFile = {
  name: string;
  mimeType: string;
  size: number;
  bytes: ArrayBuffer;
};

export type UploadDocumentInput = {
  title: string;
  type: Enums<"document_type">;
  itineraryItemId: string | null;
  file: UploadDocumentFile;
};

/**
 * Uploads the bytes to the private `documents` bucket under `<trip>/<uuid>-<slug>`
 * and records the row. If the row insert fails the stored file is removed again,
 * so the vault never shows a path that points at nothing.
 */
export async function uploadDocument(
  context: SessionContext,
  input: UploadDocumentInput,
): Promise<string> {
  assertTripEditable(context);

  if (input.file.size === 0) {
    throw new DocumentsError("That file is empty.");
  }
  if (input.file.size > MAX_DOCUMENT_BYTES) {
    throw new DocumentsError("Files are capped at 10 MB.");
  }
  if (!isAllowedDocumentMime(input.file.mimeType)) {
    throw new DocumentsError("Only PDFs and images are allowed in the vault.");
  }
  if (
    input.itineraryItemId &&
    !(await assertItineraryItemInTrip(context.trip.id, input.itineraryItemId))
  ) {
    throw new DocumentsError("That plan item is not on this trip.");
  }

  const path = `${context.trip.id}/${crypto.randomUUID()}-${slugify(input.title)}.${fileExtensionFor(input.file.mimeType)}`;

  const supabase = getSupabase();
  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(path, input.file.bytes, {
      contentType: input.file.mimeType,
      upsert: false,
    });
  if (uploadError) {
    throw new DocumentsError("The file could not be stored. Try again.");
  }

  const { data, error: rowError } = await supabase
    .from("documents")
    .insert({
      trip_id: context.trip.id,
      uploader_id: context.member.id,
      title: input.title,
      type: input.type,
      storage_path: path,
      itinerary_item_id: input.itineraryItemId,
    })
    .select("id")
    .single();
  if (rowError) {
    await supabase.storage.from("documents").remove([path]);
    throw new DocumentsError(rowError.message);
  }
  return data.id;
}

/**
 * Deletes by uploader or owner only. Storage goes first so a row can never be
 * quietly left pointing at a file, and a failed storage removal aborts the row
 * delete entirely.
 */
export async function deleteDocument(
  context: SessionContext,
  documentId: string,
): Promise<void> {
  assertTripEditable(context);

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("documents")
    .select("id, trip_id, uploader_id, storage_path")
    .eq("id", documentId)
    .maybeSingle();
  if (error) throw new DocumentsError(error.message);
  if (!data || data.trip_id !== context.trip.id) {
    throw new DocumentsError("That document is not on this trip.");
  }
  if (data.uploader_id !== context.member.id && context.member.role !== "owner") {
    throw new DocumentsError("Only the uploader or the trip owner can delete that.");
  }

  const { error: removeError } = await supabase.storage
    .from("documents")
    .remove([data.storage_path]);
  if (removeError) {
    throw new DocumentsError("The file could not be deleted. Try again.");
  }

  const { error: rowError } = await supabase
    .from("documents")
    .delete()
    .eq("id", documentId)
    .eq("trip_id", context.trip.id);
  if (rowError) throw new DocumentsError(rowError.message);
}

/** "Train tickets to Goa" -> "train-tickets-to-goa" for a safe storage path. */
function slugify(title: string): string {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "document";
}