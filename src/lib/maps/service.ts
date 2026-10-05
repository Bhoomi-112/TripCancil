import "server-only";

import type { SessionContext } from "@/lib/auth/context";
import { isOwner } from "@/lib/auth/roles";
import { getSupabase } from "@/lib/db/client";
import { tripHasEnded } from "@/lib/constants";
import { createItem } from "@/lib/itinerary/service";
import {
  buildMapPayload,
  type MapPayload,
  type MapPlaceRow,
  type VoteValue,
} from "@/lib/maps/places";
import type {
  ProposePlaceInput,
  SearchResultInput,
} from "@/lib/validation/places";

/** A problem the map UI can show verbatim, e.g. "That day is outside this trip." */
export class MapError extends Error {}

/**
 * Past trips are read-only, same rule as the plan board: adding a pin or a stop
 * to a trip that is already over would quietly edit a memory.
 */
function assertTripEditable(context: SessionContext): void {
  if (tripHasEnded(context.trip.end_date)) {
    throw new MapError(
      `"${context.trip.name}" is over, so the map is read-only now.`,
    );
  }
}

export async function readMapData(tripId: string): Promise<MapPayload> {
  const supabase = getSupabase();

  // Votes come back embedded on each pin: `place_votes` has no trip_id of its
  // own, and a second round trip filtered by place ids would be a query for
  // numbers the ballot already has in its hand.
  const [places, items, members] = await Promise.all([
    supabase
      .from("places")
      .select(
        "id, name, lat, lng, category, location_type, status, proposed_by, place_votes(member_id, value)",
      )
      .eq("trip_id", tripId),
    supabase
      .from("itinerary_items")
      .select("id, day_index, position, created_at, place_id, title")
      .eq("trip_id", tripId),
    supabase
      .from("members")
      .select("id, display_name")
      .eq("trip_id", tripId),
  ]);

  if (places.error) throw new MapError(places.error.message);
  if (items.error) throw new MapError(items.error.message);
  if (members.error) throw new MapError(members.error.message);

  return buildMapPayload({
    places: places.data ?? [],
    items: items.data ?? [],
    members: members.data ?? [],
  });
}

export async function proposePlace(
  context: SessionContext,
  input: ProposePlaceInput,
): Promise<string> {
  assertTripEditable(context);
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("places")
    .insert({
      trip_id: context.trip.id,
      proposed_by: context.member.id,
      name: input.name,
      lat: input.lat,
      lng: input.lng,
      category: input.category || null,
      location_type: input.locationType,
      // A pin nobody has put in the plan yet: the group decides later.
      status: "proposed",
    })
    .select("id")
    .single();

  if (error) throw new MapError(error.message);
  return data.id;
}

async function loadPlaceForTrip(
  tripId: string,
  placeId: string,
): Promise<MapPlaceRow | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("places")
    .select("id, trip_id, name, lat, lng, category, location_type, status")
    .eq("id", placeId)
    .maybeSingle();
  if (error) throw new MapError(error.message);
  // Same rule as the itinerary service: someone else's pin reads as "not found"
  // rather than as an error the UI has to explain.
  return data && data.trip_id === tripId ? data : null;
}

/** "Alibaug  beach" and "alibaug beach" are the same pin to a human. */
function normaliseName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Pins an existing place onto a day. Reuses the itinerary service so the day
 * bounds, the position and the ended-trip gate are enforced in exactly one
 * place, then locks the pin: a place that is in the plan is no longer a
 * candidate.
 */
export async function addPlaceToDay(
  context: SessionContext,
  input: { placeId: string; dayIndex: number },
): Promise<void> {
  assertTripEditable(context);
  const place = await loadPlaceForTrip(context.trip.id, input.placeId);
  if (!place) throw new MapError("That place is not on this trip's map.");

  await createItem(context, {
    dayIndex: input.dayIndex,
    title: place.name,
    placeId: place.id,
    startTime: "",
    notes: "",
  });

  if (place.status !== "locked") {
    const supabase = getSupabase();
    const { error } = await supabase
      .from("places")
      .update({ status: "locked" })
      .eq("id", place.id)
      .eq("trip_id", context.trip.id);
    if (error) throw new MapError(error.message);
  }
}

