"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import useSWR from "swr";
import {
  LOCATION_TYPE_COLOURS,
  LOCATION_TYPE_LABELS,
  LOCATION_TYPES,
} from "@/lib/constants";
import type { LocationType } from "@/lib/db/types";
import type { TripDay } from "@/lib/itinerary/days";
import {
  routeDistanceKm,
  routeForDay,
  visitOrder,
  type MapPayload,
  type MapPlace,
} from "@/lib/maps/places";
import { cn } from "@/lib/cn";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PlaceSearch } from "./place-search";

const LeafletMap = dynamic(() => import("./leaflet-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center rounded-2xl border-2 border-dashed border-silver-deep bg-cream/70">
      <p className="text-sm font-semibold text-ink-soft">Loading map…</p>
    </div>
  ),
});

type Props = {
  tripId: string;
  days: TripDay[];
  initial: MapPayload;
  editable: boolean;
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function MapBoard({ tripId, days, initial, editable }: Props) {
  // "All days" is a string, because day index 0 is a real day and `null` would
  // have to mean both "no filter" and "day one".
  const [day, setDay] = useState<number | "all">("all");
  const [types, setTypes] = useState<LocationType[]>([]);

  const { data } = useSWR<MapPayload>(`/api/trips/${tripId}/places`, fetcher, {
    fallbackData: initial,
    refreshInterval: 5000,
    keepPreviousData: true,
  });
  const payload = data ?? initial;

  const route = routeForDay(payload, day);

  // Day filter first, then the vibe filter, so the number on each vibe chip is a
  // count within the day you are actually looking at.
  const dayPlaces = useMemo(
    () =>
      route
        ? payload.places.filter((place) => route.placeIds.includes(place.id))
        : payload.places,
    [payload, route],
  );
  const visible = useMemo(
    () =>
      types.length === 0
        ? dayPlaces
        : dayPlaces.filter(
            (place) => place.locationType && types.includes(place.locationType),
          ),
    [dayPlaces, types],
  );

  const counts = useMemo(() => {
    const tally = new Map<LocationType, number>();
    for (const place of dayPlaces) {
      if (!place.locationType) continue;
      tally.set(place.locationType, (tally.get(place.locationType) ?? 0) + 1);
    }
    return tally;
  }, [dayPlaces]);

  // A polyline through the stops that survived the vibe filter, so hiding a pin
  // never leaves a line running to it.
  const line = route
    ? route.placeIds
        .map((id) => dayPlaces.find((place) => place.id === id))
        .filter((place): place is MapPlace => Boolean(place))
        .filter((place) => visible.includes(place))
    : [];

  const present = LOCATION_TYPES.filter((type) => counts.has(type));
  const km = routeDistanceKm(route, dayPlaces);
  const order = visitOrder(route);

  function toggleType(type: LocationType) {
    setTypes((current) =>
      current.includes(type)
        ? current.filter((value) => value !== type)
        : [...current, type],
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2 overflow-x-auto pb-1">
        <DayChip active={day === "all"} onClick={() => setDay("all")}>
          All days
        </DayChip>
        {days.map((entry) => {
          const count = payload.routes.find(
            (entryRoute) => entryRoute.dayIndex === entry.index,
          )?.placeIds.length;
          return (
            <DayChip
              key={entry.index}
              active={day === entry.index}
              onClick={() => setDay(entry.index)}
            >
              {entry.label}
              {count ? <span className="opacity-70">{count}</span> : null}
            </DayChip>
          );
        })}
      </div>

      {present.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {present.map((type) => {
            const active = types.includes(type);
            return (
              <button
                key={type}
                type="button"
                onClick={() => toggleType(type)}
                aria-pressed={active}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border-2 px-2.5 py-1 font-display text-[9px] uppercase tracking-tight transition-transform duration-150 active:translate-y-[2px]",
                  active
                    ? "border-ink bg-white shadow-sticker"
                    : "border-silver-deep bg-white/60",
                )}
              >
                <span
                  className="size-2.5 rounded-full border border-ink/20"
                  style={{ background: LOCATION_TYPE_COLOURS[type] }}
                  aria-hidden="true"
                />
                {LOCATION_TYPE_LABELS[type]}
                <span className="text-ink-soft">{counts.get(type)}</span>
              </button>
            );
          })}
          {types.length > 0 ? (
            <button
              type="button"
              onClick={() => setTypes([])}
              className="rounded-full px-2 py-1 font-display text-[9px] uppercase tracking-tight text-electric underline-offset-2 hover:underline"
            >
              Clear
            </button>
          ) : null}
        </div>
      ) : null}

      {day !== "all" && km !== null ? (
        <p className="text-xs font-bold text-ink-soft">
          {route?.placeIds.length} stops · about {km} km end to end
        </p>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-[20rem,1fr] lg:items-start">
        <PlaceSearch days={days} day={day} editable={editable} />

        <div className="h-[58vh] min-h-80 overflow-hidden rounded-2xl lg:h-[calc(100vh-15rem)]">
          {visible.length > 0 ? (
            <LeafletMap
              places={visible}
              line={line}
              order={order}
              days={days}
              day={day}
              editable={editable}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <EmptyState
                illustration="map"
                title={
                  dayPlaces.length > 0
                    ? "Nothing matches those vibes"
                    : "No places pinned yet"
                }
                description={
                  dayPlaces.length > 0
                    ? "Clear the vibe filters to see the rest of this day."
                    : "Find a spot on the left, or add a stop from the Plan tab."
                }
                action={
                  types.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => setTypes([])}
                      className={buttonClass({ variant: "ghost", size: "sm" })}
                    >
                      Clear filters
                    </button>
                  ) : undefined
                }
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DayChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={buttonClass({
        variant: active ? "primary" : "chrome",
        size: "sm",
        className: "shrink-0",
      })}
    >
      {children}
    </button>
  );
}