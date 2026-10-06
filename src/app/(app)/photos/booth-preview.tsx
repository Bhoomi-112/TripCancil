"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { aspectFor, slotsFor } from "@/lib/booth/layouts";
import { STICKER_BASE, drawBooth, ensureBoothFonts } from "@/lib/booth/render";
import {
  STICKER_LIMITS,
  clamp,
  type BoothSelection,
  type BoothSpec,
} from "@/lib/booth/types";

type Props = {
  spec: BoothSpec;
  selection: BoothSelection;
  onSelect: (selection: BoothSelection) => void;
  /** Pan delta, in slot sizes. */
  onPhotoPan: (photoId: string, dx: number, dy: number) => void;
  onStickerMove: (stickerId: string, x: number, y: number) => void;
  onStickerPinch: (stickerId: string, scale: number, rotation: number) => void;
};

type Gesture =
  | {
      mode: "pan-photo";
      pointerId: number;
      photoId: string;
      slot: { x: number; y: number; w: number; h: number };
      last: { x: number; y: number };
    }
  | {
      mode: "drag-sticker";
      pointerId: number;
      stickerId: string;
      grab: { x: number; y: number };
    }
  | {
      mode: "pinch-sticker";
      pointerIds: [number, number];
      stickerId: string;
      startDistance: number;
      startAngle: number;
      startScale: number;
      startRotation: number;
    };

function angleDelta(degrees: number): number {
  let value = degrees % 360;
  if (value > 180) value -= 360;
  if (value < -180) value += 360;
  return value;
}

