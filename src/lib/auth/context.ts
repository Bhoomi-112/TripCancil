import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import type { Database } from "@/lib/db/types";
import { getSupabase } from "@/lib/db/client";
import { getSession } from "./session";
import { isOwner } from "./roles";

export type Member = Database["public"]["Tables"]["members"]["Row"];
export type Trip = Database["public"]["Tables"]["trips"]["Row"];

export type SessionContext = {
  member: Member;
  trip: Trip;
};

/**
 * The single gate for every authenticated read and write. It re-reads the member
 * row, so a member removed mid-session stops working on the next request, and it
 * refuses a token whose trip_id disagrees with the member it points at.
 *
 * `cache` dedupes this across the layout, the page and any nested call in a
 * single render pass.
 */
export const requireSession = cache(async (): Promise<SessionContext> => {
  const session = await getSession();
  if (!session) redirect("/join");

  const supabase = getSupabase();
  const { data: member } = await supabase
    .from("members")
    .select("*")
    .eq("id", session.memberId)
    .maybeSingle();

  if (!member || member.trip_id !== session.tripId) {
    redirect("/join");
  }

  const { data: trip } = await supabase
    .from("trips")
    .select("*")
    .eq("id", member.trip_id)
    .maybeSingle();

  if (!trip) redirect("/join");

  return { member, trip };
});

/** Same, but only for handlers that must not bounce the browser. */
export async function getSessionContext(): Promise<SessionContext | null> {
  const session = await getSession();
  if (!session) return null;

  const supabase = getSupabase();
  const { data: member } = await supabase
    .from("members")
    .select("*")
    .eq("id", session.memberId)
    .maybeSingle();

  if (!member || member.trip_id !== session.tripId) return null;

  const { data: trip } = await supabase
    .from("trips")
    .select("*")
    .eq("id", member.trip_id)
    .maybeSingle();

  return trip ? { member, trip } : null;
}

/** Owner-only actions return a typed failure instead of throwing at the UI. */
export async function requireOwner(): Promise<SessionContext> {
  const context = await requireSession();
  if (!isOwner(context)) {
    throw new Error("Only the trip owner can do that.");
  }
  return context;
}

export function formatRole(role: Member["role"]): string {
  return role === "owner" ? "Owner" : "Member";
}
