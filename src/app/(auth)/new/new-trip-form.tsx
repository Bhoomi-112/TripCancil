"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { idleState } from "@/lib/actions/state";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Window } from "@/components/ui/window";
import { PinInput } from "@/components/auth/pin-input";
import { LOCATION_TYPES, LOCATION_TYPE_LABELS } from "@/lib/constants";
import { createTripAction } from "../actions";

const inputClass =
  "w-full rounded-2xl border-2 border-silver-deep bg-white px-3 py-2.5 text-base font-bold shadow-[inset_0_2px_4px_rgb(37_26_66/0.08)] focus:border-electric";

export function NewTripForm() {
  const router = useRouter();
  const [state, action, pending] = useActionState(createTripAction, idleState);

  useEffect(() => {
    if (state.redirectTo) router.push(state.redirectTo);
  }, [router, state.redirectTo]);

  return (
    <Window
      title="new-trip.exe"
      bodyClassName="flex flex-col gap-4"
      footer={
        <p className="text-center text-xs font-semibold text-ink-soft">
          Got a code from a friend instead?{" "}
          <Link
            href="/join"
            className="font-extrabold text-electric-deep underline decoration-dotted"
          >
            Join their trip
          </Link>
        </p>
      }
    >
      <form action={action} className="flex flex-col gap-4">
        <Field label="trip name" htmlFor="name" error={state.fieldErrors?.name}>
          <Input
            id="name"
            name="name"
            required
            maxLength={80}
            placeholder="Konkan Coast Run"
            invalid={Boolean(state.fieldErrors?.name)}
          />
        </Field>

        <Field
          label="destination"
          htmlFor="destination"
          error={state.fieldErrors?.destination}
        >
          <Input
            id="destination"
            name="destination"
            required
            maxLength={120}
            placeholder="Alibaug, Maharashtra"
            invalid={Boolean(state.fieldErrors?.destination)}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="from" htmlFor="startDate" error={state.fieldErrors?.startDate}>
            <input
              id="startDate"
              name="startDate"
              type="date"
              required
              className={inputClass}
            />
          </Field>
          <Field label="to" htmlFor="endDate" error={state.fieldErrors?.endDate}>
            <input
              id="endDate"
              name="endDate"
              type="date"
              required
              className={inputClass}
            />
          </Field>
        </div>

        <Field label="vibe" htmlFor="locationType">
          <select
            id="locationType"
            name="locationType"
            defaultValue="city"
            className={inputClass}
          >
            {LOCATION_TYPES.map((type) => (
              <option key={type} value={type}>
                {LOCATION_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="your display name"
          htmlFor="displayName"
          error={state.fieldErrors?.displayName}
          hint="You are the owner, so you can reset PINs and remove members."
        >
          <Input
            id="displayName"
            name="displayName"
            required
            maxLength={40}
            autoComplete="nickname"
            placeholder="Bhoomi"
            invalid={Boolean(state.fieldErrors?.displayName)}
          />
        </Field>

        <Field
          label="your 6-digit pin"
          error={state.fieldErrors?.pin}
          hint="Nobody, not even the owner, can read it back."
        >
          <PinInput name="pin" invalid={Boolean(state.fieldErrors?.pin)} />
        </Field>

        <Field
          label="confirm pin"
          htmlFor="confirmPin"
          error={state.fieldErrors?.confirmPin}
        >
          <Input
            id="confirmPin"
            name="confirmPin"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={6}
            required
            pattern="\d{6}"
            invalid={Boolean(state.fieldErrors?.confirmPin)}
            className="text-center font-display tracking-[0.35em]"
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

        <Button type="submit" variant="accent" size="lg" block loading={pending} sparkle>
          Create trip + mint invite code
        </Button>
      </form>
    </Window>
  );
}
