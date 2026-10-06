"use client";

import { useActionState, useEffect, useState } from "react";
import { useSWRConfig } from "swr";
import { Field, Input, Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { idleState } from "@/lib/actions/state";
import { cn } from "@/lib/cn";
import {
  PACKING_CATEGORIES,
  PACKING_CATEGORY_LABELS,
} from "@/lib/packing/categories";
import { isPackingKey, type PackingItem, type PackingMember } from "@/lib/packing/types";
import { addPackingItemAction, updatePackingItemAction } from "./packing-actions";

type Props = {
  members: PackingMember[];
  viewerId: string;
  item?: PackingItem;
  onDone: () => void;
};

export function PackingItemForm({ members, viewerId, item, onDone }: Props) {
  const editing = Boolean(item);
  const [createState, create] = useActionState(
    addPackingItemAction,
    idleState,
  );
  const [updateState, update] = useActionState(
    updatePackingItemAction,
    idleState,
  );
  const state = editing ? updateState : createState;

  const { mutate } = useSWRConfig();
  const toast = useToast();

  const [isShared, setIsShared] = useState(item ? item.is_shared : true);
  const [assignedTo, setAssignedTo] = useState(() => {
    if (!item) return viewerId;
    return item.assigned_to ?? (item.is_shared ? "" : viewerId);
  });

  useEffect(() => {
    if (!state.ok) return;
    toast.success(editing ? "Item updated." : "Added to the list.");
    void mutate(isPackingKey);
    onDone();
  }, [state, editing, mutate, onDone, toast]);

  return (
    <form
      id="packing-item-form"
      action={editing ? update : create}
      className="flex flex-col gap-3"
    >
      {editing ? <input type="hidden" name="itemId" value={item?.id} /> : null}
      <input type="hidden" name="isShared" value={isShared ? "true" : "false"} />
      <input type="hidden" name="assignedTo" value={isShared ? assignedTo : ""} />

      <Field label="What to pack" error={state.fieldErrors?.name}>
        <Input
          name="name"
          defaultValue={item?.name ?? ""}
          maxLength={80}
          placeholder="Sunscreen SPF 50"
          autoFocus
        />
      </Field>

      <Field label="Category">
        <Select name="category" defaultValue={item?.category ?? "gear"}>
          {PACKING_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {PACKING_CATEGORY_LABELS[category]}
            </option>
          ))}
        </Select>
      </Field>

      <button
        type="button"
        role="switch"
        aria-checked={isShared}
        onClick={() => setIsShared((value) => !value)}
        className={cn(
          "flex items-center gap-2 rounded-2xl border-2 px-3.5 py-3 text-left transition-transform duration-150 active:translate-y-[2px]",
          isShared
            ? "border-ink bg-white shadow-sticker"
            : "border-silver-deep bg-white/50",
        )}
      >
        <span
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-full border-2 font-display text-[10px] transition-colors",
            isShared
              ? "border-ink bg-lime"
              : "border-silver-deep bg-silver",
          )}
        >
          {isShared ? "✓" : "ME"}
        </span>
        <span className="flex flex-col gap-0.5">
          <span className="font-display text-[10px] uppercase tracking-tight text-ink">
            {isShared ? "Shared with the crew" : "Just for you"}
          </span>
          <span className="text-xs font-semibold text-ink-soft">
            {isShared
              ? "Everyone sees it and can tick it off."
              : "Only you can see and tick this off."}
          </span>
        </span>
      </button>

      {isShared ? (
        <Field
          label="Who is carrying it"
          hint="Nobody means it is up for grabs."
        >
          <Select
            name="assignedTo"
            value={assignedTo}
            onChange={(event) => setAssignedTo(event.target.value)}
          >
            <option value="">Nobody</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.id === viewerId
                  ? `${member.displayName} (you)`
                  : member.displayName}
              </option>
            ))}
          </Select>
        </Field>
      ) : (
        <p className="text-xs font-semibold text-ink-soft">
          This stays on {viewerId ? "your" : "the"} personal list. Make it shared
          to let the group add to it.
        </p>
      )}

      {state.error ? (
        <p className="text-xs font-extrabold text-hotpink-deep">{state.error}</p>
      ) : (
        <p className="text-xs font-semibold text-ink-soft">
          You can change any of this later.
        </p>
      )}
    </form>
  );
}