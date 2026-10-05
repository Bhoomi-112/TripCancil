import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { ChevronDownIcon } from "./icons";

export function Label({
  className,
  ...props
}: ComponentProps<"label">) {
  return (
    <label
      className={cn(
        "font-display text-[9px] uppercase tracking-tight text-ink-soft",
        className,
      )}
      {...props}
    />
  );
}

const fieldShell =
  "w-full rounded-2xl border-2 border-silver-deep bg-white/85 px-3.5 py-2.5 text-base font-bold text-ink shadow-[inset_0_2px_4px_rgb(37_26_66/0.08)] transition-[border-color,box-shadow] duration-150 placeholder:font-semibold placeholder:text-ink-soft/60 focus:border-electric focus:shadow-[0_0_0_4px_rgb(47_73_255/0.18),inset_0_2px_4px_rgb(37_26_66/0.08)] disabled:cursor-not-allowed disabled:opacity-55";

export function Input({
  className,
  invalid,
  ...props
}: { invalid?: boolean; className?: string } & Omit<
  ComponentProps<"input">,
  "className"
>) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cn(
        fieldShell,
        invalid && "border-hotpink focus:border-hotpink focus:shadow-[0_0_0_4px_rgb(255_61_154/0.2)]",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({
  className,
  invalid,
  ...props
}: { invalid?: boolean; className?: string } & Omit<
  ComponentProps<"textarea">,
  "className"
>) {
  return (
    <textarea
      aria-invalid={invalid || undefined}
      className={cn(
        fieldShell,
        "min-h-24 resize-y leading-snug",
        invalid && "border-hotpink focus:border-hotpink",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Native select, styled to match `Input`. A styled listbox would need its own
 * focus trap and keyboard handling for a field the whole group uses to pick a
 * day, so the platform one wins.
 */
export function Select({
  className,
  invalid,
  children,
  ...props
}: { invalid?: boolean; className?: string } & Omit<
  ComponentProps<"select">,
  "className"
>) {
  return (
    <div className="relative">
      <select
        aria-invalid={invalid || undefined}
        className={cn(
          fieldShell,
          "appearance-none pr-10",
          invalid && "border-hotpink focus:border-hotpink",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-soft" />
    </div>
  );
}

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  className,
}: {
  label: string;
  hint?: string;
  error?: string;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p className="text-xs font-extrabold text-hotpink-deep">{error}</p>
      ) : hint ? (
        <p className="text-xs font-semibold text-ink-soft">{hint}</p>
      ) : null}
    </div>
  );
}
