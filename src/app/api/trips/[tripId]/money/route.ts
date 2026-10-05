import { getSessionContext } from "@/lib/auth/context";
import { MoneyError, readMoney } from "@/lib/money/service";

export const dynamic = "force-dynamic";

/**
 * Polled by the money board every 5s, so a chai run logged on one phone shows up
 * on everyone else's balances. Returns only the signed-in member's own trip;
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
    return Response.json(await readMoney(context.trip.id));
  } catch (error) {
    const message =
      error instanceof MoneyError ? error.message : "Could not load the ledger.";
    return Response.json({ error: message }, { status: 500 });
  }
}
