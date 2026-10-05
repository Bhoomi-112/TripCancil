import { z } from "zod";
import { MAX_TRIP_DAYS, normaliseTime } from "@/lib/itinerary/days";

const dayIndex = z.coerce
  .number({ error: "Pick a day." })
  .int()
  .min(0, "Pick a day.")
  .max(MAX_TRIP_DAYS - 1, "That day is outside this trip.");

const title = z
  .string()
  .trim()
  .min(1, "Give the plan item a name.")
  .max(120, "Keep it under 120 characters.");

const optionalUuid = z
  .string()
  .trim()
  .refine((value) => value === "" || z.string().uuid().safeParse(value).success, {
    message: "Unknown reference.",
  });

export const itineraryItemSchema = z.object({
  title,
  dayIndex,
  startTime: z
    .string()
    .trim()
    .refine(
      (value) => value === "" || normaliseTime(value) !== null,
      "Use a 24-hour clock like 09:30.",
    ),
  placeId: optionalUuid,
  notes: z.string().trim().max(500, "Notes are 500 characters at most."),
});

export const updateItineraryItemSchema = itineraryItemSchema.extend({
  itemId: z.string().uuid("Unknown plan item."),
});

export const deleteItineraryItemSchema = z.object({
  itemId: z.string().uuid("Unknown plan item."),
});

export const reorderDaySchema = z.object({
  dayIndex,
  itemIds: z
    .array(z.string().uuid("Unknown plan item."))
    .max(60, "That is a very long day."),
});

export type ItineraryItemInput = z.infer<typeof itineraryItemSchema>;