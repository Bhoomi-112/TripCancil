"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useSWRConfig } from "swr";
import { cn } from "@/lib/cn";
import {
  LOCATION_TYPE_COLOURS,
  LOCATION_TYPE_LABELS,
} from "@/lib/constants";
import { idleState } from "@/lib/actions/state";
import type { LocationType } from "@/lib/db/types";
import type { TripDay } from "@/lib/itinerary/days";
import {
  isPlacesKey,
  myVoteFor,
  nameOf,
  votersInNameOrder,
  type MapMember,
  type MapPlace,
  type VoteValue,
} from "@/lib/maps/places";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { lockInPlaceAction, voteOnPlaceAction } from "./actions";

type Props = {
  place: MapPlace;
  members: MapMember[];
  viewerId: string;
  days: TripDay[];
  isOwner: boolean;
  editable: boolean;
  /**
   * Replaces the server round trip. Only the design page passes one, because it
   * has no session and no database: there the ballot is a poster, not a form.
   */
  onVote?: (placeId: string, value: VoteValue) => void;
  onLockIn?: (placeId: string, dayIndex: number) => void;
};

export function BallotRow({
  place,
  members,
  viewerId,
  days,
  isOwner,
  editable,
  onVote,
  onLockIn,
}: Props) {
  const [busy, setBusy] = useState<VoteValue | null>(null);
  /**
   * The vote we are about to have. Set before the server answers so a tap feels
   * instant, and dropped as soon as the poll brings the truth back in.
   */
  const [pending, setPending] = useState<VoteValue | null | undefined>(undefined);
  const { mutate } = useSWRConfig();
  const toast = useToast();

  const mine = pending === undefined ? myVoteFor(place, viewerId) : pending;
  const locked = place.status === "locked";
  const voters = votersInNameOrder(place, members);
  const proposer = nameOf(members, place.proposedBy);

  async function vote(value: VoteValue) {
    if (busy) return;
    setBusy(value);
    setPending(mine === value ? null : value);
    try {
      if (onVote) {
        onVote(place.id, value);
        return;
      }
      const result = await voteOnPlaceAction(place.id, value);
      if (result.error) {
        setPending(undefined);
        toast.error(result.error);
        return;
      }
      await mutate(isPlacesKey);
      // The poll has the server's answer now, so stop overriding it.
      setPending(undefined);
    } finally {
      setBusy(null);
    }
  }

  return (
    <li
      className={cn(
        "flex flex-col gap-2 rounded-bubble border-2 bg-white/70 p-3",
        locked ? "border-silver-deep" : "border-silver-mid",
      )}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-sm leading-tight font-extrabold text-ink">
            {place.locationType ? (
              <span
                className="size-2.5 shrink-0 rounded-full border border-ink/20"
                style={{
                  background: LOCATION_TYPE_COLOURS[place.locationType as LocationType],
                }}
                aria-hidden="true"
              />
            ) : null}
            <span className="truncate">{place.name}</span>
          </p>
          <p className="mt-0.5 font-display text-[9px] uppercase tracking-tight text-ink-soft">
            {locked ? "Locked in" : "Candidate"}
            {place.locationType
              ? ` · ${LOCATION_TYPE_LABELS[place.locationType as LocationType]}`
              : ""}
            {proposer ? ` · by ${proposer}` : ""}
            {place.days.length > 0
              ? ` · ${place.days
                  .map((index) => days[index]?.label ?? `Day ${index + 1}`)
                  .join(", ")}`
              : ""}
          </p>
        </div>
        <ScoreBadge score={place.votes.score} />
      </div>

      <div className="flex items-center gap-2">
        {/* Ring colour is the vote: green for in, pink for out, plain for quiet. */}
        <div className="flex min-w-0 flex-1 items-center -space-x-1.5">
          {voters.length === 0 ? (
            <span className="text-[11px] font-semibold text-ink-soft">
              Nobody has voted yet
            </span>
          ) : (
            voters.map((voter) => (
              <Avatar
                key={voter.memberId}
                name={voter.name}
                size="xs"
                className={cn(
                  "ring-2",
                  voter.value === 1 ? "ring-lime-deep" : "ring-hotpink",
                  voter.memberId === viewerId && "ring-offset-1 ring-offset-white",
                )}
              />
            ))
          )}
        </div>

        {!locked && editable ? (
          <div className="flex shrink-0 items-center gap-1">
            <VoteButton
              label="Vote yes"
              count={place.votes.up}
              active={mine === 1}
              busy={busy === 1}
              onClick={() => vote(1)}
            />
            <VoteButton
              label="Vote no"
              count={place.votes.down}
              active={mine === -1}
              busy={busy === -1}
              onClick={() => vote(-1)}
            />
          </div>
        ) : (
          <span className="shrink-0 font-display text-[9px] uppercase tracking-tight text-ink-soft">
            {place.votes.up} in · {place.votes.down} out
          </span>
        )}
      </div>

      {isOwner && editable && !locked ? (
        <LockInForm place={place} days={days} onLockIn={onLockIn} />
      ) : null}
    </li>
  );
}

