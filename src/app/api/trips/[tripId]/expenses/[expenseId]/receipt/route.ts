import { getSessionContext } from "@/lib/auth/context";
import { attachReceipt, ReceiptError, removeReceipt } from "@/lib/money/receipts";

export const dynamic = "force-dynamic";

function expenseOnPathTrip(pathTripId: string, actualTripId: string): boolean {
  return pathTripId === actualTripId;
}

/**
 * Pins an image bill to an expense. Membership is checked by the session cookie,
 * and the services re-check that the expense belongs to this trip before any
 * byte moves.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ tripId: string; expenseId: string }> },
) {
  const context = await getSessionContext();
  if (!context) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  const { tripId, expenseId } = await params;
  if (!expenseOnPathTrip(tripId, context.trip.id)) {
    return Response.json({ error: "Unknown trip." }, { status: 404 });
  }

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return Response.json({ error: "Choose a receipt image." }, { status: 400 });
    }

    await attachReceipt(context, expenseId, {
      name: file.name,
      mimeType: file.type,
      size: file.size,
      bytes: await file.arrayBuffer(),
    });
    return Response.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof ReceiptError ? error.message : "The receipt could not be saved.";
    return Response.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ tripId: string; expenseId: string }> },
) {
  const context = await getSessionContext();
  if (!context) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  const { tripId, expenseId } = await params;
  if (!expenseOnPathTrip(tripId, context.trip.id)) {
    return Response.json({ error: "Unknown trip." }, { status: 404 });
  }

  try {
    await removeReceipt(context, expenseId);
    return Response.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof ReceiptError ? error.message : "The receipt could not be removed.";
    return Response.json({ error: message }, { status: 400 });
  }
}