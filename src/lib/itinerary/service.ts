import "server-only";

import type { SessionContext } from "@/lib/auth/context";
import { getSupabase } from "@/lib/db/client";
import { tripHasEnded } from "@/lib/constants";
import { normaliseTime, tripDays } from "@/lib/itinerary/days";
import type { ItineraryPayload } from "@/lib/itinerary/types";
import type { ItineraryItemInput } from "@/lib/validation/itinerary";

/** A problem the UI can show verbatim, e.g. "That day is outside this trip." */
export class ItineraryError extends Error {}

function tripDayCount(context: SessionContext): number {
  return tripDays(context.trip.start_date, context.trip.end_date).length;
}

/**
 * Past trips are read-only. "My trips" can open an old trip to look at it, but a
 * trip whose last day has passed no longer takes edits, which is what makes
 * reopening one safe without a second thought. Every write here goes through it,
 * and later prompts must do the same.
 */
function assertTripEditable(context: SessionContext): void {
  if (tripHasEnded(context.trip.end_date)) {
    throw new ItineraryError(
      `"${context.trip.name}" is over, so the plan is read-only now.`,
    );
  }
}

export async function readItinerary(tripId: string): Promise<ItineraryPayload> {
  const supabase = getSupabase();

  const [items, places] = await Promise.all([
    supabase
      .from("itinerary_items")
      .select("*")
      .eq("trip_id", tripId)
      .order("day_index", { ascending: true })
      .order("position", { ascending: true }),
    supabase
      .from("places")
      .select("id, name, category, status")
      .eq("trip_id", tripId)
      .order("name", { ascending: true }),
  ]);

  if (items.error) throw new ItineraryError(items.error.message);
  if (places.error) throw new ItineraryError(places.error.message);

  return { items: items.data ?? [], places: places.data ?? [] };
}

async function assertPlaceInTrip(tripId: string, placeId: string | null) {
  if (!placeId) return null;
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("places")
    .select("id, trip_id, location_type")
    .eq("id", placeId)
    .maybeSingle();
  if (error) throw new ItineraryError(error.message);
  // A place from another trip is treated as "no place" rather than an error, so a
  // stale client cannot attach someone else's pin to this trip.
  return data && data.trip_id === tripId ? data : null;
}

async function nextPosition(tripId: string, dayIndex: number): Promise<number> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("itinerary_items")
    .select("position")
    .eq("trip_id", tripId)
    .eq("day_index", dayIndex)
    .order("position", { ascending: false })
    .limit(1);
  if (error) throw new ItineraryError(error.message);
  const top = data?.[0]?.position ?? -1;
  return top + 1;
}

export async function createItem(
  context: SessionContext,
  input: ItineraryItemInput,
): Promise<void> {
  assertTripEditable(context);
  if (input.dayIndex >= tripDayCount(context)) {
    throw new ItineraryError("That day is outside this trip.");
  }
  const place = await assertPlaceInTrip(context.trip.id, input.placeId || null);
  const position = await nextPosition(context.trip.id, input.dayIndex);

  const supabase = getSupabase();
  const { error } = await supabase.from("itinerary_items").insert({
    trip_id: context.trip.id,
    day_index: input.dayIndex,
    position,
    title: input.title,
    start_time: normaliseTime(input.startTime),
    place_id: place?.id ?? null,
    notes: input.notes || null,
    location_type: place?.location_type ?? null,
  });
  if (error) throw new ItineraryError(error.message);
}

export async function updateItem(
  context: SessionContext,
  itemId: string,
  input: ItineraryItemInput,
): Promise<void> {
  assertTripEditable(context);
  if (input.dayIndex >= tripDayCount(context)) {
    throw new ItineraryError("That day is outside this trip.");
  }
  const supabase = getSupabase();

  const { data: existing, error: lookupError } = await supabase
    .from("itinerary_items")
    .select("id, trip_id, day_index")
    .eq("id", itemId)
    .maybeSingle();
  if (lookupError) throw new ItineraryError(lookupError.message);
  if (!existing || existing.trip_id !== context.trip.id) {
    throw new ItineraryError("That plan item is not in your trip.");
  }

  const place = await assertPlaceInTrip(context.trip.id, input.placeId || null);
  // Moving an item to another day drops it on that day's end; staying put keeps
  // whatever order the member had already given it.
  const position =
    existing.day_index === input.dayIndex
      ? undefined
      : await nextPosition(context.trip.id, input.dayIndex);

  const { error } = await supabase
    .from("itinerary_items")
    .update({
      day_index: input.dayIndex,
      title: input.title,
      start_time: normaliseTime(input.startTime),
      place_id: place?.id ?? null,
      notes: input.notes || null,
      location_type: place?.location_type ?? null,
      ...(position === undefined ? {} : { position }),
    })
    .eq("id", itemId)
    .eq("trip_id", context.trip.id);
  if (error) throw new ItineraryError(error.message);
}

export async function deleteItem(
  context: SessionContext,
  itemId: string,
): Promise<void> {
  assertTripEditable(context);
  const supabase = getSupabase();
  const { error } = await supabase
    .from("itinerary_items")
    .delete()
    .eq("id", itemId)
    .eq("trip_id", context.trip.id);
  if (error) throw new ItineraryError(error.message);
}

/**
 * Persists a drag-and-drop result. The client sends the whole day in its new
 * order; anything it did not know about (another member added an item mid-drag)
 * keeps its relative order and lands after the list rather than disappearing.
 */
export async function reorderDay(
  context: SessionContext,
  dayIndex: number,
  itemIds: string[],
): Promise<void> {
  assertTripEditable(context);
  if (dayIndex >= tripDayCount(context)) {
    throw new ItineraryError("That day is outside this trip.");
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("itinerary_items")
    .select("id, position, created_at")
    .eq("trip_id", context.trip.id)
    .eq("day_index", dayIndex)
    .order("position", { ascending: true });
  if (error) throw new ItineraryError(error.message);

  const current = data ?? [];
  const known = new Set(current.map((item) => item.id));
  const seen = new Set<string>();
  const order: string[] = [];

  for (const id of itemIds) {
    if (!known.has(id) || seen.has(id)) continue;
    seen.add(id);
    order.push(id);
  }
  for (const item of current) {
    if (!seen.has(item.id)) order.push(item.id);
  }

  const results = await Promise.all(
    order.map((id, position) =>
      supabase
        .from("itinerary_items")
        .update({ position })
        .eq("id", id)
        .eq("trip_id", context.trip.id),
    ),
  );
  const failed = results.find((result) => result.error);
  if (failed?.error) throw new ItineraryError(failed.error.message);
}