/** One tap, one vote, one change of mind. Tapping it again takes the vote back. */
function VoteButton({
  label,
  count,
  active,
  busy,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  busy: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      title={label}
      aria-busy={busy || undefined}
      className={cn(
        "inline-flex min-w-11 items-center justify-center gap-1 rounded-full border-2 px-2 py-1 font-display text-[9px] uppercase tracking-tight transition-transform duration-150 active:translate-y-[2px]",
        active
          ? "border-ink bg-lime text-ink shadow-sticker"
          : "border-silver-deep bg-white text-ink-soft hover:border-ink",
      )}
    >
      {busy ? (
        <span
          className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      ) : (
        count
      )}
      <span aria-hidden="true">{active ? "✓" : ""}</span>
    </button>
  );
}

function ScoreBadge({ score }: { score: number }) {
  return (
    <span
      className={cn(
        "gloss inline-flex shrink-0 items-center gap-1 rounded-full border-2 px-2.5 py-1 font-display text-xs shadow-bubble",
        score > 0
          ? "border-lime-deep bg-lime text-ink"
          : score < 0
            ? "border-hotpink-deep bg-hotpink text-white"
            : "border-silver-deep bg-linear-to-b from-white to-silver-mid text-ink",
      )}
      title="Upvotes minus downvotes"
    >
      {score > 0 ? `+${score}` : score}
    </span>
  );
}

/**
 * The owner's side of a ballot: pick the day, put it in the plan. Same action the
 * pin pop-up uses, because it is the same decision.
 */
function LockInForm({
  place,
  days,
  onLockIn,
}: {
  place: MapPlace;
  days: TripDay[];
  onLockIn?: (placeId: string, dayIndex: number) => void;
}) {
  const [state, lockIn, locking] = useActionState(lockInPlaceAction, idleState);
  const [target, setTarget] = useState(0);
  const toast = useToast();
  const announced = useRef(false);
  const { mutate } = useSWRConfig();

  useEffect(() => {
    if (!state.ok || announced.current) return;
    announced.current = true;
    toast.success(`${place.name} is in the plan.`);
    void mutate(isPlacesKey);
  }, [state, toast, place.name, mutate]);

  const alreadyOn = place.days.includes(target);

  return (
    <form
      action={lockIn}
      className="flex flex-col gap-1.5 border-t-2 border-dashed border-silver-deep pt-2"
    >
      <input type="hidden" name="placeId" value={place.id} />
      <input type="hidden" name="dayIndex" value={target} />
      <div className="flex items-center gap-1.5">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Day for {place.name}</span>
          <Select
            value={target}
            onChange={(event) => setTarget(Number(event.target.value))}
            className="h-9 py-0 text-xs"
          >
            {days.map((entry) => (
              <option key={entry.index} value={entry.index}>
                {entry.chip}
              </option>
            ))}
          </Select>
        </label>
        {onLockIn ? (
          <Button
            type="button"
            variant="pop"
            size="sm"
            disabled={alreadyOn}
            onClick={() => onLockIn(place.id, target)}
          >
            Lock in
          </Button>
        ) : (
          <Button
            type="submit"
            variant="pop"
            size="sm"
            loading={locking}
            disabled={alreadyOn}
          >
            Lock in
          </Button>
        )}
      </div>
      {alreadyOn ? (
        <p className="font-display text-[9px] uppercase tracking-tight text-ink-soft">
          Already a stop on {days[target]?.label ?? "that day"}
        </p>
      ) : null}
      {state.error ? (
        <p className="text-[11px] font-extrabold text-hotpink-deep">{state.error}</p>
      ) : null}
    </form>
  );
}