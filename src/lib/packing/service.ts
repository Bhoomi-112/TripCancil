import "server-only";

import type { SessionContext } from "@/lib/auth/context";
import { tripHasEnded } from "@/lib/constants";
import { getSupabase } from "@/lib/db/client";
import type { Enums } from "@/lib/db/types";
import { starterItemsFor } from "./starter";
import type { PackingPayload, PackingItem } from "./types";
import type { PackingItemInput } from "@/lib/validation/packing";

/** A problem the packing UI can show verbatim, e.g. "That is on someone else's list." */
export class PackingError extends Error {}

/**
 * Past trips are read-only, same rule as the plan, the map and the ledger: a
 * trip whose last day has passed no longer takes edits, not even a check-off.
 */
function assertTripEditable(context: SessionContext): void {
  if (tripHasEnded(context.trip.end_date)) {
    throw new PackingError(
      `"${context.trip.name}" is over, so the packing list is read-only now.`,
    );
  }
}

async function assertMemberInTrip(tripId: string, memberId: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("members")
    .select("id, trip_id")
    .eq("id", memberId)
    .maybeSingle();
  if (error) throw new PackingError(error.message);
  return data && data.trip_id === tripId;
}

async function loadPackingItem(
  tripId: string,
  itemId: string,
): Promise<PackingItem | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("packing_items")
    .select("*")
    .eq("id", itemId)
    .maybeSingle();
  if (error) throw new PackingError(error.message);
  return data && data.trip_id === tripId ? data : null;
}

/**
 * A member's view of the list. Personal items are private to the one person
 * they are assigned to, so this filters them out on the server rather than
 * shipping everyone's "secret birthday gift" to every phone.
 */
export async function readPacking(
  tripId: string,
  viewerId: string,
): Promise<PackingPayload> {
  const supabase = getSupabase();

  const [items, members] = await Promise.all([
    supabase
      .from("packing_items")
      .select("*")
      .eq("trip_id", tripId)
      .or(`is_shared.eq.true,assigned_to.eq.${viewerId}`)
      .order("created_at", { ascending: true }),
    supabase
      .from("members")
      .select("id, display_name")
      .eq("trip_id", tripId)
      .order("created_at", { ascending: true }),
  ]);

  if (items.error) throw new PackingError(items.error.message);
  if (members.error) throw new PackingError(members.error.message);

  return {
    items: items.data ?? [],
    members: (members.data ?? []).map((member) => ({
      id: member.id,
      displayName: member.display_name,
    })),
  };
}

export async function addPackingItem(
  context: SessionContext,
  input: PackingItemInput,
): Promise<string> {
  assertTripEditable(context);

  // A personal item belongs to the person adding it; only the trip's own
  // members can be handed a shared item.
  let assignedTo = input.assignedTo;
  if (!input.isShared) {
    assignedTo = context.member.id;
  } else if (assignedTo && !(await assertMemberInTrip(context.trip.id, assignedTo))) {
    throw new PackingError("That is not a member of this trip.");
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("packing_items")
    .insert({
      trip_id: context.trip.id,
      name: input.name,
      category: input.category,
      is_shared: input.isShared,
      assigned_to: assignedTo ?? null,
      created_by: context.member.id,
    })
    .select("id")
    .single();
  if (error) throw new PackingError(error.message);
  return data.id;
}

async function finaliseAssignedTo(
  context: SessionContext,
  existing: PackingItem | null,
  input: PackingItemInput,
): Promise<string | null> {
  if (!input.isShared) return context.member.id;
  // Switching a personal item to shared keeps the person who was carrying it
  // as the carrier, unless the form says otherwise.
  if (input.assignedTo) {
    if (!(await assertMemberInTrip(context.trip.id, input.assignedTo))) {
      throw new PackingError("That is not a member of this trip.");
    }
    return input.assignedTo;
  }
  return existing?.assigned_to ?? null;
}

export async function updatePackingItem(
  context: SessionContext,
  itemId: string,
  input: PackingItemInput,
): Promise<void> {
  assertTripEditable(context);
  const existing = await loadPackingItem(context.trip.id, itemId);
  if (!existing) throw new PackingError("That item is not on this trip's list.");

  // Shared items are the group's to edit; a personal item is only its owner's
  // (or the trip owner's) business.
  if (
    !existing.is_shared &&
    existing.assigned_to !== context.member.id &&
    context.member.role !== "owner"
  ) {
    throw new PackingError("That is on someone else's personal list.");
  }

  const assignedTo = await finaliseAssignedTo(context, existing, input);

  const supabase = getSupabase();
  const { error } = await supabase
    .from("packing_items")
    .update({
      name: input.name,
      category: input.category,
      is_shared: input.isShared,
      assigned_to: assignedTo,
    })
    .eq("id", itemId)
    .eq("trip_id", context.trip.id);
  if (error) throw new PackingError(error.message);
}

export async function togglePackingItem(
  context: SessionContext,
  itemId: string,
): Promise<void> {
  assertTripEditable(context);
  const existing = await loadPackingItem(context.trip.id, itemId);
  if (!existing) throw new PackingError("That item is not on this trip's list.");

  if (
    !existing.is_shared &&
    existing.assigned_to !== context.member.id &&
    context.member.role !== "owner"
  ) {
    throw new PackingError("That is on someone else's personal list.");
  }

  const supabase = getSupabase();
  const { error } = await supabase
    .from("packing_items")
    .update({ checked: !existing.checked })
    .eq("id", itemId)
    .eq("trip_id", context.trip.id);
  if (error) throw new PackingError(error.message);
}

export async function deletePackingItem(
  context: SessionContext,
  itemId: string,
): Promise<void> {
  assertTripEditable(context);
  const existing = await loadPackingItem(context.trip.id, itemId);
  if (!existing) throw new PackingError("That item is not on this trip's list.");

  if (
    !existing.is_shared &&
    existing.assigned_to !== context.member.id &&
    context.member.role !== "owner"
  ) {
    throw new PackingError("That is on someone else's personal list.");
  }

  const supabase = getSupabase();
  const { error } = await supabase
    .from("packing_items")
    .delete()
    .eq("id", itemId)
    .eq("trip_id", context.trip.id);
  if (error) throw new PackingError(error.message);
}

/**
 * Seeds the vibe-specific starter list. Idempotent: an item already on the list
 * with the same name and category is skipped, so a second tap only adds what is
 * still missing. Returns how many new rows were written.
 */
export async function seedStarterItems(context: SessionContext): Promise<number> {
  assertTripEditable(context);
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("packing_items")
    .select("name, category")
    .eq("trip_id", context.trip.id);
  if (error) throw new PackingError(error.message);

  const existing = new Set(
    (data ?? []).map((item) => oneKey(item.name, item.category)),
  );
  const fresh = starterItemsFor(context.trip.location_type).filter((item) => {
    const key = oneKey(item.name, item.category);
    if (existing.has(key)) return false;
    existing.add(key);
    return true;
  });

  if (fresh.length === 0) return 0;

  const { error: insertError } = await supabase.from("packing_items").insert(
    fresh.map((item) => ({
      trip_id: context.trip.id,
      name: item.name,
      category: item.category,
      is_shared: true,
      created_by: context.member.id,
    })),
  );
  if (insertError) throw new PackingError(insertError.message);
  return fresh.length;
}

function oneKey(name: string, category: Enums<"packing_category">): string {
  return `${name.trim().toLowerCase()}|${category}`;
}