import { getSessionContext } from "@/lib/auth/context";
import {
  PaymentQrError,
  removePaymentQr,
  setPaymentQr,
} from "@/lib/money/payment-qr";

export const dynamic = "force-dynamic";

/**
 * The signed-in member's own payment QR. Membership is checked by the session
 * cookie, the service only ever writes `<trip>/<member>/…`, and the raw storage
 * path is never returned — the ledger re-mints a signed URL per poll instead.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> },
) {
  const context = await getSessionContext();
  if (!context) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  const { tripId } = await params;
  if (tripId !== context.trip.id) {
    return Response.json({ error: "Unknown trip." }, { status: 404 });
  }

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return Response.json({ error: "Choose an image of your QR." }, { status: 400 });
    }

    await setPaymentQr(context, {
      name: file.name,
      mimeType: file.type,
      size: file.size,
      bytes: await file.arrayBuffer(),
    });
    return Response.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof PaymentQrError ? error.message : "The QR could not be saved.";
    return Response.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ tripId: string }> },
) {
  const context = await getSessionContext();
  if (!context) {
    return Response.json({ error: "Not signed in." }, { status: 401 });
  }

  const { tripId } = await params;
  if (tripId !== context.trip.id) {
    return Response.json({ error: "Unknown trip." }, { status: 404 });
  }

  try {
    await removePaymentQr(context);
    return Response.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof PaymentQrError ? error.message : "The QR could not be removed.";
    return Response.json({ error: message }, { status: 400 });
  }
}
