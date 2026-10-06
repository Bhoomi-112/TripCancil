"use client";

import { useMemo, useState } from "react";
import {
  LOCATION_TYPE_COLOURS,
  LOCATION_TYPE_LABELS,
  LOCATION_TYPES,
} from "@/lib/constants";
import type { TripDay } from "@/lib/itinerary/days";
import {
  myVoteFor,
  sortBallot,
  totalVotesCast,
  type MapPayload,
  type VoteValue,
} from "@/lib/maps/places";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LockIcon, StarIcon } from "@/components/ui/icons";
import { Window } from "@/components/ui/window";
import { BallotRow } from "./ballot-row";

type Props = {
  payload: MapPayload;
  viewerId: string;
  days: TripDay[];
  isOwner: boolean;
  editable: boolean;
  /** Design-page stand-ins; see the note on `BallotRow`. */
  onVote?: (placeId: string, value: VoteValue) => void;
  onLockIn?: (placeId: string, dayIndex: number) => void;
};

/**
 * The ballot: every pin the group is still arguing about, best score first.
 * Counts come from the same payload the map polls, so a vote cast on a phone
 * shows up on the laptop's next 5s refresh without a second request.
 */
export function Ballot({
  payload,
  viewerId,
  days,
  isOwner,
  editable,
  onVote,
  onLockIn,
}: Props) {
  const [showLocked, setShowLocked] = useState(false);

  // Candidates rank first; the settled pins trail behind in their own section,
  // still in score order, because a settled decision is worth a glance but not
  // a place in the race.
  const candidates = useMemo(
    () => payload.places.filter((place) => place.status !== "locked"),
    [payload],
  );
  const locked = useMemo(
    () => payload.places.filter((place) => place.status === "locked"),
    [payload],
  );
  const candidateRows = useMemo(() => sortBallot(candidates), [candidates]);
  const lockedRows = useMemo(() => sortBallot(locked), [locked]);

  const votesCast = totalVotesCast(payload);
  const leader = candidateRows[0];
  const mine = candidates.filter(
    (place) => myVoteFor(place, viewerId) !== null,
  ).length;
  const cheering = candidateRows.length > 1;

  return (
    <Window
      title="Ballot"
      icon={<StarIcon className="size-4 text-sunny" />}
      actions={
        <Badge tone={candidateRows.length > 0 ? "pop" : "chrome"}>
          {candidateRows.length} up for grabs
        </Badge>
      }
      footer={
        editable ? (
          <p className="text-[11px] font-semibold text-ink-soft">
            {votesCast} vote{votesCast === 1 ? "" : "s"} cast · you have weighed in
            on {mine} of {candidateRows.length}
            {leader && leader.votes.score > 0
              ? ` · ${leader.name} is winning`
              : ""}
          </p>
        ) : (
          <p className="text-[11px] font-semibold text-ink-soft">
            Read-only: this trip is over, so the ballot is closed.
          </p>
        )
      }
    >
      {candidateRows.length === 0 && lockedRows.length === 0 ? (
        <EmptyState
          illustration="map"
          title="No candidates yet"
          description="Search for a spot on the map and hit Propose. Then everyone votes on whether it is worth the drive."
        />
      ) : (
        <>
          {lockedRows.length > 0 ? (
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowLocked((value) => !value)}
                aria-pressed={showLocked}
                aria-expanded={showLocked}
                className="inline-flex items-center gap-1.5 rounded-full border-2 border-silver-deep bg-white/70 px-2.5 py-1 font-display text-[9px] uppercase tracking-tight text-ink transition-transform duration-150 hover:border-ink active:translate-y-[2px]"
              >
                <LockIcon className="size-3 text-ink-soft" aria-hidden="true" />
                {showLocked ? "Hide" : "Show"} the {lockedRows.length} settled
              </button>
            </div>
          ) : null}

          {candidateRows.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {candidateRows.map((place, index) => (
                <BallotRow
                  key={place.id}
                  place={place}
                  members={payload.members}
                  viewerId={viewerId}
                  days={days}
                  isOwner={isOwner}
                  editable={editable}
                  rank={cheering ? index + 1 : undefined}
                  onVote={onVote}
                  onLockIn={onLockIn}
                />
              ))}
            </ul>
          ) : null}

          {lockedRows.length > 0 && showLocked ? (
            <div className="mt-3">
              <div className="mb-2 flex items-center gap-2">
                <h3 className="font-display text-[9px] uppercase tracking-tight text-ink-soft">
                  Settled decisions
                </h3>
                <span className="h-px flex-1 bg-silver-deep/70" aria-hidden="true" />
              </div>
              <ul className="flex flex-col gap-2">
                {lockedRows.map((place) => (
                  <BallotRow
                    key={place.id}
                    place={place}
                    members={payload.members}
                    viewerId={viewerId}
                    days={days}
                    isOwner={isOwner}
                    editable={editable}
                    onVote={onVote}
                    onLockIn={onLockIn}
                  />
                ))}
              </ul>
            </div>
          ) : null}

          <VibeLegend />
        </>
      )}
    </Window>
  );
}

/**
 * A reminder of what the coloured dot on a pin means, on the same screen as the
 * rows that use it. Cheap, and it stops the list reading as decoration.
 */
function VibeLegend() {
  return (
    <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1 border-t-2 border-dashed border-silver-deep pt-2">
      {LOCATION_TYPES.map((type) => (
        <li
          key={type}
          className="inline-flex items-center gap-1 font-display text-[9px] uppercase tracking-tight text-ink-soft"
        >
          <span
            className="size-2 rounded-full border border-ink/20"
            style={{ background: LOCATION_TYPE_COLOURS[type] }}
            aria-hidden="true"
          />
          {LOCATION_TYPE_LABELS[type]}
        </li>
      ))}
    </ul>
  );
}