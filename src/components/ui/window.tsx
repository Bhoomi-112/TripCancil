import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "cream" | "chrome" | "ink";

const frames: Record<Tone, string> = {
  cream: "bg-linear-to-b from-white via-silver to-silver-mid",
  chrome: "bg-linear-to-b from-white via-silver to-silver-deep",
  ink: "bg-linear-to-b from-silver-mid via-silver-deep to-ink",
};

const bodies: Record<Tone, string> = {
  cream: "bg-cream text-ink",
  chrome: "bg-white/70 text-ink",
  ink: "bg-ink text-cream",
};

const titles: Record<Tone, string> = {
  cream: "text-ink",
  chrome: "text-ink",
  ink: "text-cream",
};

export function WindowDots({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-1.5", className)}>
      <span className="size-2.5 rounded-full border border-ink/25 bg-hotpink shadow-[inset_0_1px_0_rgb(255_255_255/0.7)]" />
      <span className="size-2.5 rounded-full border border-ink/25 bg-sunny shadow-[inset_0_1px_0_rgb(255_255_255/0.7)]" />
      <span className="size-2.5 rounded-full border border-ink/25 bg-lime shadow-[inset_0_1px_0_rgb(255_255_255/0.7)]" />
    </span>
  );
}

type WindowProps = {
  title?: string;
  icon?: ReactNode;
  tone?: Tone;
  actions?: ReactNode;
  footer?: ReactNode;
  className?: string;
  bodyClassName?: string;
} & Omit<ComponentProps<"section">, "title" | "className">;

export function Window({
  title,
  icon,
  tone = "cream",
  actions,
  footer,
  className,
  bodyClassName,
  children,
  ...props
}: WindowProps) {
  return (
    <section
      className={cn(
        "rounded-window p-[3px] shadow-window ring-1 ring-ink/10",
        frames[tone],
        className,
      )}
      {...props}
    >
      {title && (
        <header className="flex items-center gap-2 rounded-t-[1.1rem] border-b-2 border-ink/10 bg-linear-to-b from-white/85 to-silver/70 px-3 py-2">
          <WindowDots />
          {icon}
          <h2
            className={cn(
              "min-w-0 flex-1 truncate font-display text-[10px] uppercase leading-4 tracking-tight",
              titles[tone],
            )}
          >
            {title}
          </h2>
          {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
        </header>
      )}
      <div className={cn("rounded-[1.1rem] p-4", bodies[tone], bodyClassName)}>
        {children}
      </div>
      {footer && (
        <div className="rounded-b-[1.1rem] border-t-2 border-ink/10 bg-white/40 px-4 py-3">
          {footer}
        </div>
      )}
    </section>
  );
}
