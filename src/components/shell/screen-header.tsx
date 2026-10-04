import type { ReactNode } from "react";

export function ScreenHeader({
  title,
  subtitle,
  badge,
  actions,
}: {
  title: string;
  subtitle?: string;
  badge?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="flex items-center gap-2 font-display text-lg uppercase leading-7 tracking-tight text-ink">
          {title}
          {badge && (
            <span className="gloss rounded-full border-2 border-lime-deep bg-lime px-2 py-0.5 text-[9px] text-ink">
              {badge}
            </span>
          )}
        </h1>
        {subtitle && (
          <p className="text-sm font-semibold text-ink-soft">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
