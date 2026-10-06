import type { Database } from "@/lib/db/types";

export type LocationType = Database["public"]["Enums"]["location_type"];

/** Normalised to the canvas: x/y/w are fractions of width, h of height. */
export type Rect = { x: number; y: number; w: number; h: number };

export type LayoutId = "single" | "grid2x2" | "strip4" | "polaroid";

export type FrameSpec = {
  type: "stroke";
  colour: string;
  /** Line thickness, fraction of the shorter canvas edge. */
  width: number;
  /** Outer margin, fraction of the shorter canvas edge. */
  inset: number;
  /** Corner radius, fraction of the shorter canvas edge. */
  radius: number;
};

export type BackgroundSpec =
  | { type: "solid"; colour: string }
  | { type: "gradient"; from: string; to: string }
  | { type: "dots"; base: string; dot: string; spacing: number };

export type ThemeSticker = { id: string; glyph: string; label: string };

/**
 * P11 dresses the same engine in location themes, so everything a theme can
 * change lives here: frame, background, sticker sheet, photo filter, caption
 * type. Nothing else in the engine reads trip or location data.
 */
export type Theme = {
  id: string;
  label: string;
  locationType: LocationType | "any";
  frame: FrameSpec;
  background: BackgroundSpec;
  stickers: ThemeSticker[];
  /** Canvas 2D filter string applied while each photo is drawn. */
  filter: string;
  /** Font descriptors, e.g. `var(--font-pixel-face)` — resolved at draw time. */
  captionFont: { heading: string; body: string };
  caption: { bg: string; fg: string; sub: string };
};

export type BoothPhoto = {
  id: string;
  image: HTMLImageElement;
  /** 1 = the smallest cover of the slot at the current rotation. */
  zoom: number;
  /** Degrees. */
  rotation: number;
  /** Pan, in slot sizes; clamped by the renderer to the photo's slack. */
  offsetX: number;
  offsetY: number;
};

export type BoothSticker = {
  id: string;
  glyph: string;
  label: string;
  /** Centre, 0..1 of the canvas. */
  x: number;
  y: number;
  scale: number;
  /** Degrees. */
  rotation: number;
};

export type BoothCaptions = { tripName: string; date: string; place: string };

export type BoothSpec = {
  theme: Theme;
  layout: LayoutId;
  photos: BoothPhoto[];
  captions: BoothCaptions;
  stickers: BoothSticker[];
};

export type BoothSelection =
  | { kind: "photo"; id: string }
  | { kind: "sticker"; id: string }
  | null;

export const MAX_PHOTOS = 4;
export const MAX_STICKERS = 12;

export const PHOTO_LIMITS = {
  zoom: { min: 1, max: 3 },
  rotation: { min: -180, max: 180 },
  pan: 0.25,
} as const;

export const STICKER_LIMITS = {
  scale: { min: 0.4, max: 4 },
  rotation: { min: -180, max: 180 },
  edge: 0.03,
} as const;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
