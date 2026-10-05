import { getSessionContext } from "@/lib/auth/context";
import { MapError, readMapData } from "@/lib/maps/service";

export const dynamic = "force-dynamic";

/**
 * Polled by the map every 5s so a member sees pins land as the group adds them.
 * Returns only pin coordinates and visit order for the signed-in member's own
 * trip; `tripId` in the path is checked against the session rather than trusted.
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
    return Response.json(await readMapData(context.trip.id));
  } catch (error) {
    const message =
      error instanceof MapError ? error.message : "Could not load the map.";
    return Response.json({ error: message }, { status: 500 });
  }
}