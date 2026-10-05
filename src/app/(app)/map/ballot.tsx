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
import { StarIcon } from "@/components/ui/icons";
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

  const candidates = useMemo(
    () => payload.places.filter((place) => place.status !== "locked"),
    [payload],
  );
  const locked = useMemo(
    () => payload.places.filter((place) => place.status === "locked"),
    [payload],
  );
  // Candidates ranked by score; locked pins trail behind, still in score order,
  // because a settled decision is worth a glance but not a place in the race.
  const rows = useMemo(
    () => (showLocked ? sortBallot([...candidates, ...locked]) : sortBallot(candidates)),
    [candidates, locked, showLocked],
  );

  const votesCast = totalVotesCast(payload);
  const leader = sortBallot(candidates)[0];
  const mine = candidates.filter(
    (place) => myVoteFor(place, viewerId) !== null,
  ).length;

  return (
    <Window
      title="Ballot"
      icon={<StarIcon className="size-4 text-sunny" />}
      actions={
        <Badge tone={candidates.length > 0 ? "pop" : "chrome"}>
          {candidates.length} up for grabs
        </Badge>
      }
      footer={
        editable ? (
          <p className="text-[11px] font-semibold text-ink-soft">
            {votesCast} vote{votesCast === 1 ? "" : "s"} cast · you have weighed in
            on {mine} of {candidates.length}
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
      {rows.length === 0 ? (
        <EmptyState
          illustration="map"
          title="No candidates yet"
          description="Search for a spot on the map and hit Propose. Then everyone votes on whether it is worth the drive."
        />
      ) : (
        <>
          {locked.length > 0 ? (
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowLocked((value) => !value)}
                aria-pressed={showLocked}
                className="rounded-full border-2 border-silver-deep bg-white/70 px-2.5 py-1 font-display text-[9px] uppercase tracking-tight text-ink transition-transform duration-150 active:translate-y-[2px] hover:border-ink"
              >
                {showLocked ? "Hide" : "Show"} the {locked.length} settled
              </button>
            </div>
          ) : null}

          <ul className="flex flex-col gap-2">
            {rows.map((place) => (
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