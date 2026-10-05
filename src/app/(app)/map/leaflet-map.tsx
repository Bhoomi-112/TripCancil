"use client";

import { useEffect, useMemo } from "react";
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { LOCATION_TYPE_COLOURS } from "@/lib/constants";
import type { TripDay } from "@/lib/itinerary/days";
import type { MapPlace } from "@/lib/maps/places";
import { PlacePopup } from "./place-popup";

type Props = {
  places: MapPlace[];
  /** Visit order for the selected day; a straight line connects them. */
  line: MapPlace[];
  /** Place id to "stop 1 of 3" number, shown on the pin when a day is picked. */
  order: Map<string, number>;
  days: TripDay[];
  day: number | "all";
  editable: boolean;
};

const PIN_SIZE = 30;

/**
 * A pin is a divIcon rather than Leaflet's PNG pin so the fill can carry the
 * vibe colour and the stop number. It also means the map loads no marker images
 * from a CDN at runtime.
 */
function pinIcon(colour: string, label: string | null) {
  return L.divIcon({
    className: "tc-pin",
    html: `<span class="tc-pin__body" style="--pin:${colour}">${
      label ?? ""
    }</span>`,
    iconSize: [PIN_SIZE, PIN_SIZE],
    iconAnchor: [PIN_SIZE / 2, PIN_SIZE / 2],
    popupAnchor: [0, -(PIN_SIZE / 2 + 2)],
  });
}

/** Centre on the pins, or on the trip's rough middle when there are none. */
function centreFor(places: MapPlace[]): { lat: number; lng: number } {
  if (places.length === 0) return { lat: 19.076, lng: 72.8777 };
  const lat =
    places.reduce((total, place) => total + place.lat, 0) / places.length;
  const lng =
    places.reduce((total, place) => total + place.lng, 0) / places.length;
  return { lat, lng };
}

/**
 * Keeps the visible pins in view. Leaflet ignores a changed `zoom` prop after the
 * map has mounted, so without this a day filter that moves the group across the
 * state would leave the screen staring at empty countryside.
 */
function FitToPins({ places }: { places: MapPlace[] }) {
  const map = useMap();
  const signature = places.map((place) => place.id).join(",");

  useEffect(() => {
    if (places.length === 0) return;
    if (places.length === 1) {
      map.setView([places[0].lat, places[0].lng], 13, { animate: true });
      return;
    }
    map.fitBounds(
      places.map((place) => [place.lat, place.lng] as [number, number]),
      { padding: [48, 48], maxZoom: 14, animate: true },
    );
    // `signature` is the real dependency: the array identity changes every poll
    // even when the pins are the same three.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, signature]);

  return null;
}

export default function LeafletMap({
  places,
  line,
  order,
  days,
  day,
  editable,
}: Props) {
  const centre = useMemo(() => centreFor(places), [places]);
  const positions = line.map((place) => [place.lat, place.lng] as [number, number]);

  return (
    <MapContainer
      center={[centre.lat, centre.lng]}
      zoom={places.length === 0 ? 5 : 11}
      scrollWheelZoom={false}
      className="h-full w-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <FitToPins places={places} />

      {positions.length > 1 ? (
        <>
          {/* White casing under the dashes so the line reads over any tile. */}
          <Polyline
            positions={positions}
            pathOptions={{ color: "#fff4e2", weight: 8, opacity: 0.9 }}
          />
          <Polyline
            positions={positions}
            pathOptions={{
              color: "#ff3d9a",
              weight: 4,
              dashArray: "2 10",
              lineCap: "round",
            }}
          />
        </>
      ) : null}

      {places.map((place) => {
        const colour = place.locationType
          ? LOCATION_TYPE_COLOURS[place.locationType]
          : "#5d4c85";
        const stop = order.get(place.id);
        return (
          <Marker
            key={place.id}
            position={[place.lat, place.lng]}
            icon={pinIcon(colour, stop ? String(stop) : null)}
            title={place.name}
          >
            <Popup>
              <PlacePopup
                place={place}
                days={days}
                day={day}
                editable={editable}
              />
            </Popup>
          </Marker>
        );
      })}

    </MapContainer>
  );
}