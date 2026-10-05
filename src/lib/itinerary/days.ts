/**
 * Day maths for the itinerary. Deliberately pure and free of `server-only` so
 * the plan screen and the server actions can share one definition of "day 3".
 *
 * `day_index` is 0-based in the database and 1-based on screen, and it is always
 * derived from the trip dates rather than stored, so a date edit cannot leave
 * orphaned days behind.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** A trip longer than this would need a different navigation model than chips. */
export const MAX_TRIP_DAYS = 30;

export type TripDay = {
  /** 0-based, matches `itinerary_items.day_index`. */
  index: number;
  /** "Day 1" */
  label: string;
  /** "Fri" */
  weekday: string;
  /** "12 Sep" */
  date: string;
  /** The whole chip reads "Day 1 · Fri 12 Sep". */
  chip: string;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function utcDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Days between the two trip dates, inclusive. A trip that starts and ends on the
 * same day is one day; anything unparseable still yields one day so the screen
 * is never unusable.
 */
export function tripDays(
  startDate: string,
  endDate: string,
  limit = MAX_TRIP_DAYS,
): TripDay[] {
  const start = utcDate(startDate);
  const end = utcDate(endDate);
  if (!start || !end) return [makeDay(0, new Date())];

  const span = Math.max(0, Math.round((end.getTime() - start.getTime()) / DAY_MS));
  const count = Math.min(span + 1, Math.max(1, limit));

  return Array.from({ length: count }, (_, index) =>
    makeDay(index, new Date(start.getTime() + index * DAY_MS)),
  );
}

function makeDay(index: number, date: Date): TripDay {
  const weekday = WEEKDAYS[date.getUTCDay()];
  const day = date.getUTCDate();
  const month = MONTHS[date.getUTCMonth()];
  const label = `Day ${index + 1}`;
  return {
    index,
    label,
    weekday,
    date: `${day} ${month}`,
    chip: `${label} · ${weekday} ${day} ${month}`,
  };
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** "18:30:00" (what Postgres `time` returns) or "18:30" (what a form posts). */
export function normaliseTime(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(trimmed);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  const paddedHours = String(hours).padStart(2, "0");
  return `${paddedHours}:${String(minutes).padStart(2, "0")}:00`;
}

/** "18:30:00" -> "6:30 pm", or null when there is no time at all. */
export function formatClock(value: string | null): string | null {
  if (!value) return null;
  const match = /^(\d{2}):(\d{2})/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = match[2];
  const suffix = hours < 12 ? "am" : "pm";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${minutes} ${suffix}`;
}

/** "18:30:00" -> "18:30" for `<input type="time">`. */
export function toTimeInput(value: string | null): string {
  return value ? value.slice(0, 5) : "";
}

/** Stable sort by `position`, falling back to creation order for ties. */
export function byPosition<T extends { position: number; created_at: string }>(
  a: T,
  b: T,
): number {
  if (a.position !== b.position) return a.position - b.position;
  return a.created_at.localeCompare(b.created_at);
}