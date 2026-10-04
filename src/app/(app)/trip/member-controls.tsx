"use client";

import { useActionState, useState } from "react";
import { idleState, type ActionState } from "@/lib/actions/state";
import { Button, IconButton } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PinInput } from "@/components/auth/pin-input";
import { TrashIcon } from "@/components/ui/icons";
import {
  removeMemberAction,
  resetPinAction,
  rotateInviteCodeAction,
} from "@/app/(app)/actions";

export function RotateInviteButton() {
  const [pending, setPending] = useState(false);
  const [state, setState] = useState<{ tone: "success" | "error"; text: string } | null>(
    null,
  );

  return (
    <div className="flex flex-col items-end gap-1.5">
      <Button
        type="button"
        variant="chrome"
        size="sm"
        loading={pending}
        onClick={async () => {
          setPending(true);
          const result = await rotateInviteCodeAction();
          setPending(false);
          setState(
            result.ok
              ? { tone: "success", text: "New code minted." }
              : { tone: "error", text: result.error ?? "Could not rotate the code." },
          );
        }}
      >
        Rotate code
      </Button>
      {state ? (
        <p
          role="status"
          className={
            state.tone === "success"
              ? "text-xs font-extrabold text-lime-deep"
              : "text-xs font-extrabold text-hotpink-deep"
          }
        >
          {state.text}
        </p>
      ) : null}
    </div>
  );
}

export function MemberRow({
  memberId,
  displayName,
  isOwner,
  isSelf,
  canManage,
  locked,
}: {
  memberId: string;
  displayName: string;
  isOwner: boolean;
  isSelf: boolean;
  /** Only the trip owner gets the destructive controls. The actions re-check it. */
  canManage: boolean;
  locked: boolean;
}) {
  const [showReset, setShowReset] = useState(false);
  // Closing on success happens inside the action, not in an effect, so the panel
  // collapses once without a cascading render.
  const [resetState, resetAction, resetting] = useActionState(
    async (previous: ActionState, formData: FormData) => {
      const result = await resetPinAction(previous, formData);
      if (result.ok) setShowReset(false);
      return result;
    },
    idleState,
  );
  const [removeState, removeAction, removing] = useActionState(
    removeMemberAction,
    idleState,
  );

  return (
    <li className="flex flex-col gap-2 rounded-2xl border-2 border-silver-mid bg-white/70 p-3">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-extrabold text-ink">
            {displayName}
            {isSelf ? " (you)" : ""}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {isOwner ? (
              <Badge tone="grape" sticker>
                Owner
              </Badge>
            ) : (
              <Badge tone="chrome">Member</Badge>
            )}
            {locked ? <Badge tone="bubble">Locked out</Badge> : null}
          </div>
        </div>

        {canManage && !isOwner ? (
          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowReset((open) => !open)}
            >
              {showReset ? "Cancel" : "Reset PIN"}
            </Button>
            <form action={removeAction}>
              <input type="hidden" name="memberId" value={memberId} />
              <IconButton
                type="submit"
                variant="danger"
                size="sm"
                label={`Remove ${displayName}`}
                disabled={removing}
              >
                <TrashIcon className="size-4" />
              </IconButton>
            </form>
          </div>
        ) : null}
      </div>

      {removeState.error ? (
        <p role="alert" className="text-xs font-extrabold text-hotpink-deep">
          {removeState.error}
        </p>
      ) : null}
      {removeState.ok ? (
        <p role="status" className="text-xs font-extrabold text-lime-deep">
          {displayName} was removed.
        </p>
      ) : null}

      {showReset ? (
        <form action={resetAction} className="flex flex-col gap-2 rounded-2xl border-2 border-dashed border-silver-deep bg-cream p-3">
          <input type="hidden" name="memberId" value={memberId} />
          <Field
            label="new 6-digit pin"
            error={resetState.fieldErrors?.pin}
            hint={`Tell ${displayName} the new PIN. It also lifts any lockout.`}
          >
            <PinInput name="pin" invalid={Boolean(resetState.fieldErrors?.pin)} />
          </Field>
          <Field label="confirm pin" error={resetState.fieldErrors?.confirmPin}>
            <Input
              name="confirmPin"
              type="password"
              inputMode="numeric"
              maxLength={6}
              required
              pattern="\d{6}"
              invalid={Boolean(resetState.fieldErrors?.confirmPin)}
              className="text-center font-display tracking-[0.35em]"
            />
          </Field>
          <Button type="submit" variant="primary" size="sm" loading={resetting}>
            Save new PIN
          </Button>
        </form>
      ) : null}
    </li>
  );
}
