"use client";

import { useEffect, useMemo } from "react";
import { useActionState } from "react";
import { useSWRConfig } from "swr";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { idleState } from "@/lib/actions/state";
import { capsOf, type BudgetRow } from "@/lib/money/budget";
import { isMoneyKey } from "@/lib/money/balances";
import {
  CATEGORY_COLOURS,
  CATEGORY_LABELS,
  EXPENSE_CATEGORIES,
} from "@/lib/money/categories";
import { formatPaise } from "@/lib/money/paise";
import { capFieldName } from "@/lib/validation/money";
import { setBudgetAction } from "./actions";
import { AmountInput } from "./amount-input";

type Props = {
  budget: BudgetRow | null;
  onClose: () => void;
};

const rupees = (paise: number) => formatPaise(paise).replace("₹", "");

/**
 * The whole budget in one modal: a total to pace against plus an optional cap
 * per expense category. Blank caps post as empty strings and mean "no cap",
 * which the action reads as nothing at all.
 */
export function BudgetForm({ budget, onClose }: Props) {
  const [state, submit, pending] = useActionState(setBudgetAction, idleState);
  const { mutate } = useSWRConfig();
  const toast = useToast();

  useEffect(() => {
    if (!state.ok) return;
    toast.success("Budget saved.");
    void mutate(isMoneyKey);
    onClose();
  }, [state, mutate, onClose, toast]);

  const caps = useMemo(() => capsOf(budget), [budget]);
  const capByCategory = useMemo(
    () => new Map(caps.map((cap) => [cap.category, cap.capPaise])),
    [caps],
  );
  const anyCap = caps.length > 0;

  return (
    <Modal
      open
      onClose={onClose}
      title="Set a budget"
      description="A ceiling the whole ledger paces against. Caps are optional: leave one blank and that category is uncapped."
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="budget-form"
            variant="pop"
            size="sm"
            loading={pending}
          >
            Save the budget
          </Button>
        </>
      }
    >
      <form
        id="budget-form"
        action={submit}
        className="flex flex-col gap-3"
        aria-label="Budget form"
      >
        <AmountInput
          name="totalRupees"
          label="Total budget"
          defaultValue={budget ? rupees(budget.total_paise) : ""}
          error={state.fieldErrors?.totalRupees}
          placeholder="20,000"
          autoFocus
        />

        <div className="flex flex-col gap-2 border-t-2 border-dashed border-silver-deep pt-3">
          <p className="font-display text-[9px] uppercase tracking-tight text-ink-soft">
            Category caps {!anyCap ? "(none yet)" : ""}
          </p>
          {EXPENSE_CATEGORIES.map((category) => (
            <div key={category} className="flex items-center gap-2.5">
              <span
                className="size-3 shrink-0 rounded-full border border-ink/20"
                style={{ background: CATEGORY_COLOURS[category] }}
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <AmountInput
                  name={capFieldName(category)}
                  label={CATEGORY_LABELS[category]}
                  defaultValue={
                    capByCategory.has(category)
                      ? rupees(capByCategory.get(category) ?? 0)
                      : ""
                  }
                  error={state.fieldErrors?.[capFieldName(category)]}
                  placeholder="uncapped"
                />
              </div>
            </div>
          ))}
        </div>

        {state.error ? (
          <p className="text-xs font-extrabold text-hotpink-deep">{state.error}</p>
        ) : null}
      </form>
    </Modal>
  );
}