"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import type { Tables } from "@/lib/db/types";

export type MapPlace = Pick<
  Tables<"places">,
  "id" | "name" | "lat" | "lng" | "location_type"
>;

type Props = {
  places: MapPlace[];
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
  const center = useMemo(() => {
    if (places.length === 0) return { lat: 19.076, lng: 72.8777 };
    const lat = places.reduce((total, place) => total + place.lat, 0) / places.length;
    const lng = places.reduce((total, place) => total + place.lng, 0) / places.length;
    return { lat, lng };
  }, [places]);

  return <Map places={places} center={center} />;
}