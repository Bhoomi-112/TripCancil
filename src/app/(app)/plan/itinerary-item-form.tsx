"use client";

import { useActionState, useEffect, useId } from "react";
import type { ActionState } from "@/lib/actions/state";
import { idleState } from "@/lib/actions/state";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { toTimeInput, type TripDay } from "@/lib/itinerary/days";
import type { ItineraryItem, PlaceOption } from "@/lib/itinerary/types";
import {
  createItineraryItemAction,
  updateItineraryItemAction,
} from "./actions";

type Props = {
  days: TripDay[];
  places: PlaceOption[];
  item?: ItineraryItem | null;
  /** Day the add button was pressed on, so a new item lands where you are looking. */
  defaultDayIndex: number;
  onDone: () => void;
};

/**
 * One form for create and edit. Both actions take the same shape and return the
 * same `ActionState`, so the only difference is which one is handed to
 * `useActionState` and what the fields start as.
 */
export function ItineraryItemForm({
  days,
  places,
  item,
  defaultDayIndex,
  onDone,
}: Props) {
  const toast = useToast();
  const uid = useId();
  const action = item ? updateItineraryItemAction : createItineraryItemAction;
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    action,
    idleState,
  );

  useEffect(() => {
    if (state.ok) {
      toast.success(item ? "Plan item updated." : "Added to the plan.");
      onDone();
    }
  }, [state.ok, item, toast, onDone]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {item && <input type="hidden" name="itemId" value={item.id} />}

      <Field
        label="what are you doing"
        htmlFor={`${uid}-title`}
        error={state.fieldErrors?.title}
      >
        <Input
          id={`${uid}-title`}
          name="title"
          required
          maxLength={120}
          autoFocus
          placeholder="Sunset at the lake"
          defaultValue={item?.title ?? ""}
          invalid={Boolean(state.fieldErrors?.title)}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="day"
          htmlFor={`${uid}-day`}
          error={state.fieldErrors?.dayIndex}
        >
          <Select
            id={`${uid}-day`}
            name="dayIndex"
            defaultValue={String(item?.day_index ?? defaultDayIndex)}
            invalid={Boolean(state.fieldErrors?.dayIndex)}
          >
            {days.map((day) => (
              <option key={day.index} value={day.index}>
                {day.label} · {day.weekday} {day.date}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="start time"
          htmlFor={`${uid}-time`}
          error={state.fieldErrors?.startTime}
          hint="Optional. Leave it empty for an all-day plan."
        >
          <Input
            id={`${uid}-time`}
            name="startTime"
            type="time"
            defaultValue={toTimeInput(item?.start_time ?? null)}
            invalid={Boolean(state.fieldErrors?.startTime)}
          />
        </Field>
      </div>

      <Field
        label="place"
        htmlFor={`${uid}-place`}
        error={state.fieldErrors?.placeId}
        hint="Pick a pin from the Map tab, or leave it empty."
      >
        <Select
          id={`${uid}-place`}
          name="placeId"
          defaultValue={item?.place_id ?? ""}
          invalid={Boolean(state.fieldErrors?.placeId)}
        >
          <option value="">No place</option>
          {places.map((place) => (
            <option key={place.id} value={place.id}>
              {place.name}
              {place.status === "locked" ? " (locked in)" : ""}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label="notes"
        htmlFor={`${uid}-notes`}
        error={state.fieldErrors?.notes}
        hint="Tickets, meeting point, who is bringing what."
      >
        <Textarea
          id={`${uid}-notes`}
          name="notes"
          maxLength={500}
          rows={3}
          placeholder="Meet at the gate at 7. Ravi is bringing the speaker."
          defaultValue={item?.notes ?? ""}
          invalid={Boolean(state.fieldErrors?.notes)}
        />
      </Field>

      {state.error ? (
        <p
          role="alert"
          className="rounded-2xl border-2 border-hotpink-deep bg-hotpink/10 px-3 py-2 text-sm font-extrabold text-hotpink-deep"
        >
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={onDone} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" variant="accent" loading={pending} sparkle>
          {item ? "Save changes" : "Add to plan"}
        </Button>
      </div>
    </form>
  );
}