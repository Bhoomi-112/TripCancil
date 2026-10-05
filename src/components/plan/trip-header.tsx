import { Badge } from "@/components/ui/badge";
import { AvatarStack } from "@/components/ui/avatar";
import { PinIcon, SparkleIcon, StarIcon } from "@/components/ui/icons";
import { Window } from "@/components/ui/window";
import { LOCATION_TYPE_LABELS, formatTripDates } from "@/lib/constants";
import type { Tables } from "@/lib/db/types";

type Trip = Pick<
  Tables<"trips">,
  "name" | "destination" | "start_date" | "end_date" | "location_type"
>;

/**
 * Trip home header: name, when, where, who. Server-rendered from the session so
 * it is right on the first paint; only the itinerary below it polls.
 */
export function TripHeader({
  trip,
  memberNames,
}: {
  trip: Trip;
  memberNames: string[];
}) {
  return (
    <Window
      title="trip.exe"
      tone="chrome"
      icon={<SparkleIcon className="size-3.5 text-electric" />}
      actions={
        <Badge tone="pop" icon={<StarIcon className="size-3" />}>
          {memberNames.length} going
        </Badge>
      }
      className="mb-4"
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="chrome-text font-display text-xl uppercase leading-7 tracking-tight sm:text-2xl sm:leading-8">
              {trip.name}
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-bold text-ink-soft">
              <span className="inline-flex items-center gap-1">
                <PinIcon className="size-4 text-hotpink" />
                {trip.destination}
              </span>
              <span aria-hidden="true" className="text-silver-deep">
                {"·"}
              </span>
              <span>{formatTripDates(trip.start_date, trip.end_date)}</span>
            </p>
          </div>
          {trip.location_type && (
            <Badge tone="bubble" sticker icon={<StarIcon className="size-3" />}>
              {LOCATION_TYPE_LABELS[trip.location_type]}
            </Badge>
          )}
        </div>
        <div className="flex items-center justify-between gap-3 rounded-2xl border-2 border-dashed border-silver-deep/70 bg-cream/70 px-3 py-2">
          <AvatarStack names={memberNames} max={6} size="sm" />
          <p className="text-xs font-extrabold uppercase tracking-tight text-ink-soft">
            The crew
          </p>
        </div>
      </div>
    </Window>
  );
}