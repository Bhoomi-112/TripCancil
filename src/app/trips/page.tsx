import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { ButtonLink, buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { MapIcon, PlusIcon, SparkleIcon } from "@/components/ui/icons";
import { ToastProvider } from "@/components/ui/toast";
import { Window } from "@/components/ui/window";
import { todayUtcISO } from "@/lib/constants";
import { listTravellerTrips, type TravellerTrip } from "@/lib/traveller/service";
import { readTraveller } from "@/lib/traveller/session";
import { forgetDeviceAction } from "./actions";
import { TripRow } from "./trip-row";

export const metadata: Metadata = {
  title: "My trips",
};

function TripList({ trips }: { trips: TravellerTrip[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {trips.map((trip) => (
        <TripRow key={trip.tripId} trip={trip} />
      ))}
    </ul>
  );
}

/**
 * The landing page for a device that has proved itself once. It deliberately sits
 * outside the trip shell: this screen is about which trip to open next, so it
 * cannot require a trip to already be open.
 */
export default async function TripsPage() {
  const travellerId = await readTraveller();
  if (!travellerId) redirect("/");

  const trips = await listTravellerTrips(travellerId, todayUtcISO());
  const live = trips.filter((trip) => !trip.ended);
  const past = trips.filter((trip) => trip.ended);

  return (
    <ToastProvider>
      <div className="dotted-grid mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-4 px-4 py-8">
        <header className="flex flex-col items-center gap-3 text-center">
          <Badge tone="pop" sticker>
            Trusted device
          </Badge>
          <h1 className="font-display text-2xl uppercase leading-8 tracking-tight text-ink sm:text-3xl">
            My <span className="chrome-text">trips</span>
          </h1>
          <p className="max-w-md text-sm font-bold text-ink-soft">
            Every trip this device has signed into, newest first. One tap opens a
            trip; no PIN needed again.
          </p>
          <div className="flex flex-col items-center gap-2 sm:flex-row">
            <ButtonLink href="/join" variant="primary" size="md" sparkle>
              <PlusIcon className="size-4" />
              Add a trip
            </ButtonLink>
            <ButtonLink href="/new" variant="accent" size="md">
              Start a trip
            </ButtonLink>
          </div>
        </header>

        {trips.length === 0 ? (
          <Window title="my-trips.exe" icon={<MapIcon className="size-4 text-electric" />}>
            <EmptyState
              illustration="map"
              title="No trips on this device yet"
              description="Join a friend's trip with their invite code, or start one of your own. Both remember it here."
            />
          </Window>
        ) : (
          <>
            <Window
              title={`now and next (${live.length})`}
              icon={<SparkleIcon className="size-4 animate-twinkle text-hotpink" />}
              tone="cream"
            >
              {live.length === 0 ? (
                <p className="text-sm font-bold text-ink-soft">
                  Nothing coming up. Jump back to a past trip below.
                </p>
              ) : (
                <TripList trips={live} />
              )}
            </Window>

            {past.length > 0 && (
              <Window
                title={`past trips (${past.length})`}
                icon={<MapIcon className="size-4 text-ink-soft" />}
                tone="chrome"
                footer={
                  <p className="text-xs font-semibold text-ink-soft">
                    Past trips open read-only: you can look, but the plan and the
                    money stay as you left them.
                  </p>
                }
              >
                <TripList trips={past} />
              </Window>
            )}
          </>
        )}

        <footer className="mt-auto flex flex-col items-center gap-2 pt-2 text-center">
          <p className="text-xs font-semibold text-ink-soft">
            This device is trusted for all of these trips. On a shared or borrowed
            device, sign it out.
          </p>
          <form action={forgetDeviceAction}>
            <button
              type="submit"
              className={buttonClass({ variant: "ghost", size: "sm" })}
            >
              Forget this device
            </button>
          </form>
        </footer>
      </div>
    </ToastProvider>
  );
}