"use client";

import { useActionState, useEffect, useId } from "react";
import { idleState, type ActionState } from "@/lib/actions/state";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import type { TravellerTrip } from "@/lib/traveller/service";
import { deleteTripAction } from "./actions";

/**
 * Every count here is real: it comes from the same rows `deleteTrip` cascades,
 * so the confirmation says what is actually about to disappear rather than a
 * vague "this cannot be undone".
 */
export function TripDeleteForm({
  trip,
  onDone,
}: {
  trip: TravellerTrip;
  onDone: () => void;
}) {
  const toast = useToast();
  const uid = useId();
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    deleteTripAction,
    idleState,
  );

  useEffect(() => {
    if (state.ok) {
      toast.success(`${trip.name} is gone.`);
      onDone();
    }
  }, [state.ok, toast, onDone, trip.name]);

  const gone = [
    `${trip.memberCount} ${trip.memberCount === 1 ? "member" : "members"}`,
    `${trip.itemCount} plan ${trip.itemCount === 1 ? "item" : "items"}`,
    `${trip.expenseCount} ${trip.expenseCount === 1 ? "expense" : "expenses"}`,
    `${trip.photoCount} ${trip.photoCount === 1 ? "photo" : "photos"}`,
    `${trip.documentCount} ${trip.documentCount === 1 ? "document" : "documents"}`,
  ];

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="tripId" value={trip.tripId} />

      <ul className="grid gap-1.5 rounded-2xl border-2 border-silver-deep bg-white/70 p-3">
        {gone.map((line) => (
          <li
            key={line}
            className="flex items-center gap-2 text-sm font-bold text-ink-soft"
          >
            <span aria-hidden="true" className="size-1.5 rounded-full bg-hotpink" />
            {line}
          </li>
        ))}
        <li className="flex items-center gap-2 text-sm font-bold text-ink-soft">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-hotpink" />
          every file in the trip&apos;s private buckets
        </li>
      </ul>

      <Field
        label={`type "${trip.name}" to confirm`}
        htmlFor={`${uid}-confirm`}
        error={state.fieldErrors?.confirmName}
        hint="Everyone in the trip loses access immediately."
      >
        <Input
          id={`${uid}-confirm`}
          name="confirmName"
          required
          autoComplete="off"
          autoFocus
          placeholder={trip.name}
          invalid={Boolean(state.fieldErrors?.confirmName)}
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
          Keep this trip
        </Button>
        <Button type="submit" variant="danger" loading={pending}>
          Delete forever
        </Button>
      </div>
    </form>
  );
}