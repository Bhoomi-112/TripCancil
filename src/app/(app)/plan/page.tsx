import { ScreenHeader } from "@/components/shell/screen-header";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonCard } from "@/components/ui/skeleton";

export default function PlanPage() {
  return (
    <>
      <ScreenHeader
        title="Plan"
        subtitle="Day-by-day itinerary lands in the next prompt"
      />
      <div className="grid gap-4 md:grid-cols-2">
        <SkeletonCard />
        <SkeletonCard />
      </div>
      <EmptyState
        className="mt-4"
        illustration="beach"
        title="No itinerary yet"
        description="Days are derived from your trip dates, then you drag stops into place."
      />
    </>
  );
}
