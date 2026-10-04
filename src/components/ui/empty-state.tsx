import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Art = "beach" | "map" | "camera" | "coins" | "suitcase" | "cloud";

function PixelSun() {
  return (
    <>
      <rect x="20" y="6" width="24" height="4" fill="#ff3d9a" />
      <rect x="14" y="10" width="36" height="4" fill="#ff3d9a" />
      <rect x="10" y="14" width="44" height="18" fill="#ff3d9a" />
      <rect x="14" y="32" width="36" height="4" fill="#ff3d9a" />
      <rect x="20" y="36" width="24" height="4" fill="#ff3d9a" />
      <rect x="20" y="20" width="24" height="6" fill="#ffc53d" />
    </>
  );
}

function PixelWave({ y = 46, color = "#3ee0ff" }: { y?: number; color?: string }) {
  return (
    <>
      <rect x="4" y={y} width="56" height="4" fill={color} />
      <rect x="10" y={y + 4} width="14" height="4" fill={color} />
      <rect x="32" y={y + 4} width="14" height="4" fill={color} />
      <rect x="16" y={y + 8} width="30" height="4" fill="#2f49ff" />
    </>
  );
}

function PixelCamera() {
  return (
    <>
      <rect x="20" y="8" width="24" height="6" fill="#2f49ff" />
      <rect x="8" y="14" width="48" height="36" fill="#251a42" />
      <rect x="8" y="14" width="48" height="4" fill="#5d4c85" />
      <rect x="12" y="22" width="10" height="6" fill="#ccff3d" />
      <rect x="34" y="20" width="18" height="4" fill="#e4eaf4" />
      <rect x="22" y="24" width="20" height="20" fill="#e4eaf4" />
      <rect x="26" y="28" width="12" height="12" fill="#ff3d9a" />
      <rect x="30" y="32" width="4" height="4" fill="#e4eaf4" />
    </>
  );
}

function PixelCoins() {
  return (
    <>
      <rect x="12" y="34" width="40" height="6" fill="#b57a00" />
      <rect x="12" y="28" width="40" height="6" fill="#ffc53d" />
      <rect x="12" y="22" width="40" height="6" fill="#b57a00" />
      <rect x="12" y="16" width="40" height="6" fill="#ffc53d" />
      <rect x="28" y="16" width="8" height="24" fill="#ff3d9a" />
      <rect x="12" y="40" width="40" height="6" fill="#7ea800" />
      <rect x="16" y="46" width="32" height="6" fill="#ccff3d" />
    </>
  );
}

function PixelPin() {
  return (
    <>
      <rect x="14" y="4" width="36" height="6" fill="#2f49ff" />
      <rect x="8" y="10" width="48" height="24" fill="#2f49ff" />
      <rect x="14" y="34" width="36" height="6" fill="#2f49ff" />
      <rect x="20" y="40" width="24" height="6" fill="#2f49ff" />
      <rect x="26" y="46" width="12" height="8" fill="#2f49ff" />
      <rect x="20" y="12" width="24" height="16" fill="#ff3d9a" />
      <rect x="26" y="16" width="12" height="8" fill="#fff4e2" />
    </>
  );
}

function PixelSuitcase() {
  return (
    <>
      <rect x="24" y="4" width="16" height="8" fill="#5d4c85" />
      <rect x="28" y="6" width="8" height="6" fill="#fff4e2" />
      <rect x="8" y="12" width="48" height="40" fill="#7c3aed" />
      <rect x="8" y="12" width="48" height="4" fill="#e4eaf4" />
      <rect x="26" y="26" width="12" height="12" fill="#ccff3d" />
      <rect x="14" y="20" width="6" height="6" fill="#ff3d9a" />
      <rect x="44" y="38" width="6" height="6" fill="#ccff3d" />
    </>
  );
}

function PixelCloud() {
  return (
    <>
      <rect x="18" y="12" width="28" height="6" fill="#93a3ff" />
      <rect x="10" y="18" width="44" height="22" fill="#93a3ff" />
      <rect x="16" y="40" width="32" height="6" fill="#93a3ff" />
      <rect x="22" y="22" width="6" height="6" fill="#251a42" />
      <rect x="36" y="22" width="6" height="6" fill="#251a42" />
      <rect x="26" y="32" width="12" height="4" fill="#251a42" />
      <rect x="26" y="32" width="4" height="6" fill="#ff3d9a" />
      <rect x="4" y="44" width="8" height="8" fill="#3ee0ff" />
      <rect x="52" y="44" width="8" height="8" fill="#3ee0ff" />
    </>
  );
}

const art: Record<Art, ReactNode> = {
  beach: (
    <>
      <PixelSun />
      <PixelWave />
      <PixelWave y={56} color="#ccff3d" />
    </>
  ),
  map: <PixelPin />,
  camera: <PixelCamera />,
  coins: <PixelCoins />,
  suitcase: <PixelSuitcase />,
  cloud: <PixelCloud />,
};

export function EmptyState({
  illustration = "cloud",
  title,
  description,
  action,
  className,
}: {
  illustration?: Art;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "dotted-grid flex flex-col items-center gap-4 rounded-window border-2 border-dashed border-silver-deep/80 bg-white/50 px-5 py-8 text-center",
        className,
      )}
    >
      <svg
        viewBox="0 0 64 64"
        className="size-24 animate-float"
        style={{ imageRendering: "pixelated" }}
        role="presentation"
      >
        {art[illustration]}
      </svg>
      <div className="space-y-1.5">
        <p className="font-display text-xs uppercase leading-5 tracking-tight text-ink">
          {title}
        </p>
        {description && (
          <p className="mx-auto max-w-xs text-sm font-semibold text-ink-soft">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}
