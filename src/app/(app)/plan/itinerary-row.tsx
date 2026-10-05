"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { IconButton } from "@/components/ui/button";
import {
  ClockIcon,
  GripIcon,
  PencilIcon,
  PinIcon,
  TrashIcon,
} from "@/components/ui/icons";
import { formatClock } from "@/lib/itinerary/days";
import type { ItineraryItem } from "@/lib/itinerary/types";

export function ItineraryRow({
  item,
  order,
  placeName,
  onEdit,
  onDelete,
}: {
  item: ItineraryItem;
  order: number;
  placeName?: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const time = formatClock(item.start_time);

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={
        isDragging
          ? "relative z-10 opacity-70"
          : "relative"
      }
    >
      <div className="gloss flex items-start gap-2 rounded-2xl border-2 border-silver-mid bg-white/85 p-2.5 shadow-bubble transition-[border-color] duration-150">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Reorder ${item.title}`}
          className="mt-0.5 flex size-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-xl border-2 border-transparent text-silver-deep transition-colors hover:border-silver-mid hover:text-electric active:cursor-grabbing"
        >
          <GripIcon className="size-5" />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 font-display text-[10px] leading-4 text-silver-deep">
              {String(order + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0 flex-1">
              <p className="break-words font-extrabold leading-snug text-ink">
                {item.title}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-bold text-ink-soft">
                {time && (
                  <span className="inline-flex items-center gap-1 text-electric-deep">
                    <ClockIcon className="size-3.5" />
                    {time}
                  </span>
                )}
                {placeName && (
                  <span className="inline-flex min-w-0 items-center gap-1">
                    <PinIcon className="size-3.5 text-hotpink" />
                    <span className="truncate">{placeName}</span>
                  </span>
                )}
              </div>
              {item.notes && (
                <p className="mt-1.5 line-clamp-2 text-xs font-semibold text-ink-soft/90">
                  {item.notes}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row">
          <IconButton
            label={`Edit ${item.title}`}
            size="sm"
            variant="ghost"
            className="size-8"
            onClick={onEdit}
          >
            <PencilIcon className="size-4" />
          </IconButton>
          <IconButton
            label={`Delete ${item.title}`}
            size="sm"
            variant="ghost"
            className="size-8 hover:text-hotpink-deep"
            onClick={onDelete}
          >
            <TrashIcon className="size-4" />
          </IconButton>
        </div>
      </div>
    </li>
  );
}