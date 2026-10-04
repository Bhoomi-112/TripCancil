import type { Metadata } from "next";
import { NewTripForm } from "./new-trip-form";

export const metadata: Metadata = {
  title: "Start a trip",
};

export default function NewTripPage() {
  return (
    <div className="flex flex-col gap-4">
      <header className="px-1 text-center">
        <h1 className="chrome-text font-display text-lg uppercase leading-7">
          Start a trip
        </h1>
        <p className="mt-2 text-sm font-semibold text-ink-soft">
          We mint a 12-character invite code you can share with the group.
        </p>
      </header>
      <NewTripForm />
    </div>
  );
}
