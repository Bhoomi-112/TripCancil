import type { Database } from "./db/types";

type LocationType = Database["public"]["Enums"]["location_type"];

/** `satisfies` rejects a typo; the label record below rejects a missing value. */
export const LOCATION_TYPES = [
  "beach",
  "mountain",
  "city",
  "forest",
  "desert",
  "heritage",
  "snow",
  "roadtrip",
] as const satisfies readonly LocationType[];

export const LOCATION_TYPE_LABELS: Record<LocationType, string> = {
  beach: "Beach",
  mountain: "Mountain",
  city: "City",
  forest: "Forest",
  desert: "Desert",
  heritage: "Heritage",
  snow: "Snow",
  roadtrip: "Road trip",
};

const DATE_FORMAT = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

export function formatTripDates(startDate: string, endDate: string): string {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return `${startDate} - ${endDate}`;
  }
  if (startDate === endDate) return DATE_FORMAT.format(start);
  const sameMonth =
    start.getUTCMonth() === end.getUTCMonth() &&
    start.getUTCFullYear() === end.getUTCFullYear();
  return sameMonth
    ? `${DATE_FORMAT.format(start)}-${DATE_FORMAT.format(end)} ${end.getUTCFullYear()}`
    : `${DATE_FORMAT.format(start)} - ${DATE_FORMAT.format(end)}`;
}
