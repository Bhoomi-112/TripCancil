import { z } from "zod";
import { LOCATION_TYPES } from "@/lib/constants";

export const createPlaceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Place name is required")
    .max(80, "Place name is too long"),
  lat: z
    .string()
    .regex(/^-?\d{1,2}\.\d+$/, "Invalid latitude"),
  lng: z
    .string()
    .regex(/^-?\d{1,3}\.\d+$/, "Invalid longitude"),
  address: z.string().trim().max(240).optional(),
  locationType: z.enum(LOCATION_TYPES),
  notes: z.string().trim().max(500).optional(),
});

export type CreatePlaceInput = z.infer<typeof createPlaceSchema>;
