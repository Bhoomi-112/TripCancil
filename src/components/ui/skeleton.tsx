import { cn } from "@/lib/cn";

export function Skeleton({
  className,
  circle = false,
}: {
  className?: string;
  circle?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "block animate-shimmer bg-linear-to-r from-silver via-white to-silver bg-[length:200%_100%]",
        circle ? "rounded-full" : "rounded-xl",
        className,
      )}
    />
  );
}

export function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton
          key={index}
          className={cn("h-3", index === lines - 1 ? "w-2/3" : "w-full")}
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "space-y-3 rounded-window border-2 border-silver-mid bg-white/60 p-4",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <Skeleton circle className="size-10" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-2.5 w-1/3" />
        </div>
      </div>
      <SkeletonText lines={2} />
    </div>
  );
}
