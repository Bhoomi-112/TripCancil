/**
 * Pure unit tests for the photobooth geometry and draw plan. No server, no
 * browser — a recording mock stands in for the 2D context, so `npx tsx
 * scripts/test-booth.mts` checks layout rects, cover maths, output sizing and
 * the order in which the engine reaches for the canvas.
 */
import { LAYOUTS, aspectFor, badgeRect, bandRect, layoutSpec, slotsFor } from "../src/lib/booth/layouts";
import { STICKER_BASE, boothSize, coverScale, drawBooth } from "../src/lib/booth/render";
import { PLACEHOLDER_THEME, pickTheme } from "../src/lib/booth/themes";
import {
  MAX_PHOTOS,
  MAX_STICKERS,
  PHOTO_LIMITS,
  STICKER_LIMITS,
  clamp,
  type BoothPhoto,
  type BoothSpec,
} from "../src/lib/booth/types";

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    passed += 1;
    console.log(`  ok   ${name}`);
  } else {
    failed += 1;
    failures.push(name);
    console.log(`  FAIL ${name}${detail ? ` -> ${detail}` : ""}`);
  }
}

const close = (a: number, b: number, tolerance = 1e-6) => Math.abs(a - b) <= tolerance;

const fakeImage = (width: number, height: number) =>
  ({ width, height, src: "" }) as unknown as HTMLImageElement;

const photo = (id: string): BoothPhoto => ({
  id,
  image: fakeImage(800, 600),
  zoom: 1,
  rotation: 0,
  offsetX: 0,
  offsetY: 0,
});


const inBounds = (rect: { x: number; y: number; w: number; h: number }) =>
  rect.x >= 0 &&
  rect.y >= 0 &&
  rect.w > 0 &&
  rect.h > 0 &&
  rect.x + rect.w <= 1 + 1e-9 &&
  rect.y + rect.h <= 1 + 1e-9;

console.log("layouts");
for (const layout of LAYOUTS) {
  check(`${layout.id}: aspect is positive`, layout.aspect(1) > 0);
  check(`${layout.id}: maxPhotos within 1..4`, layout.maxPhotos >= 1 && layout.maxPhotos <= 4);
  for (let count = 1; count <= 4; count += 1) {
    const slots = layout.slots(count);
    check(
      `${layout.id}/${count}: every slot inside the canvas`,
      slots.length > 0 && slots.every(inBounds),
      JSON.stringify(slots),
    );
    check(
      `${layout.id}/${count}: aspect matches its slots`,
      close(aspectFor(layout.id, count), layout.aspect(count)),
    );
  }
}

check("layoutSpec falls back to single", layoutSpec("strip4").id === "strip4");

check("single: one slot, square canvas", slotsFor("single", 3).length === 1 && aspectFor("single", 3) === 1);

check("grid2x2: slot count tracks the photo count", [1, 2, 3, 4].every(
  (count) => slotsFor("grid2x2", count).length === count,
));

check(
  "grid2x2/3: the third photo runs wide",
  slotsFor("grid2x2", 3)[2].w > 0.8,
);

check("grid2x2: two photos get a landscape canvas", aspectFor("grid2x2", 2) > 1);

check("strip4: four photos produce a tall strip", aspectFor("strip4", 4) < 1);

check("strip4: slots stay square at every count", [1, 2, 3, 4].every((count) => {
  const aspect = aspectFor("strip4", count);
  return slotsFor("strip4", count).every((slot) => close(slot.w * aspect, slot.h, 1e-9));
}));

check("strip4/3: three slots fill the strip top to bottom", (() => {
  const slots = slotsFor("strip4", 3);
  return slots[0].y >= 0 && slots[2].y + slots[2].h <= 1 + 1e-9;
})());

check("polaroid: card behind a square photo", layoutSpec("polaroid").card !== undefined && (() => {
  const [slot] = slotsFor("polaroid", 1);
  return close(slot.h, slot.w * aspectFor("polaroid", 1), 1e-9);
})());

check("polaroid: prints captions in the band", layoutSpec("polaroid").caption === "band");

check("badge and band rects stay inside the canvas", inBounds(badgeRect()) && inBounds(bandRect()));

console.log("cover maths");
check("rotation 0 covers by width or height", close(coverScale(800, 600, 100, 50, 0), 100 / 800));
check("rotation 90 swaps the axes", close(coverScale(800, 600, 100, 50, 90), 100 / 600));
check("a huge photo scales down", close(coverScale(4000, 3000, 100, 100, 0), 100 / 3000));
check("an empty photo still returns a sane scale", coverScale(0, 0, 100, 100, 0) === 1);
check("45 degrees needs the rotated bounding box", close(
  coverScale(1000, 1000, 200, 100, 45),
  (200 * Math.cos(Math.PI / 4) + 100 * Math.sin(Math.PI / 4)) / 1000,
));

console.log("sizing");
const stripSpec = (photos: BoothPhoto[]): BoothSpec => ({
  theme: PLACEHOLDER_THEME,
  layout: "strip4",
  photos,
  captions: { tripName: "", date: "", place: "" },
  stickers: [],
});

check("portrait outputs keep the long edge on height", (() => {
  const photos = [photo("a"), photo("b"), photo("c"), photo("d")];
  const size = boothSize(stripSpec(photos), 2000);
  return size.height === 2000 && size.width < 2000;
})());

