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

/** Today in UTC, matching how trip dates are stored (`date`, not `timestamptz`). */
export function todayUtcISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * A trip is over once its last day is behind us. Trips that are running or still
 * to come stay editable and deletable; ended trips are read-only, which is what
 * makes "read my past trip" safe to offer without a second thought.
 */
export function tripHasEnded(endDate: string, today: string = todayUtcISO()): boolean {
  return endDate < today;
}

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
