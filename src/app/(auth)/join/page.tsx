import type { Metadata } from "next";
import { JoinForm } from "./join-form";

export const metadata: Metadata = {
  title: "Join a trip",
};

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;

  return (
    <div className="flex flex-col gap-4">
      <header className="px-1 text-center">
        <h1 className="chrome-text font-display text-lg uppercase leading-7">
          Join a trip
        </h1>
        <p className="mt-2 text-sm font-semibold text-ink-soft">
          One invite code, one display name, one PIN. That is the whole login.
        </p>
      </header>
      <JoinForm defaultCode={code?.toUpperCase()} />
    </div>
  );
}
