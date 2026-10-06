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
import { ArrowDownIcon, ArrowUpIcon, LockIcon } from "@/components/ui/icons";
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
  /** 1-based place among the candidates; only the top three wear a medal. */
  rank?: number;
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
  rank,
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
  const daysLabel = place.days
    .map((index) => days[index]?.label ?? `Day ${index + 1}`)
    .join(", ");
  const medal = rank !== undefined && rank <= 3;

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
        "flex flex-col gap-2 rounded-bubble border-2 p-3",
        locked
          ? "border-silver-deep bg-white/50"
          : "border-silver-mid bg-white/70",
      )}
    >
      <div className="flex items-start gap-2">
        {medal ? <RankMedal rank={rank as number} /> : null}

        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-sm leading-tight font-extrabold text-ink">
            {locked ? (
              <LockIcon className="size-3.5 shrink-0 text-ink-soft" aria-hidden="true" />
            ) : null}
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
          <p
            className={cn(
              "mt-0.5 font-display text-[9px] uppercase tracking-tight",
              locked ? "text-ink-soft/70" : "text-ink-soft",
            )}
          >
            {locked ? "Locked in" : "Candidate"}
            {place.locationType
              ? ` · ${LOCATION_TYPE_LABELS[place.locationType as LocationType]}`
              : ""}
            {proposer ? ` · by ${proposer}` : ""}
            {daysLabel ? (locked ? ` · on ${daysLabel}` : ` · ${daysLabel}`) : ""}
          </p>
        </div>

        <ScoreBadge
          score={place.votes.score}
          locked={locked}
          up={place.votes.up}
          down={place.votes.down}
        />
      </div>

      <div className="flex items-center gap-2">
        {/* Ring colour is the vote: lime for in, pink for out, plain for quiet. */}
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
          <div className="flex shrink-0 items-center gap-1.5">
            <VoteButton
              value={1}
              count={place.votes.up}
              active={mine === 1}
              busy={busy === 1}
              onClick={() => vote(1)}
            />
            <VoteButton
              value={-1}
              count={place.votes.down}
              active={mine === -1}
              busy={busy === -1}
              onClick={() => vote(-1)}
            />
          </div>
        ) : (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border-2 border-silver-deep bg-white/70 px-2.5 py-1 font-display text-[9px] uppercase tracking-tight text-ink-soft">
            <ArrowUpIcon className="size-3 text-lime-deep" aria-hidden="true" />
            {place.votes.up}
            <span className="text-ink/25" aria-hidden="true">
              ·
            </span>
            {place.votes.down}
            <ArrowDownIcon className="size-3 text-hotpink-deep" aria-hidden="true" />
          </span>
        )}
      </div>

      {voters.length > 0 ? (
        <SplitBar
          up={place.votes.up}
          down={place.votes.down}
          total={voters.length}
        />
      ) : null}

      {isOwner && editable && !locked ? (
        <LockInForm place={place} days={days} onLockIn={onLockIn} />
      ) : null}
    </li>
  );
}

/**
 * The standing of each place at a glance: a one-segment bar that fills lime for
 * the votes in and pink for the votes out, so a row with a three-inch lime run
 * is clearly winning even with the phone face down.
 */
function SplitBar({ up, down, total }: { up: number; down: number; total: number }) {
  return (
    <div
      role="img"
      aria-label={`${up} in, ${down} out`}
      className="flex h-1.5 w-full overflow-hidden rounded-full border border-ink/10 bg-silver"
    >
      {up > 0 ? (
        <div
          className="h-full bg-lime-deep"
          style={{ width: `${(up / total) * 100}%` }}
        />
      ) : null}
      {down > 0 ? (
        <div
          className="h-full bg-hotpink"
          style={{ width: `${(down / total) * 100}%` }}
        />
      ) : null}
    </div>
  );
}

function ordinal(rank: number) {
  if (rank === 1) return "1st";
  if (rank === 2) return "2nd";
  return "3rd";
}

function RankMedal({ rank }: { rank: number }) {
  return (
    <span
      title={`#${rank} in the ballot`}
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-full border-2 font-display text-[10px] shadow-bubble",
        rank === 1
          ? "border-[#b57a00] bg-sunny text-ink shadow-sticker"
          : rank === 2
            ? "border-silver-deep bg-linear-to-b from-white to-silver-mid text-ink"
            : "border-ink bg-electric text-white",
      )}
    >
      {ordinal(rank)}
    </span>
  );
}

/**
 * In / Out, one tap each. Tapping an active one again takes the vote back, and
 * the whole pill flips to the vote's colour so the active side is unmissable.
 */
function VoteButton({
  value,
  count,
  active,
  busy,
  onClick,
}: {
  value: VoteValue;
  count: number;
  active: boolean;
  busy: boolean;
  onClick: () => void;
}) {
  const inVote = value === 1;
  const Icon = inVote ? ArrowUpIcon : ArrowDownIcon;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-busy={busy || undefined}
      aria-label={`Vote ${inVote ? "in" : "out"}`}
      title={inVote ? "Worth the drive" : "Skip it"}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border-2 px-2 py-1 font-display text-[9px] uppercase tracking-tight transition-transform duration-150 active:translate-y-[2px]",
        active
          ? inVote
            ? "border-ink bg-lime text-ink shadow-sticker"
            : "border-ink bg-hotpink text-white shadow-sticker"
          : "border-silver-deep bg-white text-ink-soft hover:border-ink",
      )}
    >
      {busy ? (
        <span
          className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      ) : (
        <Icon className="size-3" aria-hidden="true" />
      )}
      <span>{inVote ? "In" : "Out"}</span>
      <span
        className={cn(
          "rounded-full px-1",
          active ? "bg-white/30" : "bg-silver-deep/60 text-ink",
        )}
      >
        {count}
      </span>
    </button>
  );
}

function ScoreBadge({
  score,
  locked,
  up,
  down,
}: {
  score: number;
  locked: boolean;
  up: number;
  down: number;
}) {
  return (
    <span
      className={cn(
        "gloss inline-flex shrink-0 items-center gap-1 rounded-full border-2 px-2.5 py-1 font-display text-xs shadow-bubble",
        locked
          ? "border-silver-deep bg-linear-to-b from-white to-silver-mid text-ink"
          : score > 0
            ? "border-lime-deep bg-lime text-ink"
            : score < 0
              ? "border-hotpink-deep bg-hotpink text-white"
              : "border-silver-deep bg-linear-to-b from-white to-silver-mid text-ink",
      )}
      title={`${up} in, ${down} out`}
    >
      {locked && score === 0 ? "✓" : score > 0 ? `+${score}` : score}
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