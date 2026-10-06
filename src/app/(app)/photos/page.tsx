import { ScreenHeader } from "@/components/shell/screen-header";
import { requireSession } from "@/lib/auth/context";
import { formatTripDates, tripHasEnded } from "@/lib/constants";
import { BoothBoard } from "./booth-board";

export default async function PhotosPage() {
  const { trip } = await requireSession();
  const ended = tripHasEnded(trip.end_date);
  const dateLabel = formatTripDates(trip.start_date, trip.end_date);

  return (
    <>
      <ScreenHeader
        title="Photos"
        subtitle={
          ended ? "Print the memories, just as they happened" : "Shoot it, theme it, keep it"
        }
      />
      <BoothBoard
        tripName={trip.name}
        dateLabel={dateLabel}
        place={trip.destination}
        locationType={trip.location_type}
      />
    </>
  );
}
