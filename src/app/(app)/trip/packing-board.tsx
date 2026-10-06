"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import useSWR from "swr";
import { idleState } from "@/lib/actions/state";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, IconButton, buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  CheckIcon,
  PencilIcon,
  PlusIcon,
  SparkleIcon,
  TrashIcon,
} from "@/components/ui/icons";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { Window } from "@/components/ui/window";
import { cn } from "@/lib/cn";
import {
  PACKING_CATEGORIES,
  PACKING_CATEGORY_COLOURS,
  PACKING_CATEGORY_LABELS,
  type PackingCategory,
} from "@/lib/packing/categories";
import type { PackingItem, PackingPayload } from "@/lib/packing/types";
import { PackingItemForm } from "./packing-item-form";
import {
  deletePackingItemAction,
  seedStarterItemsAction,
  togglePackingItemAction,
} from "./packing-actions";

type Props = {
  tripId: string;
  viewerId: string;
  editable: boolean;
  initial: PackingPayload;
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function PackingBoard({ tripId, viewerId, editable, initial }: Props) {
  const toast = useToast();
  const [isPending, startTransition] = useTransition();

  /** "shared" | "mine" is the two-tab split; `undefined` means closed. */
  const [view, setView] = useState<"shared" | "mine">("shared");
  const [category, setCategory] = useState<PackingCategory | "all">("all");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<PackingItem | null>(null);
  const [deleting, setDeleting] = useState<PackingItem | null>(null);

  const { data, mutate } = useSWR<PackingPayload>(
    `/api/trips/${tripId}/packing`,
    fetcher,
    {
      fallbackData: initial,
      refreshInterval: 5000,
      keepPreviousData: true,
    },
  );
  const payload = data ?? initial;

  const items = useMemo(() => payload.items ?? [], [payload]);
  const members = useMemo(() => payload.members ?? [], [payload]);
  const names = useMemo(
    () => new Map(members.map((member) => [member.id, member.displayName])),
    [members],
  );

  const inView = useMemo(
    () =>
      items.filter((item) => (view === "mine" ? !item.is_shared : item.is_shared)),
    [items, view],
  );
  const visible = useMemo(
    () =>
      category === "all"
        ? inView
        : inView.filter((item) => item.category === category),
    [inView, category],
  );
  const groups = useMemo(
    () =>
      PACKING_CATEGORIES.map((entry) => ({
        category: entry,
        items: visible.filter((item) => item.category === entry),
      })).filter((group) => group.items.length > 0),
    [visible],
  );
  const counts = useMemo(() => {
    const tally = new Map<PackingCategory, number>();
    for (const item of inView) {
      tally.set(item.category, (tally.get(item.category) ?? 0) + 1);
    }
    return tally;
  }, [inView]);
  const checkedInView = inView.filter((item) => item.checked).length;

  const toggle = useCallback(
    (item: PackingItem) => {
      if (!editable) return;
      startTransition(async () => {
        mutate(
          (current) =>
            patch(current ?? initial, item.id, { checked: !item.checked }),
          { revalidate: false },
        );
        const formData = new FormData();
        formData.set("itemId", item.id);
        const state = await togglePackingItemAction(idleState, formData);
        if (!state.ok) {
          toast.error(state.error ?? "Could not update that item.");
        }
        await mutate();
      });
    },
    [editable, initial, mutate, toast],
  );

  const handleDelete = useCallback(() => {
    if (!deleting) return;
    const target = deleting;
    setDeleting(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("itemId", target.id);
      const state = await deletePackingItemAction(idleState, formData);
      if (state.ok) {
        toast.success(`Removed "${target.name}".`);
      } else {
        toast.error(state.error ?? "Could not remove that item.");
      }
      await mutate();
    });
  }, [deleting, mutate, toast]);

  const seed = useCallback(() => {
    if (!editable) return;
    startTransition(async () => {
      const state = await seedStarterItemsAction();
      if (state.ok) {
        const added = (state.payload as { added?: number } | undefined)?.added ?? 0;
        toast.success(
          added > 0
            ? `Added ${added} starter item${added === 1 ? "" : "s"} for this vibe.`
            : "The starter list is already packed.",
        );
      } else {
        toast.error(state.error ?? "Could not seed the list.");
      }
      await mutate();
    });
  }, [editable, mutate, toast]);

  return (
    <>
      <Window
        title="pack-list.exe"
        actions={
          editable ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                size="sm"
                variant="chrome"
                loading={isPending}
                onClick={seed}
              >
                <SparkleIcon className="size-4" />
                Starter list
              </Button>
              <Button size="sm" variant="pop" onClick={() => setAdding(true)}>
                <PlusIcon className="size-4" />
                Pack
              </Button>
            </div>
          ) : undefined
        }
      >
        {items.length > 0 ? (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-pressed={view === "shared"}
                onClick={() => setView("shared")}
                className={buttonClass({
                  variant: view === "shared" ? "primary" : "chrome",
                  size: "sm",
                })}
              >
                Shared
              </button>
              <button
                type="button"
                aria-pressed={view === "mine"}
                onClick={() => setView("mine")}
                className={buttonClass({
                  variant: view === "mine" ? "pop" : "chrome",
                  size: "sm",
                })}
              >
                Just me
              </button>
            </div>
            <Badge tone="sunny" sticker>
              {checkedInView}/{inView.length} packed
            </Badge>
          </div>
        ) : null}

        {items.length === 0 ? (
          <EmptyState
            illustration="suitcase"
            title="Nothing packed yet"
            description={
              editable
                ? "Add the first item, or tap Starter list and let the trip vibe do the thinking."
                : "This trip never packed a thing."
            }
            action={
              editable ? (
                <Button size="sm" variant="accent" sparkle onClick={seed}>
                  <SparkleIcon className="size-4" />
                  Starter list
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="flex flex-col gap-3">
            {PACKING_CATEGORIES.some((entry) => counts.has(entry)) ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCategory("all")}
                  aria-pressed={category === "all"}
                  className={cn(
                    "rounded-full border-2 px-2.5 py-1 font-display text-[9px] uppercase tracking-tight transition-transform duration-150 active:translate-y-[2px]",
                    category === "all"
                      ? "border-ink bg-white shadow-sticker"
                      : "border-silver-deep bg-white/60",
                  )}
                >
                  All
                </button>
                {PACKING_CATEGORIES.filter((entry) => counts.has(entry)).map(
                  (entry) => (
                    <button
                      key={entry}
                      type="button"
                      onClick={() =>
                        setCategory((current) =>
                          current === entry ? "all" : entry,
                        )
                      }
                      aria-pressed={category === entry}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border-2 px-2.5 py-1 font-display text-[9px] uppercase tracking-tight transition-transform duration-150 active:translate-y-[2px]",
                        category === entry
                          ? "border-ink bg-white shadow-sticker"
                          : "border-silver-deep bg-white/60",
                      )}
                    >
                      <span
                        className="size-2.5 rounded-full border border-ink/20"
                        style={{
                          background: PACKING_CATEGORY_COLOURS[entry],
                        }}
                        aria-hidden="true"
                      />
                      {PACKING_CATEGORY_LABELS[entry]}
                      <span className="text-ink-soft">{counts.get(entry)}</span>
                    </button>
                  ),
                )}
              </div>
            ) : null}

            {visible.length === 0 ? (
              <EmptyState
                illustration="cloud"
                title={
                  view === "mine"
                    ? "Nothing just for you"
                    : "Nothing in that category"
                }
                description={
                  view === "mine"
                    ? "Make an item Just for you and it shows up here for nobody else."
                    : "Clear the category chips to see the whole list."
                }
                action={
                  view === "shared" && category !== "all" ? (
                    <button
                      type="button"
                      onClick={() => setCategory("all")}
                      className={buttonClass({ variant: "ghost", size: "sm" })}
                    >
                      Clear filters
                    </button>
                  ) : undefined
                }
              />
            ) : (
              <div className="flex flex-col gap-4">
                {groups.map((group) => (
                  <section
                    key={group.category}
                    className="flex flex-col gap-1.5"
                  >
                    <div className="flex items-baseline gap-2">
                      <span
                        className="size-2.5 rounded-full border border-ink/20"
                        style={{
                          background: PACKING_CATEGORY_COLOURS[group.category],
                        }}
                        aria-hidden="true"
                      />
                      <h3 className="font-display text-[10px] uppercase tracking-tight text-ink-soft">
                        {PACKING_CATEGORY_LABELS[group.category]}
                      </h3>
                      <p className="ml-auto font-display text-[10px] text-ink-soft">
                        {group.items.filter((item) => item.checked).length}/
                        {group.items.length}
                      </p>
                    </div>
                    {group.items.map((item) => (
                      <PackingRow
                        key={item.id}
                        item={item}
                        embed={item.assigned_to ? names.get(item.assigned_to) : undefined}
                        isSelf={item.assigned_to === viewerId}
                        editable={editable}
                        onToggle={() => toggle(item)}
                        onEdit={() => setEditing(item)}
                        onDelete={() => setDeleting(item)}
                      />
                    ))}
                  </section>
                ))}
              </div>
            )}
          </div>
        )}
      </Window>

      <Modal
        open={adding || editing !== null}
        onClose={() => {
          setAdding(false);
          setEditing(null);
        }}
        title={editing ? "edit-item.exe" : "new-item.exe"}
        description={
          editing
            ? "Everyone sees the latest version within five seconds."
            : view === "mine"
              ? "Keeping this one off the shared list."
              : "It lands on the shared list for the whole crew."
        }
        footer={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setAdding(false);
                setEditing(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="packing-item-form"
              variant={editing ? "chrome" : "pop"}
              size="sm"
              loading={isPending}
            >
              {editing ? "Save" : "Add to list"}
            </Button>
          </>
        }
      >
        {(adding || editing !== null) && (
          <PackingItemForm
            key={editing?.id ?? "new"}
            members={members}
            viewerId={viewerId}
            item={editing ?? undefined}
            onDone={() => {
              setAdding(false);
              setEditing(null);
            }}
          />
        )}
      </Modal>

      <Modal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="delete.bin"
        size="sm"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              Keep it
            </Button>
            <Button variant="danger" loading={isPending} onClick={handleDelete}>
              <TrashIcon className="size-4" />
              Delete
            </Button>
          </div>
        }
      >
        <p className="text-sm font-semibold text-ink-soft">
          &ldquo;{deleting?.name}&rdquo; comes off the list for everyone. There is
          no undo.
        </p>
      </Modal>
    </>
  );
}

