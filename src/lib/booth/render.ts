import { aspectFor, badgeRect, bandRect, layoutSpec, slotsFor } from "./layouts";
import { clamp, type BoothPhoto, type BoothSpec, type Rect } from "./types";

export type DrawSize = { width: number; height: number };
export type DrawGuides = { slotIndex?: number; stickerId?: string };

/** Emoji are drawn at this fraction of the shorter canvas edge, × sticker scale. */
export const STICKER_BASE = 0.15;

const EMOJI_FONT =
  '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';

const filterSupported =
  typeof CanvasRenderingContext2D !== "undefined" &&
  "filter" in CanvasRenderingContext2D.prototype;

export function boothSize(spec: BoothSpec, longEdge = 2000): DrawSize {
  const aspect = aspectFor(spec.layout, spec.photos.length);
  return aspect >= 1
    ? { width: longEdge, height: Math.max(1, Math.round(longEdge / aspect)) }
    : { width: Math.max(1, Math.round(longEdge * aspect)), height: longEdge };
}

/** next/font renames its families, so canvas resolves them from the CSS vars. */
export function resolveFontFamily(ref: string): string {
  if (!ref.startsWith("var(")) return ref;
  if (typeof document === "undefined") return "";
  const name = ref.slice(ref.indexOf("(") + 1, ref.indexOf(")")).trim();
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  const first = value.split(",")[0]?.trim() ?? "";
  return first.replace(/^["']|["']$/g, "");
}

export async function ensureBoothFonts(): Promise<void> {
  if (typeof document === "undefined") return;
  try {
    await document.fonts.ready;
  } catch {
    // Fonts are a nicety; a failed readiness probe must not block the draw.
  }
}

/**
 * The smallest scale at which an image, rotated by `rotationDeg`, still
 * covers an axis-aligned slot: rotate the slot's bounding box instead.
 */
export function coverScale(
  imageWidth: number,
  imageHeight: number,
  slotWidth: number,
  slotHeight: number,
  rotationDeg: number,
): number {
  if (imageWidth <= 0 || imageHeight <= 0) return 1;
  const rad = (rotationDeg * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const neededW = slotWidth * cos + slotHeight * sin;
  const neededH = slotWidth * sin + slotHeight * cos;
  return Math.max(neededW / imageWidth, neededH / imageHeight);
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
): void {
  const r = Math.max(0, Math.min(radius, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function dashed(ctx: CanvasRenderingContext2D, on: boolean): void {
  if (typeof ctx.setLineDash === "function") {
    ctx.setLineDash(on ? [6, 6] : []);
  }
}

function toPx(rect: Rect, width: number, height: number) {
  return { x: rect.x * width, y: rect.y * height, w: rect.w * width, h: rect.h * height };
}

function paintBackground(
  ctx: CanvasRenderingContext2D,
  spec: BoothSpec,
  width: number,
  height: number,
): void {
  const bg = spec.theme.background;
  if (bg.type === "solid") {
    ctx.fillStyle = bg.colour;
    ctx.fillRect(0, 0, width, height);
    return;
  }
  if (bg.type === "gradient") {
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, bg.from);
    gradient.addColorStop(1, bg.to);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    return;
  }
  ctx.fillStyle = bg.base;
  ctx.fillRect(0, 0, width, height);
  const step = Math.max(16, bg.spacing * width);
  const radius = Math.max(2, step * 0.13);
  ctx.fillStyle = bg.dot;
  for (let y = step / 2; y < height; y += step) {
    for (let x = step / 2; x < width; x += step) {
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function paintPhoto(
  ctx: CanvasRenderingContext2D,
  photo: BoothPhoto,
  rect: { x: number; y: number; w: number; h: number },
): void {
  const image = photo.image;
  if (!image.width || !image.height) return;
  const scale = coverScale(image.width, image.height, rect.w, rect.h, photo.rotation);
  const drawnW = image.width * scale * photo.zoom;
  const drawnH = image.height * scale * photo.zoom;
  // Pan only as far as the photo can still fill the slot.
  const slackX = Math.max(0, (drawnW - rect.w) / 2 / rect.w);
  const slackY = Math.max(0, (drawnH - rect.h) / 2 / rect.h);
  const offsetX = clamp(photo.offsetX, -slackX, slackX);
  const offsetY = clamp(photo.offsetY, -slackY, slackY);
  ctx.translate(
    rect.x + rect.w / 2 + offsetX * rect.w,
    rect.y + rect.h / 2 + offsetY * rect.h,
  );
  ctx.rotate((photo.rotation * Math.PI) / 180);
  ctx.drawImage(
    image,
    -drawnW / 2,
    -drawnH / 2,
    drawnW,
    drawnH,
  );
}

function paintFrame(ctx: CanvasRenderingContext2D, spec: BoothSpec, width: number, height: number): void {
  const { frame } = spec.theme;
  const s = Math.min(width, height);
  const inset = frame.inset * s;
  const line = Math.max(1, frame.width * s);
  const x = inset;
  const y = inset;
  const w = width - 2 * inset;
  const h = height - 2 * inset;
  const radius = frame.radius * s;
  ctx.save();
  roundRectPath(ctx, x, y, w, h, radius);
  ctx.lineWidth = line;
  ctx.strokeStyle = frame.colour;
  ctx.stroke();
  // Second, thinner line inside: the chrome gloss.
  const inner = line * 0.28;
  roundRectPath(ctx, x + line * 0.7, y + line * 0.7, w - line * 1.4, h - line * 1.4, radius);
  ctx.lineWidth = inner;
  ctx.strokeStyle = "rgba(255,255,255,0.8)";
  ctx.stroke();
  ctx.restore();
}

function fitFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  startPx: number,
  family: string,
): number {
  let px = Math.round(startPx);
  while (px > 8) {
    ctx.font = `${px}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) return px;
    px -= Math.max(1, Math.round(px * 0.08));
  }
  return px;
}

function paintCaptions(ctx: CanvasRenderingContext2D, spec: BoothSpec, width: number, height: number): void {
  const heading = spec.captions.tripName.trim();
  const sub = [spec.captions.date.trim(), spec.captions.place.trim()]
    .filter(Boolean)
    .join(" · ");
  if (!heading && !sub) return;

  const layout = layoutSpec(spec.layout);
  const { caption, captionFont } = spec.theme;
  const s = Math.min(width, height);
  const isBand = layout.caption === "band";
  const rect = toPx(isBand ? bandRect() : badgeRect(), width, height);
  const family = resolveFontFamily(captionFont.heading);
  const bodyFamily = resolveFontFamily(captionFont.body) || family;
  const pad = 0.02 * s;
  const innerWidth = rect.w - 2 * pad;

  ctx.save();
  if (!isBand) {
    roundRectPath(ctx, rect.x, rect.y, rect.w, rect.h, rect.h / 2);
    ctx.fillStyle = caption.bg;
    ctx.fill();
    ctx.lineWidth = Math.max(1, 0.005 * s);
    ctx.strokeStyle = "rgba(37,26,66,0.45)";
    ctx.stroke();
  }

  const rows: { text: string; px: number; family: string; colour: string }[] = [];
  const headColour = isBand ? caption.bg : caption.fg;
  const subColour = isBand ? "rgba(37,26,66,0.72)" : caption.sub;
  const main = heading || sub;
  const mainPx = fitFont(ctx, main, innerWidth, 0.062 * width, family || "monospace");
  if (heading) rows.push({ text: heading, px: mainPx, family: family || "monospace", colour: headColour });
  if (sub && heading) {
    rows.push({
      text: sub,
      px: fitFont(ctx, sub, innerWidth, mainPx * 0.5, bodyFamily || "sans-serif"),
      family: bodyFamily || "sans-serif",
      colour: subColour,
    });
  } else if (sub) {
    rows.push({ text: sub, px: mainPx, family: bodyFamily || "sans-serif", colour: headColour });
  }

  const gap = Math.round(Math.min(...rows.map((row) => row.px)) * 0.5);
  const block = rows.reduce((total, row) => total + row.px, 0) + gap * (rows.length - 1);
  let lineY = rect.y + rect.h / 2 - block / 2;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  for (const row of rows) {
    ctx.font = `${row.px}px ${row.family}`;
    ctx.fillStyle = row.colour;
    ctx.fillText(row.text, rect.x + rect.w / 2, lineY);
    lineY += row.px + gap;
  }
  ctx.restore();
}

function paintStickers(
  ctx: CanvasRenderingContext2D,
  spec: BoothSpec,
  width: number,
  height: number,
  guides: DrawGuides | undefined,
): void {
  const s = Math.min(width, height);
  const base = STICKER_BASE * s;
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const sticker of spec.stickers) {
    const size = base * sticker.scale;
    ctx.save();
    ctx.translate(sticker.x * width, sticker.y * height);
    ctx.rotate((sticker.rotation * Math.PI) / 180);
    ctx.font = `${size}px ${EMOJI_FONT}`;
    ctx.fillText(sticker.glyph, 0, 0);
    ctx.restore();
    if (guides?.stickerId === sticker.id) {
      ctx.save();
      ctx.translate(sticker.x * width, sticker.y * height);
      ctx.lineWidth = Math.max(1.5, 0.004 * s);
      ctx.strokeStyle = "#2f49ff";
      dashed(ctx, true);
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.6, 0, Math.PI * 2);
      ctx.stroke();
      dashed(ctx, false);
      ctx.restore();
    }
  }
  ctx.restore();
}

/** Draws the whole booth onto a 2D context. `size` is in device pixels. */
export function drawBooth(
  ctx: CanvasRenderingContext2D,
  spec: BoothSpec,
  size: DrawSize,
  options: { guides?: DrawGuides } = {},
): void {
  const { width, height } = size;
  const count = Math.max(1, spec.photos.length);
  const s = Math.min(width, height);
  const { guides } = options;

  ctx.save();
  ctx.clearRect(0, 0, width, height);
  paintBackground(ctx, spec, width, height);

  const layout = layoutSpec(spec.layout);
  if (layout.card) {
    ctx.fillStyle = layout.card.colour;
    ctx.fillRect(0, 0, width, height);
  }

  const slots = slotsFor(spec.layout, count);
  slots.forEach((slot, index) => {
    const photo = spec.photos[index];
    if (!photo) return;
    const rect = toPx(slot, width, height);
    ctx.save();
    roundRectPath(ctx, rect.x, rect.y, rect.w, rect.h, 0.03 * s);
    ctx.clip();
    if (filterSupported) ctx.filter = spec.theme.filter;
    paintPhoto(ctx, photo, rect);
    if (filterSupported) ctx.filter = "none";
    ctx.restore();

    ctx.save();
    roundRectPath(ctx, rect.x, rect.y, rect.w, rect.h, 0.03 * s);
    ctx.lineWidth = Math.max(1, 0.005 * s);
    ctx.strokeStyle = "rgba(37,26,66,0.35)";
    ctx.stroke();
    if (guides?.slotIndex === index) {
      dashed(ctx, true);
      ctx.strokeStyle = "#2f49ff";
      ctx.lineWidth = Math.max(2, 0.008 * s);
      ctx.stroke();
      dashed(ctx, false);
    }
    ctx.restore();
  });

  paintFrame(ctx, spec, width, height);
  paintCaptions(ctx, spec, width, height);
  paintStickers(ctx, spec, width, height, guides);
  ctx.restore();
}

/** Renders the booth off-screen and returns a PNG blob. */
export async function exportBoothPng(spec: BoothSpec, longEdge = 2000): Promise<Blob> {
  await ensureBoothFonts();
  const size = boothSize(spec, longEdge);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser cannot draw the booth.");
  drawBooth(ctx, spec, size);
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not export the PNG."))),
      "image/png",
    );
  });
}
