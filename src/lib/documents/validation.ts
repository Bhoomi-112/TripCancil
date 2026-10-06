import { z } from "zod";
import { DOCUMENT_TYPES } from "@/lib/documents/categories";

export const uploadDocumentSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title the document.")
    .max(120, "Keep the title under 120 characters."),
  type: z.enum(DOCUMENT_TYPES),
  itineraryItemId: z
    .string()
    .uuid("Unknown plan item.")
    .or(z.literal(""))
    .transform((value) => (value ? value : null)),
});
export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>;

export const deleteDocumentSchema = z.object({
  id: z.string().uuid("That document could not be found."),
});