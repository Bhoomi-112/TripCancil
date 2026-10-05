import { z } from "zod";
import { LOCATION_TYPES } from "@/lib/constants";
import { MAX_TRIP_DAYS } from "@/lib/itinerary/days";

/**
 * Nominatim hands coordinates back as strings on a single line, so these parse
 * numbers rather than regex-matching the text a form would have posted.
 */
const coordinates = {
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
};

/** Nominatim display names can be long: "Alibaug, Raigad, Maharashtra, India". */
const searchName = z.string().trim().min(1).max(120);
const category = z
  .string()
  .trim()
  .max(40)
  .transform((value) => (value === "" ? undefined : value))
  .optional();

export const proposePlaceSchema = z.object({
  name: searchName,
  ...coordinates,
  category,
  locationType: z.enum(LOCATION_TYPES),
});
export type ProposePlaceInput = z.infer<typeof proposePlaceSchema>;

export const placeToDaySchema = z.object({
  placeId: z.string().uuid(),
  dayIndex: z.coerce.number().int().min(0).max(MAX_TRIP_DAYS - 1),
});
export type PlaceToDayInput = z.infer<typeof placeToDaySchema>;

/**
 * A vote is a plain number on the way in, because the buttons post `1` and `-1`
 * as strings. Anything else - 0, 2, "yes" - is refused rather than coerced into
 * something the tally would then have to guess about.
 */
export const voteSchema = z.object({
  placeId: z.string().uuid(),
  value: z.union([z.literal(1), z.literal(-1)]),
});
export type VoteInput = z.infer<typeof voteSchema>;

export const searchResultToDaySchema = z.object({
  name: searchName,
  ...coordinates,
  category,
  dayIndex: z.coerce.number().int().min(0).max(MAX_TRIP_DAYS - 1),
});
export type SearchResultInput = z.infer<typeof searchResultToDaySchema>;