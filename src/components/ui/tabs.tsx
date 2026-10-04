"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export type TabItem = {
  value: string;
  label: string;
  icon?: ReactNode;
  badge?: ReactNode;
};

type TabsProps = {
  items: TabItem[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  size?: "sm" | "md";
  block?: boolean;
  className?: string;
};

export function Tabs({
  items,
  value,
  defaultValue,
  onValueChange,
  size = "md",
  block = false,
  className,
}: TabsProps) {
  const [internal, setInternal] = useState(defaultValue ?? items[0]?.value);
  const active = value ?? internal;

  const pick = (next: string) => {
    if (value === undefined) setInternal(next);
    onValueChange?.(next);
  };

  return (
    <div
      role="tablist"
      className={cn(
        "flex flex-wrap items-center gap-1 rounded-bubble border-2 border-silver-deep bg-linear-to-b from-white/80 to-silver/60 p-1 shadow-[inset_0_2px_4px_rgb(37_26_66/0.06)]",
        block && "w-full",
        className,
      )}
    >
      {items.map((item) => {
        const selected = item.value === active;
        return (
          <button
            key={item.value}
            role="tab"
            type="button"
            aria-selected={selected}
            onClick={() => pick(item.value)}
            className={cn(
              "gloss flex flex-1 items-center justify-center gap-1.5 rounded-bubble border-2 font-display uppercase tracking-tight transition-[transform,background-color,color,box-shadow] duration-150",
              size === "sm" ? "px-3 py-1.5 text-[9px]" : "px-4 py-2 text-[10px]",
              selected
                ? "animate-pop border-electric-deep bg-electric text-white shadow-bubble"
                : "border-transparent text-ink-soft hover:border-silver-mid hover:text-electric-deep",
            )}
          >
            {item.icon}
            <span className="truncate">{item.label}</span>
            {item.badge}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({
  when,
  active,
  children,
  className,
}: {
  when: string;
  active: string;
  children: ReactNode;
  className?: string;
}) {
  if (when !== active) return null;
  return (
    <div role="tabpanel" className={cn("animate-slide-up", className)}>
      {children}
    </div>
  );
}
