"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import type { Place } from "@/lib/db/types";

type Props = {
  places: Pick<Place, "id" | "name" | "lat" | "lng" | "location_type">[];
};

const Map = dynamic(() => import("./leaflet-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center rounded-2xl border-2 border-dashed border-silver-deep bg-cream/70">
      <p className="text-sm font-semibold text-ink-soft">Loading map…</p>
    </div>
  ),
});

export function TripMap({ places }: Props) {
  const center = useMemo(
    () =>
      places.length > 0
        ? { lat: places[0].lat, lng: places[0].lng }
        : { lat: 19.076, lng: 72.8777 },
    [places],
  );

  return <Map places={places} center={center} />;
}
