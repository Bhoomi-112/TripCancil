import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "pop" | "bubble" | "grape" | "chrome" | "ink" | "sunny";

const tones: Record<Tone, string> = {
  pop: "border-lime-deep bg-lime text-ink",
  bubble: "border-hotpink-deep bg-hotpink text-white",
  grape: "border-grape bg-grape text-white",
  chrome: "border-silver-deep bg-linear-to-b from-white to-silver-mid text-ink",
  ink: "border-ink bg-ink text-cream",
  sunny: "border-[#b57a00] bg-sunny text-ink",
};

export function Badge({
  tone = "pop",
  sticker = false,
  icon,
  className,
  children,
  ...props
}: {
  tone?: Tone;
  sticker?: boolean;
  icon?: ReactNode;
  className?: string;
} & Omit<ComponentProps<"span">, "className">) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 border-2 font-display text-[9px] uppercase leading-4 tracking-tight",
        tones[tone],
        sticker
          ? "-rotate-2 rounded-sticker px-2.5 py-1 shadow-sticker ring-2 ring-white/70"
          : "rounded-full px-2.5 py-0.5",
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </span>
  );
}