/**
 * One member, one vote per place. Voting the same way again takes the vote back,
 * so "I meant the other one" is a second tap and not a support ticket.
 *
 * `member_id` comes from the session, never from the client: a vote is only ever
 * in the name of the person whose PIN it was.
 */
export async function voteOnPlace(
  context: SessionContext,
  input: { placeId: string; value: VoteValue },
): Promise<void> {
  assertTripEditable(context);
  if (input.value !== 1 && input.value !== -1) {
    throw new MapError("That is not a vote.");
  }

  const place = await loadPlaceForTrip(context.trip.id, input.placeId);
  if (!place) throw new MapError("That place is not on this trip's map.");
  if (place.status === "locked") {
    throw new MapError(`${place.name} is already in the plan, so it is settled.`);
  }

  const supabase = getSupabase();
  const existing = await supabase
    .from("place_votes")
    .select("value")
    .eq("place_id", input.placeId)
    .eq("member_id", context.member.id)
    .maybeSingle();
  if (existing.error) throw new MapError(existing.error.message);

  if (existing.data?.value === input.value) {
    const { error } = await supabase
      .from("place_votes")
      .delete()
      .eq("place_id", input.placeId)
      .eq("member_id", context.member.id);
    if (error) throw new MapError(error.message);
    return;
  }

  // `defaultToNull: false` matters even on a single row: PostgREST builds the
  // column list from the union of the keys it is given, and created_at has a
  // default only if the key is left out entirely.
  const { error } = await supabase.from("place_votes").upsert(
    {
      place_id: input.placeId,
      member_id: context.member.id,
      value: input.value,
    },
    { onConflict: "place_id,member_id", defaultToNull: false },
  );
  if (error) throw new MapError(error.message);
}

/**
 * The owner's call on a ballot: the winning pin becomes a stop on a chosen day
 * and stops being a candidate. It is `addPlaceToDay` with the owner's name on it,
 * so the day bounds, the position, the place-belongs-to-this-trip check and the
 * ended-trip gate all stay in the one place they already live.
 */
export async function lockInPlace(
  context: SessionContext,
  input: { placeId: string; dayIndex: number },
): Promise<void> {
  assertTripEditable(context);
  if (!isOwner(context)) {
    throw new MapError("Only the trip owner can lock a place into the plan.");
  }

  const place = await loadPlaceForTrip(context.trip.id, input.placeId);
  if (!place) throw new MapError("That place is not on this trip's map.");
  if (place.status === "locked") {
    throw new MapError(`${place.name} is already locked in.`);
  }

  const supabase = getSupabase();
  const { count, error } = await supabase
    .from("itinerary_items")
    .select("id", { count: "exact", head: true })
    .eq("trip_id", context.trip.id)
    .eq("place_id", input.placeId)
    .eq("day_index", input.dayIndex);
  if (error) throw new MapError(error.message);
  if ((count ?? 0) > 0) {
    throw new MapError(`${place.name} is already a stop on that day.`);
  }

  await addPlaceToDay(context, input);
}

/**
 * Drops a search hit straight into a day. Nominatim happily returns the same
 * beach twice for two phrasings, so a pin whose name already exists on this
 * trip is reused instead of duplicated.
 */
export async function addSearchResultToDay(
  context: SessionContext,
  input: SearchResultInput & { dayIndex: number },
): Promise<void> {
  assertTripEditable(context);
  const supabase = getSupabase();

  const { data: existing, error: readError } = await supabase
    .from("places")
    .select("id, trip_id, name, lat, lng, category, location_type, status")
    .eq("trip_id", context.trip.id);
  if (readError) throw new MapError(readError.message);

  const wanted = normaliseName(input.name);
  let placeId = (existing ?? []).find(
    (place) => normaliseName(place.name) === wanted,
  )?.id;

  if (!placeId) {
    const { data, error } = await supabase
      .from("places")
      .insert({
        trip_id: context.trip.id,
        proposed_by: context.member.id,
        name: input.name,
        lat: input.lat,
        lng: input.lng,
        category: input.category || null,
        // It is going into a day, so it is not up for a vote.
        status: "locked",
      })
      .select("id")
      .single();
    if (error) throw new MapError(error.message);
    placeId = data.id;
  }

  await createItem(context, {
    dayIndex: input.dayIndex,
    title: input.name,
    placeId,
    startTime: "",
    notes: "",
  });
}