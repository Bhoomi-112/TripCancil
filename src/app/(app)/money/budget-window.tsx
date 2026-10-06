"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PencilIcon, PlusIcon } from "@/components/ui/icons";
import { Window } from "@/components/ui/window";
import { cn } from "@/lib/cn";
import type { MoneyPayload } from "@/lib/money/balances";
import {
  budgetLines,
  budgetTotals,
  ratioPaise,
} from "@/lib/money/budget";
import { CATEGORY_COLOURS, CATEGORY_LABELS } from "@/lib/money/categories";
import { formatPaise, formatPaiseShort } from "@/lib/money/paise";
import { BudgetForm } from "./budget-form";

type Props = {
  payload: MoneyPayload;
  editable: boolean;
};

function ToneBar({
  value,
  tone,
}: {
  /** 0..1 */
  value: number;
  tone: "chrome" | "lime" | "hotpink";
}) {
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(value * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      className="h-3 w-full overflow-hidden rounded-full border-2 border-ink/15 bg-silver"
    >
      <div
        className={cn(
          "h-full rounded-full border border-ink/10 transition-[width] duration-500",
          tone === "chrome" && "bg-linear-to-b from-white to-silver-mid",
          tone === "lime" && "bg-lime",
          tone === "hotpink" && "bg-hotpink",
        )}
        style={{ width: `${Math.min(100, value * 100)}%` }}
      />
    </div>
  );
}

export function BudgetWindow({ payload, editable }: Props) {
  const budget = payload.budget;
  const [editing, setEditing] = useState(false);

  const totals = useMemo(() => budgetTotals(payload, budget), [payload, budget]);
  const lines = useMemo(() => budgetLines(payload, budget), [payload, budget]);
  const hasBudget = budget !== null && (budget.total_paise > 0 || lines.length > 0);
  const over = totals.overPaise > 0;

  return (
    <>
      <Window
        title="The budget"
        icon={<span aria-hidden="true">🎯</span>}
        actions={
          editable ? (
            <Button size="sm" variant="chrome" onClick={() => setEditing(true)}>
              {hasBudget ? <PencilIcon className="size-4" /> : <PlusIcon className="size-4" />}
              {hasBudget ? "Edit" : "Set"}
            </Button>
          ) : undefined
        }
      >
        {!hasBudget ? (
          <EmptyState
            illustration="coins"
            title={editable ? "No budget yet" : "This trip never set a budget"}
            description={
              editable
                ? "Give the trip a ceiling and the ledger will show how the spending paces against it."
                : "The money is what it was; there is no ceiling to check it against."
            }
            action={
              editable ? (
                <Button size="sm" variant="pop" onClick={() => setEditing(true)}>
                  <PlusIcon className="size-4" />
                  Set a budget
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="font-display text-2xl uppercase leading-none text-ink">
                  {formatPaise(totals.totalPaise)}
                </p>
                <p className="mt-1 text-xs font-bold text-ink-soft">
                  {totals.spentPaise === 0
                    ? "nothing spent yet"
                    : `${formatPaiseShort(totals.spentPaise)} of the ceiling spent`}
                </p>
              </div>
              <Badge
                tone={over ? "bubble" : totals.remainingPaise >= 0 ? "pop" : "chrome"}
                sticker
              >
                {over
                  ? `Over by ${formatPaise(totals.overPaise)}`
                  : totals.remainingPaise === 0
                    ? "On the ceiling"
                    : formatPaise(totals.remainingPaise) + " left"}
              </Badge>
            </div>

            <ToneBar
              value={ratioPaise(totals.spentPaise, totals.totalPaise)}
              tone={over ? "hotpink" : "lime"}
            />

            {lines.length > 0 ? (
              <div className="flex flex-col gap-2.5 border-t-2 border-dashed border-silver-deep pt-3">
                <p className="font-display text-[9px] uppercase tracking-tight text-ink-soft">
                  Category caps
                </p>
                {lines.map((line) => {
                  const overLine = line.overPaise > 0;
                  return (
                    <div key={line.category} className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="size-2.5 rounded-full border border-ink/20"
                          style={{ background: CATEGORY_COLOURS[line.category] }}
                          aria-hidden="true"
                        />
                        <span className="text-xs font-extrabold text-ink">
                          {CATEGORY_LABELS[line.category]}
                        </span>
                        <span className="ml-auto text-[11px] font-bold text-ink-soft">
                          {formatPaiseShort(line.spentPaise)} /{" "}
                          {formatPaiseShort(line.capPaise)}
                        </span>
                        {overLine ? (
                          <Badge tone="bubble" className="shrink-0">
                            +{formatPaise(line.overPaise)}
                          </Badge>
                        ) : null}
                      </div>
                      <ToneBar
                        value={ratioPaise(line.spentPaise, line.capPaise)}
                        tone={overLine ? "hotpink" : "chrome"}
                      />
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        )}
      </Window>

      {editing ? (
        <BudgetForm budget={budget} onClose={() => setEditing(false)} />
      ) : null}
    </>
  );
}