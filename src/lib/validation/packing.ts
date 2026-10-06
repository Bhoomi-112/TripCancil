import { z } from "zod";
import { PACKING_CATEGORIES } from "@/lib/packing/categories";

export const packingItemSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name the thing you are packing.")
    .max(80, "Keep the name under 80 characters."),
  category: z.enum(PACKING_CATEGORIES),
  isShared: z.boolean(),
  assignedTo: z
    .string()
    .uuid("Pick a member from the list.")
    .or(z.literal(""))
    .nullable()
    .transform((value) => (value ? value : null)),
});
export type PackingItemInput = z.infer<typeof packingItemSchema>;

export const packingItemIdSchema = z.object({
  itemId: z.string().uuid("That item is not on this trip."),
});