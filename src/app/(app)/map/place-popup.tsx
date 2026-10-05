"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useSWRConfig } from "swr";
import { cn } from "@/lib/cn";
import {
  LOCATION_TYPE_COLOURS,
  LOCATION_TYPE_LABELS,
} from "@/lib/constants";
import type { LocationType } from "@/lib/db/types";
import { idleState } from "@/lib/actions/state";
import type { TripDay } from "@/lib/itinerary/days";
import {
  isPlacesKey,
  myVoteFor,
  type MapPlace,
  type VoteValue,
} from "@/lib/maps/places";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { addPlaceToDayAction, voteOnPlaceAction } from "./actions";

type Props = {
  place: MapPlace;
  days: TripDay[];
  day: number | "all";
  editable: boolean;
  viewerId: string;
};

export function PlacePopup({
  place,
  days,
  day,
  editable,
  viewerId,
}: Props) {
  const [state, add, adding] = useActionState(addPlaceToDayAction, idleState);
  const { mutate } = useSWRConfig();
  const toast = useToast();
  const announced = useRef(false);
  const [target, setTarget] = useState<number>(day === "all" ? 0 : day);
  const [busy, setBusy] = useState<VoteValue | null>(null);
  const [pending, setPending] = useState<VoteValue | null | undefined>(undefined);

  useEffect(() => {
    if (!state.ok || announced.current) return;
    announced.current = true;
    toast.success(`${place.name} is on ${days[target]?.label ?? "the plan"}.`);
    void mutate(isPlacesKey);
  });

  const alreadyOn = place.days.includes(target);
  const stop = day !== "all" ? place.days.indexOf(day) + 1 : 0;
  const mine = pending === undefined ? myVoteFor(place, viewerId) : pending;

  async function vote(value: VoteValue) {
    if (busy) return;
    setBusy(value);
    setPending(mine === value ? null : value);
    try {
      const result = await voteOnPlaceAction(place.id, value);
      if (result.error) {
        setPending(undefined);
        toast.error(result.error);
        return;
      }
      await mutate(isPlacesKey);
      setPending(undefined);
    } finally {
      setBusy(null);
    }
  }

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

      {editable && place.status !== "locked" ? (
        <div className="mt-1 flex items-center gap-1.5">
          <span className="font-display text-[9px] uppercase tracking-tight text-ink-soft">
            {place.votes.up} in · {place.votes.down} out
          </span>
          <button
            type="button"
            onClick={() => vote(1)}
            aria-pressed={mine === 1}
            aria-label={`Vote yes for ${place.name}`}
            className={cn(
              "ml-auto rounded-full border-2 px-2 py-0.5 font-display text-[9px] uppercase tracking-tight",
              mine === 1
                ? "border-ink bg-lime text-ink shadow-sticker"
                : "border-silver-deep bg-white text-ink-soft",
            )}
          >
            In
          </button>
          <button
            type="button"
            onClick={() => vote(-1)}
            aria-pressed={mine === -1}
            aria-label={`Vote no for ${place.name}`}
            className={cn(
              "rounded-full border-2 px-2 py-0.5 font-display text-[9px] uppercase tracking-tight",
              mine === -1
                ? "border-ink bg-hotpink text-white shadow-sticker"
                : "border-silver-deep bg-white text-ink-soft",
            )}
          >
            Out
          </button>
        </div>
      ) : null}

      {state.error ? (
        <p className="text-[11px] font-extrabold text-hotpink-deep">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}