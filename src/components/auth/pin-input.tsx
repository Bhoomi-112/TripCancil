"use client";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import { PIN_LENGTH } from "@/lib/validation/auth";

/**
 * One real input sitting over six drawn cells. Keeping it a single native input
 * means paste, backspace, one-time-code autofill and mobile keyboards all behave,
 * which six separate inputs would each have to reimplement.
 */
export function PinInput({
  name,
  invalid,
  autoFocus,
  defaultValue,
  readOnly,
}: {
  name: string;
  invalid?: boolean;
  autoFocus?: boolean;
  defaultValue?: string;
  readOnly?: boolean;
}) {
  return (
    <div className="relative">
      <div className="pointer-events-none grid grid-cols-6 gap-2" aria-hidden="true">
        {Array.from({ length: PIN_LENGTH }, (_, index) => (
          <span
            key={index}
            className={cn(
              "h-14 rounded-2xl border-2 bg-white/85 shadow-[inset_0_2px_4px_rgb(37_26_66/0.08)]",
              invalid ? "border-hotpink" : "border-silver-deep",
            )}
          />
        ))}
      </div>
      <Input
        name={name}
        type="password"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={PIN_LENGTH}
        pattern="\d{6}"
        required={!readOnly}
        invalid={invalid}
        autoFocus={autoFocus}
        defaultValue={defaultValue}
        readOnly={readOnly}
        aria-label={`${PIN_LENGTH}-digit PIN`}
        className={cn(
          "absolute inset-0 h-full border-0 bg-transparent text-center font-display text-2xl tracking-[0.35em] shadow-none focus:shadow-none",
          "[&:focus-visible]:outline-2 [&:focus-visible]:outline-offset-2 [&:focus-visible]:outline-electric",
          "placeholder:tracking-[0.35em]",
        )}
      />
    </div>
  );
}
