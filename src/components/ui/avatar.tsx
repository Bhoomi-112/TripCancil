import { cn } from "@/lib/cn";

type Size = "xs" | "sm" | "md" | "lg" | "xl";

const sizes: Record<Size, string> = {
  xs: "size-6 text-[9px]",
  sm: "size-8 text-[10px]",
  md: "size-11 text-xs",
  lg: "size-14 text-sm",
  xl: "size-20 text-lg",
};

const skins = [
  "bg-electric text-white border-electric-deep",
  "bg-hotpink text-white border-hotpink-deep",
  "bg-grape text-white border-grape",
  "bg-lime text-ink border-lime-deep",
  "bg-sunny text-ink border-[#b57a00]",
  "bg-cyan text-ink border-[#0d8ba3]",
  "bg-silver text-ink border-silver-deep",
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function skinFor(name: string) {
  let total = 0;
  for (const char of name) total += char.codePointAt(0) ?? 0;
  return skins[total % skins.length];
}

export function Avatar({
  name,
  size = "md",
  online = false,
  className,
}: {
  name: string;
  size?: Size;
  online?: boolean;
  className?: string;
}) {
  return (
    <span
      title={name}
      className={cn(
        "gloss relative inline-flex shrink-0 items-center justify-center rounded-full border-2 font-display shadow-bubble select-none",
        sizes[size],
        skinFor(name),
        className,
      )}
    >
      {initials(name)}
      {online && (
        <span className="absolute -right-0.5 -bottom-0.5 size-3 rounded-full border-2 border-white bg-lime-deep" />
      )}
    </span>
  );
}

export function AvatarStack({
  names,
  max = 5,
  size = "sm",
}: {
  names: string[];
  max?: number;
  size?: Size;
}) {
  const shown = names.slice(0, max);
  const extra = names.length - shown.length;
  return (
    <div className="flex items-center -space-x-2">
      {shown.map((name) => (
        <Avatar key={name} name={name} size={size} className="ring-2 ring-white" />
      ))}
      {extra > 0 && (
        <span
          className={cn(
            "gloss inline-flex items-center justify-center rounded-full border-2 border-ink bg-ink font-display text-cream ring-2 ring-white",
            sizes[size],
          )}
        >
          +{extra}
        </span>
      )}
    </div>
  );
}
