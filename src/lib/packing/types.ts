import type { Tables } from "@/lib/db/types";

export type PackingItem = Tables<"packing_items">;

export type PackingMember = {
  id: string;
  displayName: string;
};

/** The wire shape both the trip page and the polling route hand to the board. */
export type PackingPayload = {
  items: PackingItem[];
  members: PackingMember[];
};

/**
 * The SWR key the packing board polls. Filter form so any component in the
 * board can say "re-read the list" without being handed the trip id.
 */
export function isPackingKey(key: unknown): boolean {
  return (
    typeof key === "string" &&
    key.startsWith("/api/trips/") &&
    key.endsWith("/packing")
  );
}