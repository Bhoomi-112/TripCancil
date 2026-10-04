"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { IconButton } from "./button";
import { CloseIcon } from "./icons";
import { Window } from "./window";

type Size = "sm" | "md" | "lg";

const widths: Record<Size, string> = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-3xl",
};

export function Modal({
  open,
  onClose,
  title,
  description,
  size = "md",
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  size?: Size;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-ink/55 p-0 backdrop-blur-[2px] sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        className={cn(
          "animate-pop w-full rounded-t-window outline-none sm:rounded-window",
          widths[size],
        )}
      >
        <Window
          title={title}
          actions={
            <IconButton
              label="Close"
              size="sm"
              variant="ghost"
              className="size-8"
              onClick={onClose}
            >
              <CloseIcon className="size-4" />
            </IconButton>
          }
          footer={footer}
          bodyClassName="p-5"
        >
          {description && (
            <p className="mb-4 text-sm font-semibold text-ink-soft">
              {description}
            </p>
          )}
          {children}
        </Window>
      </div>
    </div>,
    document.body,
  );
}
