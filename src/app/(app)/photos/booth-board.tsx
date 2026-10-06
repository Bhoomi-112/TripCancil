"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { CloseIcon, PlusIcon, TrashIcon } from "@/components/ui/icons";
import { useToast } from "@/components/ui/toast";
import { Window } from "@/components/ui/window";
import { LAYOUTS } from "@/lib/booth/layouts";
import { exportBoothPng } from "@/lib/booth/render";
import { pickTheme } from "@/lib/booth/themes";
import {
  MAX_PHOTOS,
  MAX_STICKERS,
  PHOTO_LIMITS,
  STICKER_LIMITS,
  clamp,
  type BoothCaptions,
  type BoothPhoto,
  type BoothSelection,
  type BoothSpec,
  type BoothSticker,
  type LayoutId,
  type LocationType,
} from "@/lib/booth/types";
import { cn } from "@/lib/cn";
import { BoothPreview } from "./booth-preview";

type Props = {
  tripName: string;
  dateLabel: string;
  place: string;
  locationType: LocationType;
};

function loadPhoto(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("unreadable"));
    };
    image.src = url;
  });
}

function GroupLabel({ children }: { children: ReactNode }) {
  return (
    <p className="font-display text-[9px] uppercase tracking-tight text-ink-soft">
      {children}
    </p>
  );
}

