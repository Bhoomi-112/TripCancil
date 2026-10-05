"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useSWRConfig } from "swr";
import { LOCATION_TYPES, LOCATION_TYPE_LABELS } from "@/lib/constants";
import type { LocationType } from "@/lib/db/types";
import { idleState } from "@/lib/actions/state";
import type { TripDay } from "@/lib/itinerary/days";
import type { NominatimResult } from "@/lib/maps/nominatim";
import { guessLocationType, isPlacesKey } from "@/lib/maps/places";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { Window } from "@/components/ui/window";
import {
  addSearchResultToDayAction,
  proposePlaceAction,
  searchPlacesAction,
} from "./actions";

type Props = {
  days: TripDay[];
  /** "all" means no day chip is picked, so "add to day" has to say which. */
  day: number | "all";
  editable: boolean;
};

export function PlaceSearch({ days, day, editable }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NominatimResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const toast = useToast();

  async function search() {
    const q = query.trim();
    if (q.length < 2) {
      setProblem("Type at least two letters.");
      return;
    }
    setSearching(true);
    setProblem(null);
    // Goes through a server action, so the browser never talks to Nominatim and
    // the one-request-per-second politeness stays in the server module.
    const state = await searchPlacesAction(q);
    setSearching(false);
    if (state.error) {
      setProblem(state.error);
      return;
    }
    const hits = (state.payload as NominatimResult[] | undefined) ?? [];
    setResults(hits);
    if (hits.length === 0) setProblem("Nothing found. Try a wider search.");
  }

  return (
    <Window
      title="Find a place"
      icon={<span aria-hidden="true">🔍</span>}
      bodyClassName="flex flex-col gap-3"
    >
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void search();
        }}
      >
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Alibaug, Sinhagad, Matheran…"
          aria-label="Search for a place"
          invalid={Boolean(problem)}
        />
        <Button type="submit" loading={searching} className="shrink-0">
          Search
        </Button>
      </form>

      {problem ? (
        <p className="text-xs font-extrabold text-hotpink-deep">{problem}</p>
      ) : null}

      <p className="text-[11px] leading-snug text-ink-soft">
        {editable
          ? "Searches OpenStreetMap. Propose a pin for the group to agree on, or drop it straight into a day."
          : "This trip is over, so the map is read-only now. Pins and visit order are still all here."}
      </p>

      {results?.map((result) => (
        <SearchResult
          key={`${result.osm_type}-${result.osm_id}-${result.place_id}`}
          result={result}
          days={days}
          day={day}
          editable={editable}
          onDone={toast.success}
        />
      ))}
    </Window>
  );
}

type ResultProps = {
  result: NominatimResult;
  days: TripDay[];
  day: number | "all";
  editable: boolean;
  onDone: (message: string) => void;
};

function SearchResult({ result, days, day, editable, onDone }: ResultProps) {
  const [proposeState, propose, proposing] = useActionState(
    proposePlaceAction,
    idleState,
  );
  const [addState, add, adding] = useActionState(
    addSearchResultToDayAction,
    idleState,
  );
  const { mutate } = useSWRConfig();
  const [type, setType] = useState<LocationType>(() =>
    guessLocationType(
      result.name,
      result.display_name,
      result.type,
      result.class,
    ),
  );
  const announced = useRef<string | null>(null);
  const name = result.name?.trim() || result.display_name.split(",")[0];
  const busy = proposing || adding;

  // One announcement per outcome, even though a re-render replays the effect.
  function announce(state: typeof proposeState, message: string) {
    if (!state.ok || announced.current === message) return;
    announced.current = message;
    onDone(message);
    void mutate(isPlacesKey);
  }

  useEffect(() => {
    announce(proposeState, `${name} is on the map as a candidate.`);
  });

  useEffect(() => {
    const where = day === "all" ? "Day 1" : (days[day]?.label ?? "the plan");
    announce(addState, `${name} is on ${where}.`);
  });

  return (
    <div className="rounded-2xl border-2 border-silver-deep bg-white/80 p-2.5">
      <p className="text-sm leading-snug font-extrabold text-ink">{name}</p>
      <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-ink-soft">
        {result.display_name}
      </p>

      {editable ? (
        <div className="mt-2 flex flex-col gap-2">
          <form action={propose} className="flex items-end gap-1.5">
            <input type="hidden" name="name" value={name} />
            <input type="hidden" name="lat" value={result.lat} />
            <input type="hidden" name="lng" value={result.lon} />
            <input type="hidden" name="category" value={result.type ?? ""} />
            <label className="flex-1">
              <span className="sr-only">Vibe for {name}</span>
              <Select
                name="locationType"
                value={type}
                onChange={(event) => setType(event.target.value as LocationType)}
                className="h-9 py-0 text-xs"
              >
                {LOCATION_TYPES.map((value) => (
                  <option key={value} value={value}>
                    {LOCATION_TYPE_LABELS[value]}
                  </option>
                ))}
              </Select>
            </label>
            <Button
              type="submit"
              variant="chrome"
              size="sm"
              loading={proposing}
              disabled={busy}
              className="shrink-0"
            >
              Propose
            </Button>
          </form>

          <form action={add}>
            <input type="hidden" name="name" value={name} />
            <input type="hidden" name="lat" value={result.lat} />
            <input type="hidden" name="lng" value={result.lon} />
            <input type="hidden" name="category" value={result.type ?? ""} />
            <input type="hidden" name="dayIndex" value={day === "all" ? 0 : day} />
            <Button
              type="submit"
              variant="pop"
              size="sm"
              loading={adding}
              disabled={busy}
              block
            >
              {day === "all"
                ? "Add to Day 1"
                : `Add to ${days[day]?.label ?? "the plan"}`}
            </Button>
          </form>

          {day === "all" ? (
            <p className="text-[11px] font-semibold text-ink-soft">
              Pick a day chip above and it lands there instead.
            </p>
          ) : null}
        </div>
      ) : (
        <p className="mt-2 font-display text-[9px] uppercase tracking-tight text-ink-soft">
          Trip is over
        </p>
      )}

      {proposeState.error || addState.error ? (
        <p className="mt-1.5 text-xs font-extrabold text-hotpink-deep">
          {proposeState.error ?? addState.error}
        </p>
      ) : null}
    </div>
  );
}