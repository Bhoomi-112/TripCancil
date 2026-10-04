import { ScreenHeader } from "@/components/shell/screen-header";
import { EmptyState } from "@/components/ui/empty-state";
import { requireSession } from "@/lib/auth/context";
import { getSupabase } from "@/lib/db/client";
import { TripMap } from "./trip-map";

export default async function MapPage() {
  const { trip } = await requireSession();
  const supabase = getSupabase();

  const { data: places } = await supabase
    .from("places")
    .select("id, name, lat, lng, location_type")
    .eq("trip_id", trip.id)
    .order("created_at", { ascending: true });

  return (
    <>
      <ScreenHeader title="Map" subtitle="Pins for all the places you are keen to hit" />
      <div className="h-[calc(100vh-12rem)] md:h-[calc(100vh-8rem)]">
        {places && places.length > 0 ? (
          <TripMap places={places} />
        ) : (
          <EmptyState
            illustration="mountain"
            title="No places pinned yet"
            description="Add places from the plan screen or via search — they will show up here on the map."
          />
        )}
      </div>
    </>
  );
}
