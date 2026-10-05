"use client";

import { useState } from "react";
import { tripDays } from "@/lib/itinerary/days";
import {
  buildMapPayload,
  sortBallot,
  type MapPlaceSelect,
  type VoteValue,
} from "@/lib/maps/places";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Window } from "@/components/ui/window";
import { Ballot } from "@/app/(app)/map/ballot";

/**
 * Demo rows for the design page. They go through the real `buildMapPayload`, so
 * what is on screen here is the same shape the map tab polls, and every vote
 * button works: `Ballot` takes its own handlers when it has no session to talk
 * to, and this keeps the tally in local state.
 */

const MEMBERS = [
  { id: "m1", display_name: "Bhoomi" },
  { id: "m2", display_name: "Dev" },
  { id: "m3", display_name: "Ravi" },
  { id: "m4", display_name: "Sana" },
];

const RAW_PLACES: MapPlaceSelect[] = [
  {
    id: "p1",
    name: "Nagardhan viewpoint",
    lat: 18.4402,
    lng: 73.1408,
    category: "viewpoint",
    location_type: "heritage",
    status: "proposed",
    proposed_by: "m4",
    place_votes: [
      { member_id: "m1", value: 1 },
      { member_id: "m4", value: 1 },
      { member_id: "m3", value: -1 },
    ],
  },
  {
    id: "p2",
    name: "Alibaug beach resort",
    lat: 18.6679,
    lng: 72.8869,
    category: "stay",
    location_type: "beach",
    status: "proposed",
    proposed_by: "m3",
    place_votes: [
      { member_id: "m3", value: 1 },
      { member_id: "m2", value: 1 },
    ],
  },
  {
    id: "p3",
    name: "Tungabhadra dam road",
    lat: 18.3136,
    lng: 73.6157,
    category: "drive",
    location_type: "roadtrip",
    status: "proposed",
    proposed_by: "m1",
    place_votes: [
      { member_id: "m1", value: -1 },
      { member_id: "m3", value: -1 },
    ],
  },
  {
    id: "p4",
    name: "Koramana Beach",
    lat: 18.5023,
    lng: 72.8746,
    category: "beach",
    location_type: "beach",
    status: "locked",
    proposed_by: "m1",
    place_votes: [
      { member_id: "m1", value: 1 },
      { member_id: "m2", value: 1 },
      { member_id: "m3", value: 1 },
      { member_id: "m4", value: 1 },
    ],
  },
  {
    id: "p5",
    name: "Lonavala ridge point",
    lat: 18.7549,
    lng: 73.4207,
    category: "viewpoint",
    location_type: "mountain",
    status: "proposed",
    proposed_by: "m2",
    place_votes: [],
  },
];

const DAYS = tripDays("2026-11-13", "2026-11-15");

function Block({
  title,
  blurb,
  children,
}: {
  title: string;
  blurb: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-display text-sm uppercase tracking-tight text-electric-deep">
          {title}
        </h2>
        <p className="text-sm font-semibold text-ink-soft">{blurb}</p>
      </div>
      <Window title={title.toLowerCase().replace(/\s+/g, ".")} tone="cream">
        {children}
      </Window>
    </section>
  );
}

export function VotesSection() {
  const [viewerId, setViewerId] = useState("m1");
  const [isOwner, setIsOwner] = useState(true);
  const [raw, setRaw] = useState(RAW_PLACES);
  const [lockedDay, setLockedDay] = useState<number | null>(null);

  const payload = buildMapPayload({ places: raw, items: [], members: MEMBERS });

  /** The stand-in for the server: toggle this member's own vote, same rule. */
  function vote(placeId: string, value: VoteValue) {
    setRaw((places) =>
      places.map((place) => {
        if (place.id !== placeId) return place;
        const rest = place.place_votes.filter(
          (vote) => vote.member_id !== viewerId,
        );
        const mine = place.place_votes.find((vote) => vote.member_id === viewerId);
        const keep =
          mine?.value === value
            ? rest
            : [...rest, { member_id: viewerId, value }];
        return { ...place, place_votes: keep };
      }),
    );
  }

  /** And for the owner: the winner becomes a locked pin on the chosen day. */
  function lockIn(placeId: string, dayIndex: number) {
    setRaw((places) =>
      places.map((place) =>
        place.id === placeId ? { ...place, status: "locked" as const } : place,
      ),
    );
    setLockedDay(dayIndex);
  }

  const leaders = sortBallot(
    payload.places.filter((place) => place.status !== "locked"),
  );

  return (
    <>
      <Block
        title="Ballot"
        blurb="Candidates ranked by score. Tap a button to vote, tap it again to take it back, and as the owner pick the day you want the winner on."
      >
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="font-display text-[9px] uppercase tracking-tight text-ink-soft">
            Previewing as
          </span>
          {MEMBERS.map((member) => (
            <button
              key={member.id}
              type="button"
              onClick={() => setViewerId(member.id)}
              aria-pressed={viewerId === member.id}
              className={
                viewerId === member.id
                  ? "rounded-full border-2 border-ink bg-lime px-2.5 py-1 font-display text-[9px] uppercase tracking-tight text-ink shadow-sticker"
                  : "rounded-full border-2 border-silver-deep bg-white px-2.5 py-1 font-display text-[9px] uppercase tracking-tight text-ink-soft"
              }
            >
              {member.display_name}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setIsOwner((value) => !value)}
            aria-pressed={isOwner}
            className={
              isOwner
                ? "rounded-full border-2 border-ink bg-grape px-2.5 py-1 font-display text-[9px] uppercase tracking-tight text-white shadow-sticker"
                : "rounded-full border-2 border-silver-deep bg-white px-2.5 py-1 font-display text-[9px] uppercase tracking-tight text-ink-soft"
            }
          >
            {isOwner ? "Trip owner" : "Plain member"}
          </button>
        </div>

        <Ballot
          payload={payload}
          viewerId={viewerId}
          days={DAYS}
          isOwner={isOwner}
          editable
          onVote={vote}
          onLockIn={lockIn}
        />

        {lockedDay !== null ? (
          <p className="mt-2 text-[11px] font-bold text-forest">
            Locked into {DAYS[lockedDay]?.label ?? "the plan"}. The pin turns
            settled and leaves the race.
          </p>
        ) : null}
      </Block>

      <Block
        title="Scores"
        blurb="What the sort actually compares: score first, then ups, then name so a tie never jitters."
      >
        <div className="flex flex-col gap-1.5">
          {leaders.map((place, index) => (
            <div key={place.id} className="flex items-center gap-2">
              <span className="w-4 font-display text-[9px] text-ink-soft">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-bold text-ink">
                {place.name}
              </span>
              <Badge
                tone={
                  place.votes.score > 0
                    ? "pop"
                    : place.votes.score < 0
                      ? "bubble"
                      : "chrome"
                }
              >
                {place.votes.score > 0 ? `+${place.votes.score}` : place.votes.score}
              </Badge>
              <span className="w-24 text-right font-display text-[9px] uppercase tracking-tight text-ink-soft">
                {place.votes.up} in · {place.votes.down} out
              </span>
            </div>
          ))}
        </div>
      </Block>

      <Block
        title="Empty ballot"
        blurb="What a trip looks like before anybody has proposed anything."
      >
        <EmptyState
          illustration="map"
          title="No candidates yet"
          description="Search for a spot on the map and hit Propose. Then everyone votes on whether it is worth the drive."
        />
      </Block>
    </>
  );
}