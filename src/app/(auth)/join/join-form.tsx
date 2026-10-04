"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { idleState } from "@/lib/actions/state";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Window } from "@/components/ui/window";
import { PinInput } from "@/components/auth/pin-input";
import { joinTripAction } from "../actions";

export function JoinForm({ defaultCode }: { defaultCode?: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState(joinTripAction, idleState);

  useEffect(() => {
    if (state.redirectTo) router.push(state.redirectTo);
  }, [router, state.redirectTo]);

  return (
    <Window
      title="join.exe"
      bodyClassName="flex flex-col gap-4"
      footer={
        <p className="text-center text-xs font-semibold text-ink-soft">
          No invite code yet?{" "}
          <Link
            href="/new"
            className="font-extrabold text-electric-deep underline decoration-dotted"
          >
            Start a trip
          </Link>
        </p>
      }
    >
      <form action={action} className="flex flex-col gap-4">
        <Field
          label="invite code"
          htmlFor="inviteCode"
          error={state.fieldErrors?.inviteCode}
          hint="12 characters from the trip owner."
        >
          <Input
            id="inviteCode"
            name="inviteCode"
            defaultValue={defaultCode}
            required
            minLength={12}
            maxLength={12}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            placeholder="ABCD2345EFGH"
            invalid={Boolean(state.fieldErrors?.inviteCode)}
            className="font-display text-sm tracking-[0.2em]"
          />
        </Field>

        <Field
          label="display name"
          htmlFor="displayName"
          error={state.fieldErrors?.displayName}
          hint="How the group will see you. First join locks the name."
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
          label="6-digit pin"
          error={state.fieldErrors?.pin}
          hint="Pick one if you are new here, or type the one you set before."
        >
          <PinInput name="pin" invalid={Boolean(state.fieldErrors?.pin)} />
        </Field>

        {state.error ? (
          <p
            role="alert"
            className="rounded-2xl border-2 border-hotpink-deep bg-hotpink/10 px-3 py-2 text-sm font-extrabold text-hotpink-deep"
          >
            {state.error}
          </p>
        ) : null}

        <Button type="submit" variant="primary" size="lg" block loading={pending} sparkle>
          Join the trip
        </Button>
      </form>
    </Window>
  );
}
