import "server-only";

import type { Member, Trip } from "@/lib/auth/context";
import { getSupabase } from "@/lib/db/client";
import { LOCATION_TYPES, tripHasEnded } from "@/lib/constants";
import { tripDays } from "@/lib/itinerary/days";
import { z } from "zod";

/** The four private buckets from 001, all filed under `<trip id>/`. */
const PRIVATE_BUCKETS = ["documents", "receipts", "payment-qrs", "photos"] as const;

export class TripAdminError extends Error {}

/** What "my trips" needs per row. No pin hashes, no storage paths. */
export type TravellerTrip = {
  tripId: string;
  memberId: string;
  role: Member["role"];
  isOwner: boolean;
  name: string;
  destination: string;
  startDate: string;
  endDate: string;
  locationType: Trip["location_type"];
  memberCount: number;
  itemCount: number;
  expenseCount: number;
  photoCount: number;
  documentCount: number;
  ended: boolean;
};

export const tripDetailsSchema = z
  .object({
    name: z.string().trim().min(1, "Name the trip.").max(80),
    destination: z.string().trim().min(1, "Where are you going?").max(120),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use the date picker."),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use the date picker."),
    locationType: z.enum(LOCATION_TYPES),
  })
  .refine((values) => values.endDate >= values.startDate, {
    message: "The trip cannot end before it starts.",
    path: ["endDate"],
  });

export type TripDetailsInput = z.infer<typeof tripDetailsSchema>;

export async function listTravellerTrips(
  travellerId: string,
  today: string,
): Promise<TravellerTrip[]> {
  const supabase = getSupabase();

  const { data: memberships, error } = await supabase
    .from("members")
    // The explicit hint matters: trips also points back at members via
    // owner_member_id, so PostgREST cannot pick the embedding on its own.
    .select("id, role, trips!members_trip_id_fkey(id, name, destination, start_date, end_date, location_type, owner_member_id)")
    .eq("traveler_id", travellerId);
  if (error) throw new TripAdminError(error.message);

  const rows = (memberships ?? []).flatMap((row) => {
    const trip = Array.isArray(row.trips) ? row.trips[0] : row.trips;
    return trip ? [{ row, trip }] : [];
  });

  const tripIds = rows.map(({ trip }) => trip.id);
  if (tripIds.length === 0) return [];

  // One read per table for the whole set, instead of a count query per trip.
  const countsFor = async (
    table: "members" | "itinerary_items" | "expenses" | "photos" | "documents",
  ): Promise<Map<string, number>> => {
    const { data } = await supabase.from(table).select("trip_id").in("trip_id", tripIds);
    const counts = new Map<string, number>();
    for (const row of data ?? []) {
      const tripId = (row as { trip_id: string }).trip_id;
      counts.set(tripId, (counts.get(tripId) ?? 0) + 1);
    }
    return counts;
  };

  const [memberCounts, itemCounts, expenseCounts, photoCounts, documentCounts] =
    await Promise.all([
      countsFor("members"),
      countsFor("itinerary_items"),
      countsFor("expenses"),
      countsFor("photos"),
      countsFor("documents"),
    ]);

  return rows
    .map(({ row, trip }) => ({
      tripId: trip.id,
      memberId: row.id,
      role: row.role,
      isOwner: trip.owner_member_id === row.id,
      name: trip.name,
      destination: trip.destination,
      startDate: trip.start_date,
      endDate: trip.end_date,
      locationType: trip.location_type,
      memberCount: memberCounts.get(trip.id) ?? 0,
      itemCount: itemCounts.get(trip.id) ?? 0,
      expenseCount: expenseCounts.get(trip.id) ?? 0,
      photoCount: photoCounts.get(trip.id) ?? 0,
      documentCount: documentCounts.get(trip.id) ?? 0,
      ended: tripHasEnded(trip.end_date, today),
    }))
    .sort((a, b) => b.startDate.localeCompare(a.startDate));
}

/**
 * The one-tap reopen. It only ever returns a membership this traveller actually
 * holds: the trip id from the form is checked against the member rows whose
 * `traveler_id` is this cookie's traveller, never against the cookie alone.
 */
export async function tripAccessForTraveller(
  travellerId: string,
  tripId: string,
): Promise<{ trip: Trip; member: Member } | null> {
  const supabase = getSupabase();
  const { data: member } = await supabase
    .from("members")
    .select("*")
    .eq("traveler_id", travellerId)
    .eq("trip_id", tripId)
    .maybeSingle();
  if (!member) return null;

  const { data: trip } = await supabase
    .from("trips")
    .select("*")
    .eq("id", member.trip_id)
    .maybeSingle();
  return trip ? { trip, member } : null;
}

