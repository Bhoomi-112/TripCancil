"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/cn";
import { CloseIcon, InfoIcon, SparkleIcon } from "./icons";

type Variant = "success" | "error" | "info" | "warn";

type ToastItem = { id: string; message: string; variant: Variant };

type ToastApi = {
  show: (message: string, variant?: Variant) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  warn: (message: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

const skins: Record<Variant, string> = {
  success: "border-lime-deep bg-lime text-ink",
  error: "border-hotpink-deep bg-hotpink text-white",
  warn: "border-[#b57a00] bg-sunny text-ink",
  info: "border-electric-deep bg-electric text-white",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const show = useCallback(
    (message: string, variant: Variant = "info") => {
      const id = crypto.randomUUID();
      setItems((current) => [...current.slice(-3), { id, message, variant }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), 3600),
      );
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (message) => show(message, "success"),
      error: (message) => show(message, "error"),
      info: (message) => show(message, "info"),
      warn: (message) => show(message, "warn"),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-24 z-40 flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:items-end"
        role="status"
        aria-live="polite"
      >
        {items.map((item) => (
          <div
            key={item.id}
            className={cn(
              "animate-slide-up pointer-events-auto flex w-full max-w-sm items-center gap-2 rounded-2xl border-2 px-3.5 py-2.5 text-sm font-extrabold shadow-bubble-lg",
              skins[item.variant],
            )}
          >
            <SparkleIcon className="size-4 shrink-0 animate-twinkle" />
            <p className="min-w-0 flex-1">{item.message}</p>
            <button
              type="button"
              onClick={() => dismiss(item.id)}
              aria-label="Dismiss notification"
              className="shrink-0 rounded-full p-1 opacity-70 transition hover:opacity-100"
            >
              <CloseIcon className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast must be used inside <ToastProvider>");
  return api;
}

export function ToastInfo({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 text-xs font-semibold text-ink-soft">
      <InfoIcon className="mt-0.5 size-3.5 shrink-0" />
      {children}
    </p>
  );
}