function SliderRow({
  label,
  display,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  display: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between gap-2">
        <span className="font-display text-[9px] uppercase text-ink-soft">{label}</span>
        <span className="text-xs font-extrabold text-ink">{display}</span>
      </span>
      <input
        type="range"
        className="mt-1 w-full accent-electric"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

export function BoothBoard({ tripName, dateLabel, place, locationType }: Props) {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<BoothPhoto[]>([]);
  const [stickers, setStickers] = useState<BoothSticker[]>([]);
  const [layout, setLayout] = useState<LayoutId>("strip4");
  const [captions, setCaptions] = useState<BoothCaptions>({
    tripName,
    date: dateLabel,
    place,
  });
  const [selection, setSelection] = useState<BoothSelection>(null);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);

  const theme = useMemo(() => pickTheme(locationType), [locationType]);
  const spec: BoothSpec = useMemo(
    () => ({ theme, layout, photos, captions, stickers }),
    [theme, layout, photos, captions, stickers],
  );
  const selectedPhoto =
    selection?.kind === "photo"
      ? (photos.find((photo) => photo.id === selection.id) ?? null)
      : null;
  const selectedSticker =
    selection?.kind === "sticker"
      ? (stickers.find((sticker) => sticker.id === selection.id) ?? null)
      : null;

  const addFiles = async (files: FileList) => {
    const picked = [...files].filter((file) => file.type.startsWith("image/"));
    if (picked.length === 0) {
      toast.info("Photos only, please.");
      return;
    }
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) {
      toast.info("Four photos is the booth's maximum.");
      return;
    }
    setBusy(true);
    const loaded: BoothPhoto[] = [];
    for (const file of picked.slice(0, room)) {
      try {
        const image = await loadPhoto(file);
        loaded.push({
          id: crypto.randomUUID(),
          image,
          zoom: 1,
          rotation: 0,
          offsetX: 0,
          offsetY: 0,
        });
      } catch {
        toast.error("One of those files was not a readable photo.");
      }
    }
    setBusy(false);
    if (loaded.length > 0) {
      setPhotos((current) => [...current, ...loaded].slice(0, MAX_PHOTOS));
      const nextCount = photos.length + loaded.length;
      const active = LAYOUTS.find((item) => item.id === layout);
      if (active && nextCount > active.maxPhotos) {
        const fit = LAYOUTS.find((item) => item.maxPhotos >= nextCount);
        if (fit) setLayout(fit.id);
      }
    }
    if (picked.length > room) toast.info("Only the first four were kept.");
  };

  const removePhoto = (id: string) => {
    setPhotos((current) => {
      const target = current.find((photo) => photo.id === id);
      if (target) URL.revokeObjectURL(target.image.src);
      return current.filter((photo) => photo.id !== id);
    });
    setSelection((current) => (current?.id === id ? null : current));
  };

  const clearPhotos = () => {
    photos.forEach((photo) => URL.revokeObjectURL(photo.image.src));
    setPhotos([]);
    setSelection((current) => (current?.kind === "photo" ? null : current));
  };

  const patchPhoto = (id: string, patch: Partial<BoothPhoto>) => {
    setPhotos((current) =>
      current.map((photo) => (photo.id === id ? { ...photo, ...patch } : photo)),
    );
  };

  const panPhoto = (id: string, dx: number, dy: number) => {
    setPhotos((current) =>
      current.map((photo) =>
        photo.id === id
          ? {
              ...photo,
              offsetX: clamp(photo.offsetX + dx, -PHOTO_LIMITS.pan, PHOTO_LIMITS.pan),
              offsetY: clamp(photo.offsetY + dy, -PHOTO_LIMITS.pan, PHOTO_LIMITS.pan),
            }
          : photo,
      ),
    );
  };

  const moveSticker = (id: string, x: number, y: number) => {
    const edge = STICKER_LIMITS.edge;
    setStickers((current) =>
      current.map((sticker) =>
        sticker.id === id
          ? {
              ...sticker,
              x: clamp(x, edge, 1 - edge),
              y: clamp(y, edge, 1 - edge),
            }
          : sticker,
      ),
    );
  };

  const pinchSticker = (id: string, scale: number, rotation: number) => {
    setStickers((current) =>
      current.map((sticker) =>
        sticker.id === id
          ? {
              ...sticker,
              scale: clamp(scale, STICKER_LIMITS.scale.min, STICKER_LIMITS.scale.max),
              rotation: clamp(
                rotation,
                STICKER_LIMITS.rotation.min,
                STICKER_LIMITS.rotation.max,
              ),
            }
          : sticker,
      ),
    );
  };

  const addSticker = (glyph: string, label: string) => {
    if (stickers.length >= MAX_STICKERS) {
      toast.info("That is plenty of stickers for one print.");
      return;
    }
    const sticker: BoothSticker = {
      id: crypto.randomUUID(),
      glyph,
      label,
      x: 0.5,
      y: 0.45,
      scale: 1,
      rotation: 0,
    };
    setStickers((current) => [...current, sticker]);
    setSelection({ kind: "sticker", id: sticker.id });
  };

  const removeSticker = (id: string) => {
    setStickers((current) => current.filter((sticker) => sticker.id !== id));
    setSelection((current) => (current?.id === id ? null : current));
  };

  const download = async () => {
    setExporting(true);
    try {
      const blob = await exportBoothPng(spec, 2000);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `tripcancil-booth-${layout}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast.success("Strip downloaded as a PNG.");
    } catch {
      toast.error("The export failed. Try again?");
    } finally {
      setExporting(false);
    }
  };

  const chipClass = (active: boolean) =>
    cn(
      "rounded-2xl border-2 px-3 py-2 text-left transition active:translate-y-[2px]",
      active
        ? "border-electric-deep bg-electric/10 shadow-bubble"
        : "border-silver-deep bg-white/85 shadow-bubble hover:border-electric",
    );

  return (
    <div className="space-y-3">
      <Window
        title="booth.studio"
        icon={<Badge tone="pop">canvas</Badge>}
        actions={<Badge tone="chrome">{photos.length}/{MAX_PHOTOS}</Badge>}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <GroupLabel>Photos</GroupLabel>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="chrome"
                disabled={photos.length >= MAX_PHOTOS || busy}
                onClick={() => fileInputRef.current?.click()}
              >
                <PlusIcon className="size-3.5" />
                Add
              </Button>
              {photos.length > 0 && (
                <Button size="sm" variant="ghost" onClick={clearPhotos}>
                  Clear
                </Button>
              )}
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(event) => {
              if (event.target.files) void addFiles(event.target.files);
              event.target.value = "";
            }}
          />

          {photos.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {photos.map((photo, index) => (
                <li
                  key={photo.id}
                  className={cn(
                    "relative size-16 overflow-hidden rounded-xl border-2",
                    selection?.kind === "photo" && selection.id === photo.id
                      ? "border-electric shadow-[0_0_0_3px_rgb(47_73_255/0.25)]"
                      : "border-silver-deep",
                  )}
                >
                  <button
                    type="button"
                    className="h-full w-full"
                    onClick={() => setSelection({ kind: "photo", id: photo.id })}
                    aria-label={`Select photo ${index + 1}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.image.src}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </button>
                  <button
                    type="button"
                    className="absolute top-0.5 right-0.5 grid size-5 place-items-center rounded-full border border-ink/40 bg-hotpink text-white"
                    onClick={() => removePhoto(photo.id)}
                    aria-label={`Remove photo ${index + 1}`}
                  >
                    <CloseIcon className="size-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <BoothPreview
            spec={spec}
            selection={selection}
            onSelect={setSelection}
            onPhotoPan={panPhoto}
            onStickerMove={moveSticker}
            onStickerPinch={pinchSticker}
          />

          <p className="text-xs font-semibold text-ink-soft">
            Tap a photo or a sticker, then drag on the booth to move it.
          </p>

          {selectedPhoto && (
            <section className="space-y-3 rounded-2xl border-2 border-dashed border-electric/60 bg-electric/5 p-3">
              <div className="flex items-center justify-between">
                <GroupLabel>
                  Photo {photos.findIndex((photo) => photo.id === selectedPhoto.id) + 1}
                </GroupLabel>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    patchPhoto(selectedPhoto.id, { zoom: 1, rotation: 0, offsetX: 0, offsetY: 0 })
                  }
                >
                  Reset
                </Button>
              </div>
              <SliderRow
                label="Zoom"
                display={`${selectedPhoto.zoom.toFixed(2)}×`}
                value={selectedPhoto.zoom}
                min={PHOTO_LIMITS.zoom.min}
                max={PHOTO_LIMITS.zoom.max}
                step={0.01}
                onChange={(value) => patchPhoto(selectedPhoto.id, { zoom: value })}
              />
              <SliderRow
                label="Rotate"
                display={`${Math.round(selectedPhoto.rotation)}°`}
                value={selectedPhoto.rotation}
                min={PHOTO_LIMITS.rotation.min}
                max={PHOTO_LIMITS.rotation.max}
                step={1}
                onChange={(value) => patchPhoto(selectedPhoto.id, { rotation: value })}
              />
            </section>
          )}

          <section>
            <GroupLabel>Layout</GroupLabel>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              {LAYOUTS.map((item) => {
                const disabled = photos.length > item.maxPhotos;
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={disabled}
                    aria-pressed={layout === item.id}
                    title={disabled ? `Needs ${item.maxPhotos} photo or fewer` : item.hint}
                    onClick={() => setLayout(item.id)}
                    className={cn(chipClass(layout === item.id), disabled && "opacity-40")}
                  >
                    <span className="block font-display text-[9px] uppercase text-ink">
                      {item.label}
                    </span>
                    <span className="block text-[11px] font-semibold text-ink-soft">
                      {item.hint}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="space-y-2">
            <GroupLabel>Text</GroupLabel>
            <Field label="Trip name" htmlFor="booth-trip-name">
              <Input
                id="booth-trip-name"
                value={captions.tripName}
                maxLength={40}
                onChange={(event) =>
                  setCaptions((current) => ({ ...current, tripName: event.target.value }))
                }
                placeholder="Goa '26"
              />
            </Field>
            <Field label="Dates" htmlFor="booth-dates">
              <Input
                id="booth-dates"
                value={captions.date}
                maxLength={40}
                onChange={(event) =>
                  setCaptions((current) => ({ ...current, date: event.target.value }))
                }
                placeholder="12 – 15 Jun"
              />
            </Field>
            <Field label="Place" htmlFor="booth-place" hint="Shown under the trip name.">
              <Input
                id="booth-place"
                value={captions.place}
                maxLength={40}
                onChange={(event) =>
                  setCaptions((current) => ({ ...current, place: event.target.value }))
                }
                placeholder="Anjuna beach"
              />
            </Field>
          </section>

          <section>
            <div className="flex items-center justify-between">
              <GroupLabel>Stickers</GroupLabel>
              <span className="text-xs font-extrabold text-ink-soft">
                {stickers.length}/{MAX_STICKERS}
              </span>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {theme.stickers.map((sticker) => (
                <button
                  key={sticker.id}
                  type="button"
                  aria-label={`Add ${sticker.label} sticker`}
                  onClick={() => addSticker(sticker.glyph, sticker.label)}
                  className="grid size-11 place-items-center rounded-2xl border-2 border-silver-deep bg-white/85 text-2xl shadow-bubble transition active:translate-y-[3px] active:shadow-none"
                >
                  {sticker.glyph}
                </button>
              ))}
            </div>
          </section>

          {selectedSticker && (
            <section className="space-y-3 rounded-2xl border-2 border-dashed border-hotpink/60 bg-hotpink/5 p-3">
              <div className="flex items-center justify-between">
                <GroupLabel>Sticker · {selectedSticker.label}</GroupLabel>
                <Button size="sm" variant="danger" onClick={() => removeSticker(selectedSticker.id)}>
                  <TrashIcon className="size-3.5" />
                  Delete
                </Button>
              </div>
              <SliderRow
                label="Size"
                display={`${Math.round(selectedSticker.scale * 100)}%`}
                value={selectedSticker.scale}
                min={STICKER_LIMITS.scale.min}
                max={STICKER_LIMITS.scale.max}
                step={0.05}
                onChange={(value) =>
                  pinchSticker(selectedSticker.id, value, selectedSticker.rotation)
                }
              />
              <SliderRow
                label="Rotate"
                display={`${Math.round(selectedSticker.rotation)}°`}
                value={selectedSticker.rotation}
                min={STICKER_LIMITS.rotation.min}
                max={STICKER_LIMITS.rotation.max}
                step={1}
                onChange={(value) =>
                  pinchSticker(selectedSticker.id, selectedSticker.scale, value)
                }
              />
            </section>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-lime-deep bg-lime/40 p-3">
            <div>
              <p className="font-display text-[10px] uppercase text-ink">Ready to print</p>
              <p className="text-xs font-semibold text-ink-soft">
                A high-res PNG, straight from the canvas.
              </p>
            </div>
            <Button
              variant="pop"
              sparkle
              loading={exporting}
              disabled={photos.length === 0}
              onClick={() => void download()}
            >
              Download PNG
            </Button>
          </div>
        </div>
      </Window>
    </div>
  );
}
