import { getSessionContext } from "@/lib/auth/context";
import { PackingError, readPacking } from "@/lib/packing/service";

export const dynamic = "force-dynamic";

/**
 * Polled by the packing board every 5s so the crew sees a check-off or a new
 * item without refreshing. Personal items are filtered to the signed-in member
 * in `readPacking`, and `tripId` in the path is checked against the session.
 */
export async function GET(
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
    return Response.json(await readPacking(context.trip.id, context.member.id));
  } catch (error) {
    const message =
      error instanceof PackingError
        ? error.message
        : "Could not load the packing list.";
    return Response.json({ error: message }, { status: 500 });
  }
}