function PackingRow({
  item,
  embed,
  isSelf,
  editable,
  onToggle,
  onEdit,
  onDelete,
}: {
  item: PackingItem;
  embed?: string;
  isSelf: boolean;
  editable: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-2xl border-2 px-3 py-2.5",
        item.checked
          ? "border-silver-mid bg-silver/40"
          : "border-silver-deep bg-white/80 shadow-sticker",
      )}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={item.checked}
        aria-label={`${item.checked ? "Unpack" : "Pack"} ${item.name}`}
        disabled={!editable}
        onClick={onToggle}
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-full border-2 transition-transform duration-150",
          editable ? "active:scale-90" : "cursor-default",
          item.checked
            ? "border-ink bg-lime"
            : editable
              ? "border-silver-deep bg-white"
              : "border-silver-deep bg-silver",
        )}
      >
        {item.checked ? (
          <CheckIcon className="size-3.5 text-ink" />
        ) : null}
      </button>

      <span
        className={cn(
          "min-w-0 flex-1 text-sm font-bold text-ink",
          item.checked && "text-ink-soft line-through",
        )}
      >
        {item.name}
      </span>

      {item.is_shared && embed && !isSelf ? (
        <span
          className="hidden items-center gap-1.5 sm:flex"
          title={`Carried by ${embed}`}
        >
          <Avatar name={embed} size="xs" />
          <span className="text-[11px] font-bold text-ink-soft">{embed}</span>
        </span>
      ) : null}

      {editable ? (
        <div className="flex shrink-0 items-center gap-1">
          <IconButton
            label={`Edit ${item.name}`}
            size="sm"
            variant="ghost"
            className="size-8"
            onClick={onEdit}
          >
            <PencilIcon className="size-4" />
          </IconButton>
          <IconButton
            label={`Delete ${item.name}`}
            size="sm"
            variant="ghost"
            className="size-8"
            onClick={onDelete}
          >
            <TrashIcon className="size-4" />
          </IconButton>
        </div>
      ) : null}
    </div>
  );
}

function patch(
  payload: PackingPayload,
  itemId: string,
  update: { checked: boolean },
): PackingPayload {
  return {
    ...payload,
    items: payload.items.map((item) =>
      item.id === itemId ? { ...item, ...update } : item,
    ),
  };
}