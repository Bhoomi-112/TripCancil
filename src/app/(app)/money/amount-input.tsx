"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { parsePaise } from "@/lib/money/paise";
import { Label } from "@/components/ui/input";

type Props = {
  name: string;
  label?: string;
  defaultValue?: string;
  error?: string;
  autoFocus?: boolean;
  placeholder?: string;
  /** Paise, or null while the text cannot be read. */
  onValueChange?: (paise: number | null) => void;
};

/**
 * A rupee field, not a number field. The value posted is text on purpose: the
 * server parses it to paise and rejects anything it cannot read exactly, which
 * is the only way "1200" can never become 1199.99.
 */
export function AmountInput({
  name,
  label = "Amount",
  defaultValue = "",
  error,
  autoFocus,
  placeholder = "1,200",
  onValueChange,
}: Props) {
  const [text, setText] = useState(defaultValue);
  const [blurred, setBlurred] = useState(false);

  function tidy(value: string) {
    const paise = parsePaise(value);
    if (paise === null) return;
    setText((paise / 100).toFixed(2).replace(/\.00$/, ""));
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <div
        className={cn(
          "flex items-center gap-2 rounded-2xl border-2 border-silver-deep bg-white/85 px-3.5 py-2.5 shadow-[inset_0_2px_4px_rgb(37_26_66/0.08)]",
          "focus-within:border-electric focus-within:shadow-[0_0_0_4px_rgb(47_73_255/0.18)]",
          error && "border-hotpink",
        )}
      >
        <span className="font-display text-sm text-ink-soft">₹</span>
        <input
          id={name}
          name={name}
          inputMode="decimal"
          autoFocus={autoFocus}
          placeholder={placeholder}
          value={text}
          aria-invalid={Boolean(error) || undefined}
          onChange={(event) => {
            setText(event.target.value);
            onValueChange?.(parsePaise(event.target.value));
          }}
          onBlur={() => {
            setBlurred(true);
            onValueChange?.(parsePaise(text));
            tidy(text);
          }}
          className="w-full bg-transparent text-xl font-extrabold text-ink outline-none placeholder:font-bold placeholder:text-ink-soft/50"
        />
      </div>
      {error ? (
        <p className="text-xs font-extrabold text-hotpink-deep">{error}</p>
      ) : blurred && text.trim() && parsePaise(text) === null ? (
        <p className="text-xs font-extrabold text-hotpink-deep">
          Type digits, like 1200 or 1200.50
        </p>
      ) : null}
    </div>
  );
}