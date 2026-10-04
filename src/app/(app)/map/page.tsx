import { ScreenHeader } from "@/components/shell/screen-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Window } from "@/components/ui/window";

export default function MapPage() {
  return (
    <>
      <ScreenHeader
        title="Map"
        subtitle="Pins, day routes and place search land in the next prompt"
      />
      <Window title="map.view" tone="chrome" bodyClassName="p-0">
        <div className="dotted-grid scanlines grid h-72 place-items-center">
          <EmptyState
            illustration="map"
            title="Map goes live soon"
            description="Candidate places show as colour-coded pins with day filters and a route line."
            className="border-0 bg-transparent"
          />
        </div>
      </Window>
    </>
  );
}
