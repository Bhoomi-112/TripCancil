"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { LOCATION_TYPE_LABELS } from "@/lib/constants";
import type { MapPlace } from "./trip-map";

type Props = {
  places: MapPlace[];
  center: { lat: number; lng: number };
};

// Fix for default Leaflet marker icons in Next.js
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: () => void })
  ._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

export default function LeafletMap({ places, center }: Props) {
  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={places.length > 0 ? 11 : 5}
      className="h-full w-full rounded-2xl border-2 border-silver-deep shadow-sticker"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {places.map((place) => (
        <Marker key={place.id} position={[place.lat, place.lng]}>
          <Popup>
            <div className="flex flex-col gap-1">
              <p className="font-bold text-sm">{place.name}</p>
              {place.location_type && (
                <p className="text-xs text-gray-600">
                  {LOCATION_TYPE_LABELS[place.location_type]}
                </p>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}