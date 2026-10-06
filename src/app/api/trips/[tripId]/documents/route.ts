import { getSessionContext } from "@/lib/auth/context";
import {
  deleteDocument,
  DocumentsError,
  readDocuments,
  uploadDocument,
} from "@/lib/documents/service";
import { deleteDocumentSchema, uploadDocumentSchema } from "@/lib/documents/validation";

export const dynamic = "force-dynamic";

function tripIdInPath(
  pathTripId: string,
  actualTripId: string,
): boolean {
  return pathTripId === actualTripId;
}

/** Polled by the documents vault; returns signed URLs, never storage paths. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tripId: string }> },
) {
  const context = await getSessionContext();
  if (!context) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  const { tripId } = await params;
  if (!tripIdInPath(tripId, context.trip.id)) {
    return Response.json({ error: "Unknown trip." }, { status: 404 });
  }

  try {
    return Response.json(await readDocuments(context.trip.id));
  } catch (error) {
    const message =
      error instanceof DocumentsError ? error.message : "Could not load the vault.";
    return Response.json({ error: message }, { status: 500 });
  }
}

/** Multipart upload into the private `documents` bucket, membership-checked. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> },
) {
  const context = await getSessionContext();
  if (!context) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  const { tripId } = await params;
  if (!tripIdInPath(tripId, context.trip.id)) {
    return Response.json({ error: "Unknown trip." }, { status: 404 });
  }

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return Response.json({ error: "Choose a file to upload." }, { status: 400 });
    }

    const parsed = uploadDocumentSchema.safeParse({
      title: form.get("title"),
      type: form.get("type"),
      itineraryItemId: form.get("itineraryItemId"),
    });
    if (!parsed.success) {
      return Response.json(
        {
          error: parsed.error.issues[0]?.message ?? "That upload could not be read.",
        },
        { status: 400 },
      );
    }

    const id = await uploadDocument(context, {
      title: parsed.data.title,
      type: parsed.data.type,
      itineraryItemId: parsed.data.itineraryItemId,
      file: {
        name: file.name,
        mimeType: file.type,
        size: file.size,
        bytes: await file.arrayBuffer(),
      },
    });
    return Response.json({ ok: true, id });
  } catch (error) {
    const message =
      error instanceof DocumentsError ? error.message : "Could not upload that file.";
    return Response.json({ error: message }, { status: 400 });
  }
}

/** Deletes by uploader or owner; storage is removed before the row. */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> },
) {
  const context = await getSessionContext();
  if (!context) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  const { tripId } = await params;
  if (!tripIdInPath(tripId, context.trip.id)) {
    return Response.json({ error: "Unknown trip." }, { status: 404 });
  }

  const parsed = deleteDocumentSchema.safeParse({
    id: new URL(request.url).searchParams.get("id"),
  });
  if (!parsed.success) {
    return Response.json({ error: "That document could not be found." }, { status: 400 });
  }

  try {
    await deleteDocument(context, parsed.data.id);
    return Response.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof DocumentsError ? error.message : "Could not delete that file.";
    return Response.json({ error: message }, { status: 400 });
  }
}