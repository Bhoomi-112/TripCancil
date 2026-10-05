import { TripHeader } from "@/components/plan/trip-header";
import { requireSession } from "@/lib/auth/context";
import { getSupabase } from "@/lib/db/client";
import { tripDays } from "@/lib/itinerary/days";
import { readItinerary } from "@/lib/itinerary/service";
import { PlanBoard } from "./plan-board";

export default async function PlanPage() {
  const { trip } = await requireSession();
  const supabase = getSupabase();

  const [itinerary, members] = await Promise.all([
    readItinerary(trip.id),
    supabase
      .from("members")
      .select("display_name")
      .eq("trip_id", trip.id)
      .order("created_at", { ascending: true }),
  ]);

  const memberNames = (members.data ?? []).map((member) => member.display_name);

  return (
    <>
      <TripHeader trip={trip} memberNames={memberNames} />
      <PlanBoard
        tripId={trip.id}
        days={tripDays(trip.start_date, trip.end_date)}
        initial={itinerary}
      />
    </>
  );
}