import type { Tables } from "@/lib/db/types";

/**
 * The wire shape both the polling route handler and the server-rendered page
 * hand to the plan board, so the first paint and every 5s refresh are the same
 * component with the same props.
 */
export type ItineraryItem = Tables<"itinerary_items">;
export type PlaceOption = Pick<
  Tables<"places">,
  "id" | "name" | "category" | "status"
>;

export type ItineraryPayload = {
  items: ItineraryItem[];
  places: PlaceOption[];
};