import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { SparkleIcon } from "./icons";

type Variant = "primary" | "accent" | "pop" | "chrome" | "ghost" | "danger";
type Size = "sm" | "md" | "lg" | "icon";

const base =
  "gloss relative inline-flex select-none items-center justify-center gap-2 rounded-bubble border-2 font-extrabold uppercase tracking-wide transition-[transform,box-shadow,filter] duration-150 ease-out active:translate-y-[3px] active:shadow-none disabled:pointer-events-none disabled:opacity-45 disabled:active:translate-y-0";

const variants: Record<Variant, string> = {
  primary:
    "border-electric-deep bg-electric text-white shadow-bubble hover:brightness-110 hover:shadow-bubble-lg",
  accent:
    "border-hotpink-deep bg-hotpink text-white shadow-bubble hover:brightness-110 hover:shadow-bubble-lg",
  pop: "border-lime-deep bg-lime text-ink shadow-bubble hover:brightness-105 hover:shadow-bubble-lg",
  chrome:
    "border-silver-deep bg-linear-to-b from-white to-silver-mid text-ink shadow-bubble hover:brightness-[1.03] hover:shadow-bubble-lg",
  ghost:
    "border-silver-mid bg-white/70 text-ink shadow-bubble hover:border-electric hover:text-electric-deep",
  danger:
    "border-hotpink-deep bg-hotpink-deep text-white shadow-bubble hover:brightness-110 hover:shadow-bubble-lg",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3.5 text-xs",
  md: "h-11 px-5 text-sm",
  lg: "h-14 px-7 text-base",
  icon: "size-11 p-0",
};

function spinner() {
  return (
    <span
      className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
      aria-hidden="true"
    />
  );
}

export function buttonClass({
  variant = "primary",
  size = "md",
  block = false,
  className,
}: {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  className?: string;
} = {}) {
  return cn(base, variants[variant], sizes[size], block && "w-full", className);
}

type ButtonProps = {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  loading?: boolean;
  sparkle?: boolean;
  className?: string;
} & Omit<ComponentProps<"button">, "className">;

export function Button({
  variant = "primary",
  size = "md",
  block = false,
  loading = false,
  sparkle = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={buttonClass({ variant, size, block, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        spinner()
      ) : (
        sparkle && (
          <SparkleIcon className="size-4 animate-twinkle" />
        )
      )}
      {children}
    </button>
  );
}

type ButtonLinkProps = {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  sparkle?: boolean;
  className?: string;
} & Omit<ComponentProps<typeof Link>, "className">;

export function ButtonLink({
  variant = "primary",
  size = "md",
  block = false,
  sparkle = false,
  className,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      className={buttonClass({ variant, size, block, className })}
      {...props}
    >
      {sparkle && <SparkleIcon className="size-4 animate-twinkle" />}
      {children}
    </Link>
  );
}

export function IconButton({
  variant = "ghost",
  size = "icon",
  label,
  className,
  children,
  ...props
}: {
  variant?: Variant;
  size?: Size;
  label: string;
  className?: string;
  children: ReactNode;
} & Omit<ComponentProps<"button">, "className" | "aria-label">) {
  return (
    <button
      className={buttonClass({ variant, size, className })}
      aria-label={label}
      title={label}
      {...props}
    >
      {children}
    </button>
  );
}