/**
 * Points a member row at a traveller. First claim wins: the `traveler_id is null`
 * predicate makes a second device's claim a no-op instead of a silent handover,
 * so a trip can never jump between accounts.
 *
 * The caller has just proved the PIN (or just created/joined the membership), so
 * claiming here is not a privilege escalation — the PIN already grants everything.
 */
export async function claimMemberForTraveller(
  travellerId: string,
  memberId: string,
): Promise<boolean> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("members")
    .update({ traveler_id: travellerId })
    .eq("id", memberId)
    .is("traveler_id", null);
  if (error) throw new TripAdminError(error.message);

  const { data: member } = await supabase
    .from("members")
    .select("traveler_id")
    .eq("id", memberId)
    .maybeSingle();
  return member?.traveler_id === travellerId;
}

function assertOwner(trip: Trip, member: Member): void {
  if (member.role !== "owner" || trip.owner_member_id !== member.id) {
    throw new TripAdminError("Only the trip owner can do that.");
  }
}

function assertNotEnded(trip: Trip, today: string, verb: string): void {
  if (tripHasEnded(trip.end_date, today)) {
    throw new TripAdminError(
      `"${trip.name}" is over, so it is read-only now. ${verb} is for trips that are still running or still to come.`,
    );
  }
}

/**
 * Owner-only edit of the trip's own details. Shortening the trip is refused while
 * plan items sit on the days that would disappear, instead of silently orphaning
 * them out of the UI.
 */
export async function updateTripDetails(
  trip: Trip,
  member: Member,
  input: TripDetailsInput,
  today: string,
): Promise<void> {
  assertOwner(trip, member);
  assertNotEnded(trip, today, "Editing");

  // The action already parsed this with the same schema, but a service that can
  // be reached another way must not push an unvalidated row into Postgres and
  // let a raw constraint violation surface as the error message.
  const safe = tripDetailsSchema.safeParse(input);
  if (!safe.success) {
    throw new TripAdminError(safe.error.issues[0].message);
  }

  const supabase = getSupabase();
  const dayCount = tripDays(safe.data.startDate, safe.data.endDate).length;

  const { count: strays } = await supabase
    .from("itinerary_items")
    .select("id", { count: "exact", head: true })
    .eq("trip_id", trip.id)
    .gte("day_index", dayCount);
  if ((strays ?? 0) > 0) {
    throw new TripAdminError(
      `${strays} plan ${strays === 1 ? "item sits" : "items sit"} on days those dates would remove. Move them first.`,
    );
  }

  const { error } = await supabase
    .from("trips")
    .update({
      name: safe.data.name,
      destination: safe.data.destination,
      start_date: safe.data.startDate,
      end_date: safe.data.endDate,
      location_type: safe.data.locationType,
    })
    .eq("id", trip.id);
  if (error) throw new TripAdminError(error.message);
}

/** Every object in a bucket under `prefix`, walked a page at a time. */
async function listBucket(
  bucket: string,
  prefix: string,
): Promise<{ path: string }[]> {
  const storage = getSupabase().storage.from(bucket);
  const found: { path: string }[] = [];

  async function walk(path: string): Promise<void> {
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await storage.list(path, { limit: 500, offset });
      if (error || !data || data.length === 0) return;
      for (const entry of data) {
        const entryPath = `${path}/${entry.name}`;
        // Storage has no folder rows: a zero id with a name is a prefix.
        if (entry.id === null) await walk(entryPath);
        else found.push({ path: entryPath });
      }
      if (data.length < 500) return;
    }
  }

  await walk(prefix);
  return found;
}

/**
 * Owner-only, refused once the trip is over. Storage objects go first: the row
 * cascade would happily delete the rows and leave the files behind, orphaned but
 * still costing storage and still holding a member's passport scan.
 */
export async function deleteTrip(
  trip: Trip,
  member: Member,
  today: string,
): Promise<void> {
  assertOwner(trip, member);
  assertNotEnded(trip, today, "Deleting");

  const supabase = getSupabase();
  const removed: string[] = [];

  for (const bucket of PRIVATE_BUCKETS) {
    const objects = await listBucket(bucket, trip.id);
    if (objects.length === 0) continue;
    const { error } = await supabase.storage
      .from(bucket)
      .remove(objects.map((object) => object.path));
    if (error) {
      throw new TripAdminError(
        `Could not clear the ${bucket} bucket, so the trip was left alone: ${error.message}`,
      );
    }
    removed.push(`${objects.length} from ${bucket}`);
  }

  const { error } = await supabase.from("trips").delete().eq("id", trip.id);
  if (error) {
    throw new TripAdminError(
      `Deleted ${removed.join(", ") || "nothing"} from storage but could not delete the trip: ${error.message}`,
    );
  }
}