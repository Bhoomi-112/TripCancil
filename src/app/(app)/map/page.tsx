import { ScreenHeader } from "@/components/shell/screen-header";
import { requireSession } from "@/lib/auth/context";
import { isOwner } from "@/lib/auth/roles";
import { tripHasEnded } from "@/lib/constants";
import { tripDays } from "@/lib/itinerary/days";
import { readMapData } from "@/lib/maps/service";
import { MapBoard } from "./map-board";

export default async function MapPage() {
  const { trip, member } = await requireSession();
  const ended = tripHasEnded(trip.end_date);

  // Same pure builder the polling route uses, so the first paint and every 5s
  // refresh are the same shape.
  const payload = await readMapData(trip.id);
  const days = tripDays(trip.start_date, trip.end_date);
  const stops = payload.routes.reduce(
    (total, route) => total + route.placeIds.length,
    0,
  );
  const candidates = payload.places.filter(
    (place) => place.status !== "locked",
  ).length;

  return (
    <>
      <ScreenHeader
        title="Map"
        subtitle={
          ended
            ? "Every pin from the trip, in visit order"
            : "Pins by vibe, day by day"
        }
        badge={ended ? "Read-only" : undefined}
      />
      <MapBoard
        tripId={trip.id}
        days={days}
        initial={payload}
        editable={!ended}
        viewerId={member.id}
        isOwner={isOwner({ member, trip })}
      />
      <p className="mt-2 text-center text-[11px] font-semibold text-ink-soft">
        {payload.places.length} pins · {stops} planned stops · {candidates} on the
        ballot
      </p>
    </>
  );
}