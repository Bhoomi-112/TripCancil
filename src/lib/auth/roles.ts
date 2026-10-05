import type { Member, Trip } from "./context";

/**
 * Who counts as the owner. Two things have to agree: the member row says
 * "owner" and the trip points back at that same member, so a demotion or a
 * hand-over takes effect the moment either row changes instead of waiting for a
 * cookie to expire.
 *
 * Pure, and deliberately not in `context.ts`: that module imports
 * `next/navigation` to redirect, and a service that only wants this check should
 * not have to pull a router in behind it. The types come across as type-only
 * imports, which erase at runtime.
 */
export function isOwner(context: {
  member: Pick<Member, "id" | "role">;
  trip: Pick<Trip, "owner_member_id">;
}): boolean {
  return (
    context.member.role === "owner" &&
    context.trip.owner_member_id === context.member.id
  );
}