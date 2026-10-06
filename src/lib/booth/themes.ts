import type { LocationType, Theme } from "./types";

/**
 * The one theme P10 ships with — it proves the engine end to end. P11 swaps
 * in the location themes and preselects them from the trip; nothing here
 * changes, because the engine only ever reads `Theme`.
 */
export const PLACEHOLDER_THEME: Theme = {
  id: "y2k-chrome",
  label: "Y2K Chrome",
  locationType: "any",
  background: {
    type: "dots",
    base: "#fff4e2",
    dot: "rgba(47, 73, 255, 0.16)",
    spacing: 0.05,
  },
  frame: { type: "stroke", colour: "#2f49ff", width: 0.028, inset: 0.018, radius: 0.05 },
  filter: "saturate(1.18) contrast(1.06)",
  captionFont: { heading: "var(--font-pixel-face)", body: "var(--font-rounded-face)" },
  caption: { bg: "#2f49ff", fg: "#ffffff", sub: "#ccff3d" },
  stickers: [
    { id: "sparkle", glyph: "✨", label: "Sparkle" },
    { id: "star", glyph: "⭐", label: "Star" },
    { id: "heart", glyph: "💖", label: "Heart" },
    { id: "rainbow", glyph: "🌈", label: "Rainbow" },
    { id: "bow", glyph: "🎀", label: "Bow" },
    { id: "shades", glyph: "🕶", label: "Shades" },
    { id: "skates", glyph: "🛼", label: "Skates" },
    { id: "selfie", glyph: "🤳", label: "Selfie" },
  ],
};

export const THEMES: Theme[] = [PLACEHOLDER_THEME];

/** Exact location match first, then the catch-all, then anything at all. */
export function pickTheme(locationType: LocationType | null): Theme {
  const exact = locationType
    ? THEMES.find((theme) => theme.locationType === locationType)
    : undefined;
  return exact ?? THEMES.find((theme) => theme.locationType === "any") ?? THEMES[0];
}
