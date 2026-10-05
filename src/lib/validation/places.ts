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
  locationType: z.enum(LOCATION_TYPES),
  category: z.string().trim().max(40).optional(),
  status: z.enum(["proposed", "locked"]).optional(),
});

export type CreatePlaceInput = z.infer<typeof createPlaceSchema>;
