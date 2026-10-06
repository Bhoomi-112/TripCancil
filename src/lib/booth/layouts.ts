import type { LayoutId, Rect } from "./types";

export type LayoutSpec = {
  id: LayoutId;
  label: string;
  hint: string;
  maxPhotos: number;
  /** Output width / height for a given photo count. */
  aspect: (count: number) => number;
  /** Slot rects, in canvas-normalised units, for a given photo count. */
  slots: (count: number) => Rect[];
  caption: "badge" | "band";
  /** Filled behind the photos, e.g. the polaroid card. */
  card?: { colour: string };
};

const clampCount = (count: number) => Math.max(1, Math.min(4, count));

function stripGeometry(count: number) {
  const slots: Rect[] = [];
  const side = 0.05;
  const marginY = 0.03;
  const gap = 0.02;
  const h = (1 - 2 * marginY - (count - 1) * gap) / count;
  for (let i = 0; i < count; i += 1) {
    slots.push({ x: side, y: marginY + i * (h + gap), w: 1 - 2 * side, h });
  }
  // Slots are square when height / width == h / (1 - 2 * side).
  return { slots, aspect: h / (1 - 2 * side) };
}

const single: LayoutSpec = {
  id: "single",
  label: "Single",
  hint: "One shot, framed big",
  maxPhotos: 1,
  aspect: () => 1,
  slots: () => [{ x: 0.05, y: 0.05, w: 0.9, h: 0.9 }],
  caption: "badge",
};

const grid2x2: LayoutSpec = {
  id: "grid2x2",
  label: "2×2",
  hint: "Four squares, one memory",
  maxPhotos: 4,
  aspect: (count) => (count === 2 ? 1.5 : 1),
  slots: (count) => {
    const c = clampCount(count);
    if (c === 1) return [{ x: 0.06, y: 0.06, w: 0.88, h: 0.88 }];
    if (c === 2) {
      return [
        { x: 0.04, y: 0.06, w: 0.44, h: 0.88 },
        { x: 0.52, y: 0.06, w: 0.44, h: 0.88 },
      ];
    }
    const cells = [
      { x: 0.04, y: 0.04, w: 0.44, h: 0.44 },
      { x: 0.52, y: 0.04, w: 0.44, h: 0.44 },
      { x: 0.04, y: 0.52, w: 0.44, h: 0.44 },
      { x: 0.52, y: 0.52, w: 0.44, h: 0.44 },
    ];
    if (c === 3) return [...cells.slice(0, 2), { x: 0.04, y: 0.52, w: 0.92, h: 0.44 }];
    return cells;
  },
  caption: "badge",
};

const strip4: LayoutSpec = {
  id: "strip4",
  label: "Strip",
  hint: "The classic four down",
  maxPhotos: 4,
  aspect: (count) => stripGeometry(clampCount(count)).aspect,
  slots: (count) => stripGeometry(clampCount(count)).slots,
  caption: "badge",
};

const polaroidAspect = 0.92;
const polaroid: LayoutSpec = {
  id: "polaroid",
  label: "Polaroid",
  hint: "One square, thick bottom",
  maxPhotos: 1,
  aspect: () => polaroidAspect,
  slots: () => {
    const w = 0.88;
    // Square photo: its height as a fraction of canvas height is w * aspect.
    return [{ x: 0.06, y: 0.06, w, h: w * polaroidAspect }];
  },
  caption: "band",
  card: { colour: "#ffffff" },
};

export const LAYOUTS: LayoutSpec[] = [single, grid2x2, strip4, polaroid];

export function layoutSpec(id: LayoutId): LayoutSpec {
  return LAYOUTS.find((layout) => layout.id === id) ?? single;
}

export function aspectFor(id: LayoutId, count: number): number {
  return layoutSpec(id).aspect(Math.max(1, count));
}

export function slotsFor(id: LayoutId, count: number): Rect[] {
  return layoutSpec(id).slots(Math.max(1, count));
}

/** Where the caption sits when the layout prints it over the photos. */
export function badgeRect(): Rect {
  return { x: 0.08, y: 0.865, w: 0.84, h: 0.105 };
}

/** The polaroid's white band, below the photo. */
export function bandRect(): Rect {
  return { x: 0.06, y: 0.885, w: 0.88, h: 0.085 };
}
