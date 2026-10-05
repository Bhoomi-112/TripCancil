import type { LocationType, Tables } from "@/lib/db/types";

/**
 * Everything the map needs, in one shape, built by a pure function. The
 * server-rendered page and the 5s polling route both call `buildMapPayload`, so
 * the first paint and every refresh hand the map the exact same object and a
 * pin never jumps because two code paths ordered things differently.
 *
 * Free of `server-only` on purpose: the client components import it too.
 */

export type MapPlaceRow = Pick<
  Tables<"places">,
  "id" | "name" | "lat" | "lng" | "category" | "location_type" | "status"
>;

/** One row of `place_votes` as the embedded select hands it over. */
export type VoteRow = { member_id: string; value: number };

/**
 * A place as the polling select returns it: the flat columns plus the votes
 * PostgREST embeds for us, so the ballot needs no second query.
 */
export type MapPlaceSelect = MapPlaceRow & {
  proposed_by: string | null;
  place_votes: VoteRow[];
};

export type MapItemRow = Pick<
  Tables<"itinerary_items">,
  "id" | "day_index" | "position" | "created_at" | "place_id" | "title"
>;

/** Just enough of a member to say who did what; never a pin hash. */
export type MapMember = { id: string; displayName: string };

export type VoteValue = 1 | -1;

/** One place's ballot: the counts, and every vote so the UI can show who voted. */
export type PlaceVotes = {
  up: number;
  down: number;
  /** up - down. The number the ballot sorts on. */
  score: number;
  byMember: { memberId: string; value: VoteValue }[];
};

export type MapPlace = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category: string | null;
  locationType: Tables<"places">["location_type"];
  status: Tables<"places">["status"];
  /** 0-based days this place is pinned into, ascending. */
  days: number[];
  /** Who put the pin on the map. */
  proposedBy: string | null;
  votes: PlaceVotes;
};

/** The visit order for one day, so the map can draw a line through it. */
export type MapRoute = {
  dayIndex: number;
  placeIds: string[];
};

export type MapPayload = {
  places: MapPlace[];
  routes: MapRoute[];
  members: MapMember[];
};

type LatLng = { lat: number; lng: number };

const EARTH_RADIUS_KM = 6371;

/**
 * Counts one place's votes and keeps every one of them, because "who voted what"
 * is the point of a group ballot. Values outside (-1, 1) cannot happen through
 * this app - the column is a check - so anything else is dropped rather than
 * counted towards a score.
 */
export function tallyVotes(rows: VoteRow[]): PlaceVotes {
  const byMember: { memberId: string; value: VoteValue }[] = [];
  let up = 0;
  let down = 0;

  for (const row of rows) {
    if (row.value !== 1 && row.value !== -1) continue;
    const value: VoteValue = row.value;
    byMember.push({ memberId: row.member_id, value });
    if (value === 1) up += 1;
    else down += 1;
  }

  // Member id order keeps the payload byte-identical between polls; the ballot
  // re-sorts by display name, which is what a person reads.
  byMember.sort((a, b) => a.memberId.localeCompare(b.memberId));

  return { up, down, score: up - down, byMember };
}

export function buildMapPayload(input: {
  places: MapPlaceSelect[];
  items: MapItemRow[];
  members: { id: string; display_name: string }[];
}): MapPayload {
  const { places, items } = input;
  const known = new Set(places.map((place) => place.id));
  const daysByPlace = new Map<string, Set<number>>();
  const routes: MapRoute[] = [];

  const itemsByDay = new Map<number, MapItemRow[]>();
  for (const item of items) {
    if (!item.place_id || !known.has(item.place_id)) continue;
    const day = itemsByDay.get(item.day_index) ?? [];
    day.push(item);
    itemsByDay.set(item.day_index, day);
  }

  for (const [dayIndex, dayItems] of itemsByDay) {
    const ordered = [...dayItems].sort((a, b) =>
      a.position !== b.position
        ? a.position - b.position
        : a.created_at.localeCompare(b.created_at),
    );

    // A place used twice in one day is one stop as far as the map is concerned,
    // but the day still lists it once, in the order it was first reached.
    const placeIds: string[] = [];
    for (const item of ordered) {
      const placeId = item.place_id;
      if (!placeId || placeIds.includes(placeId)) continue;
      placeIds.push(placeId);

      const days = daysByPlace.get(placeId) ?? new Set<number>();
      days.add(dayIndex);
      daysByPlace.set(placeId, days);
    }
    if (placeIds.length > 0) routes.push({ dayIndex, placeIds });
  }

  routes.sort((a, b) => a.dayIndex - b.dayIndex);

  const payloadPlaces: MapPlace[] = places
    .map((place) => ({
      id: place.id,
      name: place.name,
      lat: Number(place.lat),
      lng: Number(place.lng),
      category: place.category,
      locationType: place.location_type,
      status: place.status,
      proposedBy: place.proposed_by ?? null,
      votes: tallyVotes(place.place_votes ?? []),
      days: [...(daysByPlace.get(place.id) ?? new Set<number>())].sort(
        (a, b) => a - b,
      ),
    }))
    // Sorted by name so the payload is stable between polls; without this an
    // unordered select would reshuffle pins every 5s.
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    places: payloadPlaces,
    routes,
    // Name order, not creation order, because these are labels on a ballot and
    // an avatar list that reorders every 5s reads as a glitch.
    members: [...input.members]
      .map((member) => ({ id: member.id, displayName: member.display_name }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName)),
  };
}