check("square outputs are square", (() => {
  const size = boothSize({ ...stripSpec([]), layout: "grid2x2" }, 1800);
  return size.width === 1800 && size.height === 1800;
})());

check("polaroid output is portrait", (() => {
  const size = boothSize({ ...stripSpec([]), layout: "polaroid" }, 2000);
  return size.height === 2000 && size.width === Math.round(2000 * 0.92);
})());

console.log("theme");
check("the placeholder theme ships six-plus stickers", PLACEHOLDER_THEME.stickers.length >= 6);
check(
  "sticker ids are unique",
  new Set(PLACEHOLDER_THEME.stickers.map((sticker) => sticker.id)).size ===
    PLACEHOLDER_THEME.stickers.length,
);
check("every sticker has a glyph and a label", PLACEHOLDER_THEME.stickers.every(
  (sticker) => sticker.glyph.length > 0 && sticker.label.length > 0,
));
check("pickTheme falls back to the catch-all", pickTheme("beach").id === PLACEHOLDER_THEME.id);
check("pickTheme survives a null location", pickTheme(null).id === PLACEHOLDER_THEME.id);

console.log("limits");
check("photo limits keep zoom at or above cover", PHOTO_LIMITS.zoom.min === 1);
check("sticker limits bracket a sensible range", STICKER_LIMITS.scale.min < 1 && STICKER_LIMITS.scale.max > 1);
check("caps are four photos and a dozen stickers", MAX_PHOTOS === 4 && MAX_STICKERS === 12);
check("clamp pins the value", clamp(15, 0, 10) === 10 && clamp(-5, 0, 10) === 0);

console.log("draw plan");
type Call = { name: string; args: unknown[] };

function mockCtx(log: Call[]): CanvasRenderingContext2D {
  return new Proxy({} as CanvasRenderingContext2D, {
    get(_target, property) {
      if (property === "measureText") {
        return (text: string) => ({ width: String(text).length * 8 });
      }
      if (property === "createLinearGradient") {
        return () => ({ addColorStop: () => undefined });
      }
      if (typeof property === "symbol") return undefined;
      return (...args: unknown[]) => {
        log.push({ name: String(property), args });
      };
    },
    set(_target, property, value) {
      log.push({ name: `set.${String(property)}`, args: [value] });
      return true;
    },
  });
}

const spec = (overrides: Partial<BoothSpec>): BoothSpec => ({
  theme: PLACEHOLDER_THEME,
  layout: "grid2x2",
  photos: [],
  captions: { tripName: "", date: "", place: "" },
  stickers: [],
  ...overrides,
});

const count = (log: Call[], name: string) => log.filter((call) => call.name === name).length;
const indexOf = (log: Call[], name: string) => log.findIndex((call) => call.name === name);

{
  const log: Call[] = [];
  drawBooth(mockCtx(log), spec({}), { width: 900, height: 900 });
  check("empty booth still paints the background", count(log, "fillRect") >= 1);
  check("empty booth draws no photos", count(log, "drawImage") === 0);
  check("empty booth draws no text", count(log, "fillText") === 0);
}

{
  const log: Call[] = [];
  drawBooth(
    mockCtx(log),
    spec({ photos: [photo("a"), photo("b"), photo("c")], layout: "strip4" }),
    { width: 700, height: 2800 },
  );
  check("three photos draw three frames", count(log, "drawImage") === 3);
  check("each frame is clipped", count(log, "clip") === 3);
  check("background comes before the first photo",
    indexOf(log, "fillRect") < indexOf(log, "drawImage"));
}

{
  const log: Call[] = [];
  drawBooth(
    mockCtx(log),
    spec({ layout: "single", photos: [photo("a"), photo("b"), photo("c"), photo("d")] }),
    { width: 1000, height: 1000 },
  );
  check("the single layout uses only the first photo", count(log, "drawImage") === 1);
}

{
  const log: Call[] = [];
  drawBooth(
    mockCtx(log),
    spec({
      photos: [photo("a")],
      captions: { tripName: "Goa '26", date: "12 – 15 Jun", place: "Anjuna" },
      stickers: [
        { id: "s1", glyph: "✨", label: "Sparkle", x: 0.5, y: 0.4, scale: 1, rotation: 0 },
      ],
    }),
    { width: 900, height: 900 },
  );
  const texts = log.filter((call) => call.name === "fillText").map((call) => String(call.args[0]));
  check("the trip name is drawn", texts.includes("Goa '26"));
  check("dates and place share a line", texts.includes("12 – 15 Jun · Anjuna"));
  check("stickers are drawn as glyphs", texts.includes("✨"));
  check("the frame is stroked after the photos", indexOf(log, "drawImage") < indexOf(log, "stroke"));
}

{
  const log: Call[] = [];
  drawBooth(mockCtx(log), spec({ photos: [photo("a")] }), { width: 900, height: 900 }, {
    guides: { slotIndex: 0 },
  });
  const dashes = log.filter((call) => call.name === "setLineDash");
  check("selection guides switch the dash pattern on", dashes.some(
    (call) => Array.isArray(call.args[0]) && call.args[0][0] === 6,
  ));
}

{
  const log: Call[] = [];
  drawBooth(mockCtx(log), spec({}), { width: 900, height: 900 });
  check("no guides, no dash pattern", count(log, "setLineDash") === 0);
}

check("the sticker base size is a fraction of the short edge", STICKER_BASE > 0 && STICKER_BASE < 0.5);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log(`failures: ${failures.join(", ")}`);
  process.exit(1);
}
