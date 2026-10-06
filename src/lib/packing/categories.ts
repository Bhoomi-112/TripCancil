/**
 * Packing categories and their colours. Client-safe and dependency-free so the
 * packing board, the item form and the validation schemas all read the same
 * list without importing each other.
 */

export const PACKING_CATEGORIES = [
  "clothes",
  "gear",
  "toiletries",
  "docs",
  "snacks",
  "other",
] as const;

export type PackingCategory = (typeof PACKING_CATEGORIES)[number];

export const PACKING_CATEGORY_LABELS: Record<PackingCategory, string> = {
  clothes: "Clothes",
  gear: "Gear",
  toiletries: "Toiletries",
  docs: "Docs",
  snacks: "Snacks",
  other: "Other",
};

export const PACKING_CATEGORY_COLOURS: Record<PackingCategory, string> = {
  clothes: "#db2777",
  gear: "#6d28d9",
  toiletries: "#0369a1",
  docs: "#7c2d12",
  snacks: "#15803d",
  other: "#5d4c85",
};