export function BoothPreview({
  spec,
  selection,
  onSelect,
  onPhotoPan,
  onStickerMove,
  onStickerPinch,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<Gesture | null>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });

  const photoCount = Math.max(1, spec.photos.length);
  const aspect = aspectFor(spec.layout, photoCount);

  useLayoutEffect(() => {
    const element = wrapRef.current;
    if (!element) return;
    const measure = () => {
      const width = element.clientWidth;
      setBox({ width, height: Math.round(width / aspect) });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [aspect]);

  const guides = useMemo(() => {
    if (selection?.kind === "photo") {
      return { slotIndex: spec.photos.findIndex((photo) => photo.id === selection.id) };
    }
    if (selection?.kind === "sticker") return { stickerId: selection.id };
    return {};
  }, [selection, spec.photos]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || box.width < 10) return;
    let cancelled = false;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.round(box.width * dpr);
    const height = Math.round(box.height * dpr);
    canvas.width = width;
    canvas.height = height;
    void ensureBoothFonts().then(() => {
      if (cancelled) return;
      const ctx = canvas.getContext("2d");
      if (ctx) drawBooth(ctx, spec, { width, height }, { guides });
    });
    return () => {
      cancelled = true;
    };
  }, [spec, guides, box]);

  const hitSticker = (x: number, y: number) => {
    if (box.width < 10 || box.height < 10) return null;
    const s = Math.min(box.width, box.height);
    for (let i = spec.stickers.length - 1; i >= 0; i -= 1) {
      const sticker = spec.stickers[i];
      const radius = STICKER_BASE * s * sticker.scale * 0.75 + 12;
      const dx = x - sticker.x * box.width;
      const dy = y - sticker.y * box.height;
      if (Math.hypot(dx, dy) <= radius) return sticker;
    }
    return null;
  };

  const hitSlotIndex = (x: number, y: number) => {
    if (box.width < 10 || box.height < 10) return -1;
    const slots = slotsFor(spec.layout, photoCount);
    for (let i = slots.length - 1; i >= 0; i -= 1) {
      const slot = slots[i];
      const left = slot.x * box.width;
      const top = slot.y * box.height;
      if (
        x >= left &&
        x <= left + slot.w * box.width &&
        y >= top &&
        y <= top + slot.h * box.height
      ) {
        return i;
      }
    }
    return -1;
  };

  const localPoint = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const handleDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    const point = localPoint(event);
    canvas.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, point);

    if (pointers.current.size >= 2) {
      const sticker =
        hitSticker(point.x, point.y) ??
        (selection?.kind === "sticker"
          ? (spec.stickers.find((item) => item.id === selection.id) ?? null)
          : null);
      if (sticker) {
        const [a, b] = [...pointers.current.entries()];
        const dx = b[1].x - a[1].x;
        const dy = b[1].y - a[1].y;
        gesture.current = {
          mode: "pinch-sticker",
          pointerIds: [a[0], b[0]],
          stickerId: sticker.id,
          startDistance: Math.hypot(dx, dy) || 1,
          startAngle: Math.atan2(dy, dx),
          startScale: sticker.scale,
          startRotation: sticker.rotation,
        };
        onSelect({ kind: "sticker", id: sticker.id });
        return;
      }
    }

    const sticker = hitSticker(point.x, point.y);
    if (sticker) {
      onSelect({ kind: "sticker", id: sticker.id });
      gesture.current = {
        mode: "drag-sticker",
        pointerId: event.pointerId,
        stickerId: sticker.id,
        grab: { x: point.x - sticker.x * box.width, y: point.y - sticker.y * box.height },
      };
      return;
    }

    const slotIndex = hitSlotIndex(point.x, point.y);
    const photo = spec.photos[slotIndex];
    if (photo) {
      onSelect({ kind: "photo", id: photo.id });
      const slot = slotsFor(spec.layout, photoCount)[slotIndex];
      gesture.current = {
        mode: "pan-photo",
        pointerId: event.pointerId,
        photoId: photo.id,
        slot: { x: slot.x * box.width, y: slot.y * box.height, w: slot.w * box.width, h: slot.h * box.height },
        last: point,
      };
      return;
    }

    onSelect(null);
    gesture.current = null;
  };

  const handleMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const point = localPoint(event);
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, point);
    const active = gesture.current;
    if (!active) return;

    if (active.mode === "pinch-sticker") {
      if (!active.pointerIds.includes(event.pointerId)) return;
      const a = pointers.current.get(active.pointerIds[0]);
      const b = pointers.current.get(active.pointerIds[1]);
      if (!a || !b) return;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distance = Math.hypot(dx, dy) || 1;
      const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
      onStickerPinch(
        active.stickerId,
        clamp(
          active.startScale * (distance / active.startDistance),
          STICKER_LIMITS.scale.min,
          STICKER_LIMITS.scale.max,
        ),
        active.startRotation + angleDelta(angle - (active.startAngle * 180) / Math.PI),
      );
      return;
    }

    if (active.mode === "pan-photo") {
      if (active.pointerId !== event.pointerId) return;
      onPhotoPan(
        active.photoId,
        (point.x - active.last.x) / active.slot.w,
        (point.y - active.last.y) / active.slot.h,
      );
      active.last = point;
      return;
    }

    if (active.pointerId !== event.pointerId) return;
    onStickerMove(
      active.stickerId,
      (point.x - active.grab.x) / box.width,
      (point.y - active.grab.y) / box.height,
    );
  };

  const handleUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    pointers.current.delete(event.pointerId);
    const active = gesture.current;
    if (!active) return;
    if (active.mode === "pinch-sticker") {
      if (active.pointerIds.includes(event.pointerId)) gesture.current = null;
      return;
    }
    if (active.pointerId === event.pointerId) gesture.current = null;
  };

  return (
    <div
      ref={wrapRef}
      className="relative w-full overflow-hidden rounded-2xl border-2 border-ink/15 bg-cream shadow-[inset_0_2px_8px_rgb(37_26_66/0.15)]"
      style={{ aspectRatio: String(aspect) }}
    >
      <canvas
        ref={canvasRef}
        aria-label="Photobooth preview — drag to move the selected photo or sticker"
        className="absolute inset-0 h-full w-full touch-none"
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerCancel={handleUp}
      />
      {spec.photos.length === 0 && (
        <p className="pointer-events-none absolute inset-x-0 bottom-3 text-center font-display text-[9px] uppercase text-ink-soft">
          Add photos to fill the frames
        </p>
      )}
    </div>
  );
}
