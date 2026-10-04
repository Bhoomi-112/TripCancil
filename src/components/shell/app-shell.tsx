"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { SparkleIcon } from "@/components/ui/icons";
import { logoutAction } from "@/app/(app)/actions";
import { isActive, navItems } from "./nav";

function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/plan" className="group flex items-center gap-2">
      <span className="gloss grid size-9 place-items-center rounded-2xl border-2 border-electric-deep bg-electric text-white shadow-bubble transition-transform group-active:translate-y-[2px]">
        <SparkleIcon className="size-5 animate-twinkle" />
      </span>
      {!compact && (
        <span className="font-display text-sm uppercase leading-5 tracking-tight chrome-text">
          Trip
          <br />
          Cancil
        </span>
      )}
    </Link>
  );
}

function NavLink({
  href,
  label,
  Icon,
  hint,
  active,
}: {
  href: string;
  label: string;
  Icon: (props: { className?: string }) => ReactNode;
  hint: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "gloss group flex items-center gap-3 rounded-2xl border-2 px-3 py-2.5 transition-[transform,background-color,color,box-shadow] duration-150 active:translate-y-[2px]",
        active
          ? "border-electric-deep bg-electric text-white shadow-bubble"
          : "border-transparent text-ink-soft hover:border-silver-mid hover:bg-white/70 hover:text-electric-deep",
      )}
    >
      <Icon
        className={cn(
          "size-5 shrink-0",
          active ? "text-lime" : "text-ink-soft group-hover:text-electric",
        )}
      />
      <span className="min-w-0 flex-1">
        <span className="block font-display text-[10px] uppercase tracking-tight">
          {label}
        </span>
        <span
          className={cn(
            "block truncate text-[11px] font-semibold",
            active ? "text-white/80" : "text-ink-soft/80",
          )}
        >
          {hint}
        </span>
      </span>
    </Link>
  );
}

export function AppShell({
  children,
  displayName,
  tripName,
}: {
  children: ReactNode;
  displayName: string;
  tripName: string;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-dvh md:pl-64">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col gap-4 border-r-2 border-silver-mid bg-white/55 p-4 backdrop-blur-sm md:flex">
        <Wordmark />
        <nav className="flex flex-col gap-1.5">
          {navItems.map((item) => (
            <NavLink
              key={item.href}
              {...item}
              active={isActive(pathname, item.href)}
            />
          ))}
        </nav>
        <div className="dotted-grid mt-auto flex flex-col gap-2 rounded-2xl border-2 border-dashed border-silver-deep/70 bg-cream/70 p-3">
          <p className="truncate font-display text-[9px] uppercase leading-4 tracking-tight text-ink">
            {tripName}
          </p>
          <p className="truncate text-xs font-bold text-ink-soft">
            Signed in as <span className="text-ink">{displayName}</span>
          </p>
          <form action={logoutAction}>
            <button
              type="submit"
              className="w-full rounded-bubble border-2 border-silver-deep bg-white/80 px-3 py-1.5 font-display text-[9px] uppercase tracking-tight text-ink-soft transition-transform active:translate-y-[2px] hover:text-hotpink-deep"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <header className="sticky top-0 z-20 flex items-center justify-between border-b-2 border-silver-mid bg-cream/85 px-4 py-2.5 backdrop-blur-sm md:hidden">
        <Wordmark compact />
        <span className="font-display text-[10px] uppercase tracking-tight text-ink-soft">
          {navItems.find((item) => isActive(pathname, item.href))?.label ?? "Trip"}
        </span>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 pt-4 pb-28 md:px-8 md:pt-8 md:pb-16">
        {children}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-silver-mid bg-white/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden">
        <ul className="flex items-stretch justify-between gap-0.5 px-1.5 py-1.5">
          {navItems.map(({ href, label, Icon }) => {
            const active = isActive(pathname, href);
            return (
              <li key={href} className="flex-1">
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex flex-col items-center gap-0.5 rounded-2xl border-2 px-1 py-1.5 transition-[transform,background-color] duration-150 active:translate-y-[2px]",
                    active
                      ? "gloss border-electric-deep bg-electric text-white shadow-bubble"
                      : "border-transparent text-ink-soft",
                  )}
                >
                  <Icon
                    className={cn(
                      "size-5",
                      active && "text-lime animate-pop",
                    )}
                  />
                  <span className="font-display text-[8px] uppercase tracking-tight">
                    {label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
