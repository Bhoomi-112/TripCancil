"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useCallback, useMemo, useState, useTransition } from "react";
import useSWR from "swr";
import { idleState } from "@/lib/actions/state";
import { ScreenHeader } from "@/components/shell/screen-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LockIcon, PlusIcon, TrashIcon } from "@/components/ui/icons";
import { Modal } from "@/components/ui/modal";
import { SkeletonCard } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { byPosition, type TripDay } from "@/lib/itinerary/days";
import type { ItineraryItem, ItineraryPayload } from "@/lib/itinerary/types";
import {
  deleteItineraryItemAction,
  reorderItineraryDayAction,
} from "./actions";
import { ItineraryItemForm } from "./itinerary-item-form";
import { ItineraryRow } from "./itinerary-row";

async function fetchItinerary(url: string): Promise<ItineraryPayload> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      response.status === 401
        ? "Your session expired. Sign in again."
        : "Could not reach the trip.",
    );
  }
  return response.json() as Promise<ItineraryPayload>;
}

type Props = {
  tripId: string;
  days: TripDay[];
  initial: ItineraryPayload;
  /** False once the trip is over: the same board, minus every write affordance. */
  editable: boolean;
};

export function PlanBoard({ tripId, days, initial, editable }: Props) {
  const toast = useToast();
  const [dayIndex, setDayIndex] = useState(0);
  /** `undefined` closes the editor; `null` means "adding". */
  const [editing, setEditing] = useState<ItineraryItem | null | undefined>(
    undefined,
  );
  const [deleting, setDeleting] = useState<ItineraryItem | null>(null);
  const [paused, setPaused] = useState(false);
  const [isPending, startTransition] = useTransition();

  const { data, mutate } = useSWR<ItineraryPayload>(
    `/api/trips/${tripId}/itinerary`,
    fetchItinerary,
    {
      fallbackData: initial,
      refreshInterval: paused ? 0 : 5000,
      revalidateOnFocus: true,
      keepPreviousData: true,
    },
  );

  const items = useMemo(() => data?.items ?? [], [data]);
  const places = useMemo(() => data?.places ?? [], [data]);
  const placeNames = useMemo(
    () => new Map(places.map((place) => [place.id, place.name])),
    [places],
  );

  const dayItems = useMemo(
    () => items.filter((item) => item.day_index === dayIndex).sort(byPosition),
    [items, dayIndex],
  );

  const counts = useMemo(() => {
    const map = new Map<number, number>();
    for (const item of items) {
      map.set(item.day_index, (map.get(item.day_index) ?? 0) + 1);
    }
    return map;
  }, [items]);

  const sensors = useSensors(
    // A small activation distance keeps a tap on the row from starting a drag,
    // and lets the list scroll normally on touch.
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (!editable) return;
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const ids = dayItems.map((item) => item.id);
      const from = ids.indexOf(String(active.id));
      const to = ids.indexOf(String(over.id));
      if (from < 0 || to < 0) return;

      const reordered = [...ids];
      reordered.splice(to, 0, ...reordered.splice(from, 1));

      // Show the new order immediately, then let the server catch up. The poll is
      // paused for the round trip so it cannot yank the row back mid-flight.
      setPaused(true);
      mutate(
        (current) => applyOrder(current ?? { items, places }, dayIndex, reordered),
        { revalidate: false },
      );

      startTransition(async () => {
        const state = await reorderItineraryDayAction(idleState, dayIndex, reordered);
        if (!state.ok) {
          toast.error(state.error ?? "Could not save that order.");
        }
        setPaused(false);
        await mutate();
      });
    },
    [dayIndex, dayItems, editable, items, mutate, places, toast],
  );

  const handleDelete = useCallback(() => {
    if (!deleting) return;
    const target = deleting;
    setDeleting(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("itemId", target.id);
      const state = await deleteItineraryItemAction(idleState, formData);
      if (state.ok) {
        toast.success(`Removed "${target.title}".`);
        mutate();
      } else {
        toast.error(state.error ?? "Could not remove that.");
      }
    });
  }, [deleting, mutate, toast]);

  const activeDay = days[dayIndex] ?? days[0];

  return (
    <>
      <ScreenHeader
        title="Plan"
        subtitle={
          activeDay
            ? `${activeDay.chip} � ${editable ? "drag to reorder" : "read-only"}`
            : "Itinerary"
        }
        actions={
          editable ? (
            <div className="flex items-center gap-2">
              <span className="hidden items-center gap-1.5 rounded-full border-2 border-lime-deep bg-lime/80 px-2 py-1 font-display text-[9px] uppercase tracking-tight text-ink sm:inline-flex">
                <span className="size-2 animate-blink rounded-full bg-lime-deep" />
                live 5s
              </span>
              <Button
                size="sm"
                variant="accent"
                sparkle
                onClick={() => setEditing(null)}
              >
                <PlusIcon className="size-4" />
                Add
              </Button>
            </div>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-ink px-2.5 py-1 font-display text-[9px] uppercase tracking-tight text-cream">
              <LockIcon className="size-3.5" />
              Read-only
            </span>
          )
        }
      />

      <div
        role="tablist"
        aria-label="Trip days"
        className="mb-4 flex gap-2 overflow-x-auto pb-2"
      >
        {days.map((day) => {
          const count = counts.get(day.index) ?? 0;
          const selected = day.index === dayIndex;
          return (
            <button
              key={day.index}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setDayIndex(day.index)}
              className={
                selected
                  ? "gloss flex shrink-0 flex-col items-start gap-0.5 rounded-2xl border-2 border-electric-deep bg-electric px-3 py-2 text-left text-white shadow-bubble"
                  : "flex shrink-0 flex-col items-start gap-0.5 rounded-2xl border-2 border-silver-mid bg-white/70 px-3 py-2 text-left text-ink-soft transition-[transform,border-color] active:translate-y-[2px] hover:border-electric"
              }
            >
              <span className="font-display text-[10px] uppercase tracking-tight">
                {day.label}
              </span>
              <span
                className={
                  selected
                    ? "text-[11px] font-bold text-white/85"
                    : "text-[11px] font-bold text-ink-soft/80"
                }
              >
                {day.weekday} {day.date}
              </span>
              <span
                className={
                  selected
                    ? "rounded-full bg-lime px-1.5 font-display text-[9px] text-ink"
                    : "rounded-full bg-silver px-1.5 font-display text-[9px] text-ink-soft"
                }
              >
                {count} {count === 1 ? "plan" : "plans"}
              </span>
            </button>
          );
        })}
      </div>

      {!data ? (
        <div className="flex flex-col gap-3">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : dayItems.length === 0 ? (
        <EmptyState
          illustration="cloud"
          title="Nothing on this day yet"
          description={
            editable
              ? "Add the first plan item. Drag it into place and everyone sees the change."
              : "The crew never planned anything for this day."
          }
          action={
            editable && (
              <Button variant="accent" sparkle onClick={() => setEditing(null)}>
                <PlusIcon className="size-4" />
                Add to {activeDay?.label ?? "this day"}
              </Button>
            )
          }
        />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={dayItems.map((item) => item.id)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="flex flex-col gap-2.5">
              {dayItems.map((item, index) => (
                <ItineraryRow
                  key={item.id}
                  item={item}
                  order={index}
                  placeName={item.place_id ? placeNames.get(item.place_id) : undefined}
                  editable={editable}
                  onEdit={() => setEditing(item)}
                  onDelete={() => setDeleting(item)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      <Modal
        open={editing !== undefined}
        onClose={() => setEditing(undefined)}
        title={editing ? "edit-plan.exe" : "new-plan.exe"}
        description={
          editing
            ? "Changes show up for the whole crew."
            : activeDay
              ? `Adding to ${activeDay.label}. You can move it later.`
              : "Adding to the plan."
        }
      >
        {editing !== undefined && (
          <ItineraryItemForm
            key={editing?.id ?? "new"}
            days={days}
            places={places}
            item={editing}
            defaultDayIndex={dayIndex}
            onDone={() => {
              setEditing(undefined);
              mutate();
            }}
          />
        )}
      </Modal>

      <Modal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="delete.bin"
        size="sm"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              Keep it
            </Button>
            <Button
              variant="danger"
              loading={isPending}
              onClick={handleDelete}
            >
              <TrashIcon className="size-4" />
              Delete
            </Button>
          </div>
        }
      >
        <p className="text-sm font-semibold text-ink-soft">
          &ldquo;{deleting?.title}&rdquo; comes off the plan for everyone. There
          is no undo, but you can add it back.
        </p>
      </Modal>
    </>
  );
}

/** Local, immutable rewrite of one day's order, used for the optimistic drag. */
function applyOrder(
  payload: ItineraryPayload,
  dayIndex: number,
  orderedIds: string[],
): ItineraryPayload {
  const positions = new Map(orderedIds.map((id, index) => [id, index]));
  return {
    ...payload,
    items: payload.items.map((item) =>
      positions.has(item.id)
        ? { ...item, position: positions.get(item.id) ?? item.position }
        : item,
    ),
  };
}