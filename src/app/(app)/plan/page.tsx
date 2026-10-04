import { ScreenHeader } from "@/components/shell/screen-header";
import { EmptyState } from "@/components/ui/empty-state";
import { requireSession } from "@/lib/auth/context";
import { getSupabase } from "@/lib/db/client";

export default async function PlanPage() {
  const { trip } = await requireSession();
  const supabase = getSupabase();

  const { data: itinerary } = await supabase
    .from("itinerary_items")
    .select("id, title, day, start_time, end_time, place_id")
    .eq("trip_id", trip.id)
    .order("day", { ascending: true })
    .order("start_time", { ascending: true });

  const { data: places } = await supabase
    .from("places")
    .select("id, name")
    .eq("trip_id", trip.id);

  const placeMap = new Map((places ?? []).map((p) => [p.id, p.name]));

  return (
    <>
      <ScreenHeader
        title="Plan"
        subtitle="Day by day itinerary. Add places on the map first, then slot them in."
      />
      {itinerary && itinerary.length > 0 ? (
        <div className="flex flex-col gap-2">
          {itinerary.map((item) => (
            <div
              key={item.id}
              className="flex flex-col gap-1 rounded-2xl border-2 border-silver-mid bg-white/70 p-3"
            >
              <p className="font-extrabold">{item.title}</p>
              <p className="text-sm text-ink-soft">
                Day {item.day}{" "}
                {item.start_time ? `· ${item.start_time}-${item.end_time ?? ""}` : ""}
                {item.place_id ? ` · ${placeMap.get(item.place_id)}` : ""}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          illustration="calendar"
          title="No itinerary yet"
          description="Pin places on the Map tab. Itinerary items come next."
        />
      )}
    </>
  );
}
