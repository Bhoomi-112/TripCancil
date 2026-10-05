import { getSessionContext } from "@/lib/auth/context";
import { ItineraryError, readItinerary } from "@/lib/itinerary/service";

export const dynamic = "force-dynamic";

/**
 * Polled by the plan board every 5s so a member sees the group's edits without
 * a manual refresh. It only ever returns the signed-in member's own trip, and
 * `tripId` in the path is checked against the session rather than trusted.
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
    return Response.json(await readItinerary(context.trip.id));
  } catch (error) {
    const message =
      error instanceof ItineraryError
        ? error.message
        : "Could not load the plan.";
    return Response.json({ error: message }, { status: 500 });
  }
}