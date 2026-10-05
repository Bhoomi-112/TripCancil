"use client";

import { useActionState, useEffect, useId } from "react";
import { idleState, type ActionState } from "@/lib/actions/state";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { LOCATION_TYPE_LABELS, LOCATION_TYPES } from "@/lib/constants";
import type { TravellerTrip } from "@/lib/traveller/service";
import { updateTripAction } from "./actions";

/** Owner-only. Renames, re-dates and re-themes the trip itself. */
export function TripEditForm({
  trip,
  onDone,
}: {
  trip: TravellerTrip;
  onDone: () => void;
}) {
  const toast = useToast();
  const uid = useId();
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    updateTripAction,
    idleState,
  );

  useEffect(() => {
    if (state.ok) {
      toast.success("Trip details updated.");
      onDone();
    }
  }, [state.ok, toast, onDone]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="tripId" value={trip.tripId} />

      <Field label="trip name" htmlFor={`${uid}-name`} error={state.fieldErrors?.name}>
        <Input
          id={`${uid}-name`}
          name="name"
          required
          maxLength={80}
          autoFocus
          defaultValue={trip.name}
          invalid={Boolean(state.fieldErrors?.name)}
        />
      </Field>

      <Field
        label="destination"
        htmlFor={`${uid}-destination`}
        error={state.fieldErrors?.destination}
      >
        <Input
          id={`${uid}-destination`}
          name="destination"
          required
          maxLength={120}
          defaultValue={trip.destination}
          invalid={Boolean(state.fieldErrors?.destination)}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="from"
          htmlFor={`${uid}-start`}
          error={state.fieldErrors?.startDate}
        >
          <Input
            id={`${uid}-start`}
            name="startDate"
            type="date"
            required
            defaultValue={trip.startDate}
            invalid={Boolean(state.fieldErrors?.startDate)}
          />
        </Field>

        <Field label="to" htmlFor={`${uid}-end`} error={state.fieldErrors?.endDate}>
          <Input
            id={`${uid}-end`}
            name="endDate"
            type="date"
            required
            defaultValue={trip.endDate}
            invalid={Boolean(state.fieldErrors?.endDate)}
          />
        </Field>
      </div>

      <Field
        label="vibe"
        htmlFor={`${uid}-vibe`}
        error={state.fieldErrors?.locationType}
      >
        <Select
          id={`${uid}-vibe`}
          name="locationType"
          defaultValue={trip.locationType ?? "city"}
          invalid={Boolean(state.fieldErrors?.locationType)}
        >
          {LOCATION_TYPES.map((type) => (
            <option key={type} value={type}>
              {LOCATION_TYPE_LABELS[type]}
            </option>
          ))}
        </Select>
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
          Save details
        </Button>
      </div>
    </form>
  );
}