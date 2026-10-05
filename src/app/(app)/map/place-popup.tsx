"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useSWRConfig } from "swr";
import {
  LOCATION_TYPE_COLOURS,
  LOCATION_TYPE_LABELS,
} from "@/lib/constants";
import type { LocationType } from "@/lib/db/types";
import { idleState } from "@/lib/actions/state";
import type { TripDay } from "@/lib/itinerary/days";
import { isPlacesKey, type MapPlace } from "@/lib/maps/places";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { addPlaceToDayAction } from "./actions";

type Props = {
  place: MapPlace;
  days: TripDay[];
  day: number | "all";
  editable: boolean;
};

export function PlacePopup({ place, days, day, editable }: Props) {
  const [state, add, adding] = useActionState(addPlaceToDayAction, idleState);
  const { mutate } = useSWRConfig();
  const toast = useToast();
  const announced = useRef(false);
  const [target, setTarget] = useState<number>(day === "all" ? 0 : day);

  useEffect(() => {
    if (!state.ok || announced.current) return;
    announced.current = true;
    toast.success(`${place.name} is on ${days[target]?.label ?? "the plan"}.`);
    void mutate(isPlacesKey);
  });

  const alreadyOn = place.days.includes(target);
  const stop = day !== "all" ? place.days.indexOf(day) + 1 : 0;

  return (
    <div className="flex min-w-40 flex-col gap-1.5 font-sans">
      <p className="text-sm leading-tight font-extrabold text-ink">{place.name}</p>

      <div className="flex flex-wrap items-center gap-1">
        {place.locationType ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-ink-soft">
            <span
              className="size-2.5 rounded-full border border-ink/20"
              style={{ background: LOCATION_TYPE_COLOURS[place.locationType as LocationType] }}
              aria-hidden="true"
            />
            {LOCATION_TYPE_LABELS[place.locationType as LocationType]}
          </span>
        ) : null}
        {place.category ? (
          <span className="text-[11px] font-semibold text-ink-soft">
            {place.category}
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-1">
        <Badge tone={place.status === "locked" ? "bubble" : "chrome"}>
          {place.status === "locked" ? "Locked in" : "Candidate"}
        </Badge>
        {place.days.length > 0 ? (
          <span className="text-[11px] font-bold text-ink-soft">
            {place.days
              .map((index) => days[index]?.label ?? `Day ${index + 1}`)
              .join(", ")}
            {stop ? ` · stop ${stop}` : ""}
          </span>
        ) : (
          <span className="text-[11px] font-semibold text-ink-soft">
            Not in the plan yet
          </span>
        )}
      </div>

      {editable ? (
        <form action={add} className="mt-1 flex flex-col gap-1.5">
          <input type="hidden" name="placeId" value={place.id} />
          <input type="hidden" name="dayIndex" value={target} />
          <label>
            <span className="sr-only">Day for {place.name}</span>
            <Select
              value={target}
              onChange={(event) => setTarget(Number(event.target.value))}
              className="h-9 py-0 text-xs"
            >
              {days.map((entry) => (
                <option key={entry.index} value={entry.index}>
                  {entry.chip}
                </option>
              ))}
            </Select>
          </label>
          <Button
            type="submit"
            variant="pop"
            size="sm"
            loading={adding}
            disabled={alreadyOn}
            block
          >
            {alreadyOn ? "Already on that day" : "Add to that day"}
          </Button>
        </form>
      ) : null}

      {state.error ? (
        <p className="text-[11px] font-extrabold text-hotpink-deep">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}