/**
 * Ballot order: best score first, then the most ups (a place three people love
 * beats a place two people love and one grumbles at), then name so a tie never
 * jitters between polls.
 */
export function sortBallot(places: MapPlace[]): MapPlace[] {
  return [...places].sort((a, b) => {
    if (a.votes.score !== b.votes.score) return b.votes.score - a.votes.score;
    if (a.votes.up !== b.votes.up) return b.votes.up - a.votes.up;
    return a.name.localeCompare(b.name);
  });
}

export function nameOf(members: MapMember[], memberId: string | null): string | null {
  if (!memberId) return null;
  return members.find((member) => member.id === memberId)?.displayName ?? null;
}

/** The viewer's own vote, or null when they have not weighed in yet. */
export function myVoteFor(place: MapPlace, memberId: string): VoteValue | null {
  return (
    place.votes.byMember.find((vote) => vote.memberId === memberId)?.value ?? null
  );
}

/** Everyone who voted, in the order a person reads: name A to Z, downs last. */
export function votersInNameOrder(
  place: MapPlace,
  members: MapMember[],
): { memberId: string; name: string; value: VoteValue }[] {
  return place.votes.byMember
    .map((vote) => ({
      memberId: vote.memberId,
      name: nameOf(members, vote.memberId) ?? "Someone",
      value: vote.value,
    }))
    .sort(
      (a, b) =>
        a.value !== b.value
          ? b.value - a.value
          : a.name.localeCompare(b.name),
    );
}

/** Every vote cast on this trip, for the "19 votes cast" footer line. */
export function totalVotesCast(payload: MapPayload): number {
  return payload.places.reduce((total, place) => total + place.votes.byMember.length, 0);
}

/**
 * The SWR key the map board polls. Filter form so a form anywhere in the map can
 * say "re-read the pins" without every component having to be handed the trip id.
 */
export function isPlacesKey(key: unknown): boolean {
  return (
    typeof key === "string" &&
    key.startsWith("/api/trips/") &&
    key.endsWith("/places")
  );
}

export function routeForDay(
  payload: MapPayload,
  dayIndex: number | "all",
): MapRoute | null {
  if (dayIndex === "all") return null;
  return payload.routes.find((route) => route.dayIndex === dayIndex) ?? null;
}

/** "1, 2, 3" visit order for the pins of a single day. */
export function visitOrder(route: MapRoute | null): Map<string, number> {
  const order = new Map<string, number>();
  if (!route) return order;
  route.placeIds.forEach((placeId, index) => order.set(placeId, index + 1));
  return order;
}

export function distanceKm(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Total distance of a day, rounded for the "about 18 km" line. */
export function routeDistanceKm(
  route: MapRoute | null,
  places: MapPlace[],
): number | null {
  if (!route || route.placeIds.length < 2) return null;
  const byId = new Map(places.map((place) => [place.id, place]));
  let total = 0;
  for (let index = 1; index < route.placeIds.length; index += 1) {
    const from = byId.get(route.placeIds[index - 1]);
    const to = byId.get(route.placeIds[index]);
    if (!from || !to) continue;
    total += distanceKm(from, to);
  }
  return Math.round(total);
}

/**
 * Nominatim has no idea TripCancil has vibes, so a search hit arrives as words
 * like "beach" or "fortress" and has to become one of the eight. Order matters:
 * a fort is heritage before it is ever mountain, and a highway through a valley
 * is a road trip.
 */
const TYPE_HINTS: ReadonlyArray<readonly [RegExp, LocationType]> = [
  [
    /heritage|fort|monument|museum|temple|palace|church|cathedral|archaeol|fortress|shrine/iu,
    "heritage",
  ],
  [/beach|coast|sea|ocean|bay|shore|island|lagoon/iu, "beach"],
  [/snow|glacier|summit/iu, "snow"],
  [/mountain|hill|peak|trek|ridge|ghat|pass|valley/iu, "mountain"],
  [/forest|woods|woodland|jungle|garden|reserve/iu, "forest"],
  [/desert|dune|sand/iu, "desert"],
  [/highway|motorway|expressway|road.?trip/iu, "roadtrip"],
];

export function guessLocationType(
  ...words: (string | null | undefined)[]
): LocationType {
  const haystack = words.filter(Boolean).join(" ");
  for (const [pattern, type] of TYPE_HINTS) {
    if (pattern.test(haystack)) return type;
  }
  return "city";
}