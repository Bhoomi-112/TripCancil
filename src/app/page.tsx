import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { SparkleIcon, StarIcon } from "@/components/ui/icons";
import { AvatarStack } from "@/components/ui/avatar";

const perks = [
  ["Plan it", "Day-by-day itinerary with live edits from everyone"],
  ["Split it", "Budget, expenses, balances and settle-up with QR codes"],
  ["Shoot it", "Themed photobooth strips made in the browser"],
  ["Relive it", "Album plus a scrollable year-in-review recap"],
];

export default function Home() {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-4 py-12">
      {Array.from({ length: 12 }, (_, index) => (
        <StarIcon
          key={index}
          className="absolute size-5 animate-twinkle text-hotpink/70"
          style={{
            left: `${(index * 13) % 94}%`,
            top: `${(index * 19) % 88}%`,
            animationDelay: `${index * 0.3}s`,
          }}
        />
      ))}

      <main className="relative z-10 w-full max-w-2xl text-center">
        <Badge tone="pop" sticker>
          Retro Y2K trip OS
        </Badge>

        <h1 className="mt-5 font-display text-3xl uppercase leading-10 tracking-tight text-ink sm:text-5xl sm:leading-14">
          Plan it.
          <br />
          <span className="chrome-text">Split it.</span>
          <br />
          Shoot it.
        </h1>

        <p className="mx-auto mt-5 max-w-md text-base font-bold text-ink-soft sm:text-lg">
          One shared space for your friend group&apos;s trip: itinerary, map, money,
          photobooth memories and a recap worth scrolling.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <ButtonLink href="/join" variant="primary" size="lg" sparkle>
            Join with a code
          </ButtonLink>
          <ButtonLink href="/new" variant="accent" size="lg">
            Start a trip
          </ButtonLink>
          <ButtonLink href="/design" variant="chrome" size="lg">
            Review the look
          </ButtonLink>
        </div>

        <ul className="mt-10 grid gap-2 text-left sm:grid-cols-2">
          {perks.map(([title, copy]) => (
            <li
              key={title}
              className="gloss rounded-2xl border-2 border-silver-deep bg-white/70 px-3.5 py-2.5 shadow-bubble"
            >
              <p className="font-display text-[10px] uppercase tracking-tight text-electric-deep">
                {title}
              </p>
              <p className="text-sm font-semibold text-ink-soft">{copy}</p>
            </li>
          ))}
        </ul>

        <div className="mt-8 flex justify-center">
          <AvatarStack names={["Bhoomi", "Ravi", "Sana", "Dev", "Ila", "Nikhil"]} size="md" />
        </div>

        <p className="mt-6 flex items-center justify-center gap-1.5 text-xs font-bold text-ink-soft">
          <SparkleIcon className="size-3.5 animate-twinkle text-electric" />
          No email, no password: an invite code, a display name and a 6-digit PIN
        </p>
      </main>
    </div>
  );
}
