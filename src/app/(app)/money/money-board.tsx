"use client";

import { useCallback, useMemo, useState } from "react";
import useSWR from "swr";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PlusIcon, SparkleIcon } from "@/components/ui/icons";
import { Tabs, TabPanel } from "@/components/ui/tabs";
import { Window } from "@/components/ui/window";
import {
  namesFor,
  simplifyDebts,
  computeBalances,
  totalSpent,
  totalByCategory,
  type MoneyExpense,
  type MoneyPayload,
  type Transfer,
} from "@/lib/money/balances";
import { CATEGORY_COLOURS, CATEGORY_LABELS } from "@/lib/money/categories";
import { formatPaise, formatPaiseShort } from "@/lib/money/paise";
import { BudgetWindow } from "./budget-window";
import { ExpenseForm } from "./expense-form";
import { ExpenseRow } from "./expense-row";
import { PayModal } from "./pay-modal";
import { PaymentQrModal } from "./payment-qr-modal";
import { SettleForm } from "./settle-form";
import { SettlementRow } from "./settlement-row";

type Props = {
  tripId: string;
  viewerId: string;
  isOwner: boolean;
  editable: boolean;
  initial: MoneyPayload;
  startDate: string;
  endDate: string;
  today: string;
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

/** "Fri 12 Sep" in UTC, because a trip date is a date and not a moment. */
function longDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export function MoneyBoard({
  tripId,
  viewerId,
  isOwner,
  editable,
  initial,
  startDate,
  endDate,
  today,
}: Props) {
  const { data } = useSWR<MoneyPayload>(`/api/trips/${tripId}/money`, fetcher, {
    fallbackData: initial,
    refreshInterval: 5000,
    keepPreviousData: true,
  });
  const payload = data ?? initial;

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<{
    expense: MoneyExpense;
    shares: Map<string, number>;
  } | null>(null);
  const [settling, setSettling] = useState<Transfer | null>(null);
  const [paying, setPaying] = useState<Transfer | null>(null);
  const [myQr, setMyQr] = useState(false);
  const [tab, setTab] = useState("all");

  const startEdit = useCallback(
    (expense: MoneyExpense, shares: Map<string, number>) => {
      setEditing({ expense, shares });
    },
    [],
  );

  const names = useMemo(() => namesFor(payload), [payload]);
  const balances = useMemo(() => computeBalances(payload), [payload]);
  const transfers = useMemo(() => simplifyDebts(balances), [balances]);
  const totalPaise = useMemo(() => totalSpent(payload), [payload]);
  const categories = useMemo(() => totalByCategory(payload), [payload]);
  const me = balances.find((balance) => balance.memberId === viewerId);

  const sharesByExpense = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    for (const split of payload.splits) {
      const shares = map.get(split.expense_id) ?? new Map<string, number>();
      shares.set(split.member_id, (shares.get(split.member_id) ?? 0) + split.share_paise);
      map.set(split.expense_id, shares);
    }
    return map;
  }, [payload]);

  const live = useMemo(
    () => payload.expenses.filter((expense) => !expense.deleted_at),
    [payload],
  );

  const byDay = useMemo(() => {
    const groups = new Map<string, MoneyExpense[]>();
    for (const expense of live) {
      const list = groups.get(expense.spent_on) ?? [];
      list.push(expense);
      groups.set(expense.spent_on, list);
    }
    return [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [live]);

  const myPosition =
    !me || me.netPaise === 0
      ? { label: "All square", tone: "chrome" as const }
      : me.netPaise > 0
        ? { label: `The group owes you ${formatPaise(me.netPaise)}`, tone: "pop" as const }
        : { label: `You owe ${formatPaise(-me.netPaise)}`, tone: "bubble" as const };

  return (
    <div className="flex flex-col gap-4">
      <Window
        title="The ledger"
        icon={<SparkleIcon className="size-4" />}
        actions={
          editable ? (
            <Button size="sm" variant="pop" onClick={() => setAdding(true)}>
              <PlusIcon className="size-4" />
              Log
            </Button>
          ) : undefined
        }
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-display text-2xl uppercase leading-none text-ink">
              {formatPaise(totalPaise)}
            </p>
            <p className="mt-1 text-xs font-bold text-ink-soft">
              {live.length} {live.length === 1 ? "expense" : "expenses"} ·{" "}
              {payload.settlements.length}{" "}
              {payload.settlements.length === 1 ? "settlement" : "settlements"}
            </p>
          </div>
          <Badge tone={myPosition.tone} sticker>
            {myPosition.label}
          </Badge>
        </div>

        {categories.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {categories.map((entry) => (
              <span
                key={entry.category}
                className="inline-flex items-center gap-1.5 rounded-full border-2 border-silver-deep bg-white/70 px-2.5 py-1 font-display text-[9px] uppercase tracking-tight text-ink"
              >
                <span
                  className="size-2.5 rounded-full border border-ink/20"
                  style={{ background: CATEGORY_COLOURS[entry.category] }}
                  aria-hidden="true"
                />
                {CATEGORY_LABELS[entry.category]}
                <span className="text-ink-soft">{formatPaiseShort(entry.paise)}</span>
              </span>
            ))}
          </div>
        ) : null}
      </Window>

      <BudgetWindow payload={payload} editable={editable} />

      <Window
        title="Who owes whom"
        icon={<span aria-hidden="true">⚖️</span>}
        actions={
          editable ? (
            <Button size="sm" variant="chrome" onClick={() => setMyQr(true)}>
              My QR
            </Button>
          ) : undefined
        }
      >
        <div className="flex flex-col gap-2">
          {balances.map((balance) => {
            const name = balance.memberId === viewerId ? "You" : (names.get(balance.memberId) ?? "?");
            return (
              <div key={balance.memberId} className="flex items-center gap-2">
                <Avatar name={names.get(balance.memberId) ?? "?"} size="xs" />
                <span className="text-sm font-bold text-ink">{name}</span>
                <span className="ml-auto font-display text-xs text-ink-soft">
                  paid {formatPaiseShort(balance.paidPaise)} · share{" "}
                  {formatPaiseShort(balance.sharePaise)}
                </span>
                <span
                  className={
                    balance.netPaise > 0
                      ? "font-display text-xs text-forest"
                      : balance.netPaise < 0
                        ? "font-display text-xs text-hotpink-deep"
                        : "font-display text-xs text-ink-soft"
                  }
                >
                  {balance.netPaise > 0
                    ? `+${formatPaiseShort(balance.netPaise)}`
                    : formatPaiseShort(balance.netPaise)}
                </span>
              </div>
            );
          })}
        </div>

        {transfers.length > 0 ? (
          <div className="mt-3 flex flex-col gap-1.5 border-t-2 border-dashed border-silver-deep pt-3">
            <p className="font-display text-[9px] uppercase tracking-tight text-ink-soft">
              Fewest payments to square up
            </p>
            {transfers.map((transfer) => {
              const from = names.get(transfer.fromMemberId) ?? "Someone";
              const to = names.get(transfer.toMemberId) ?? "Someone";
              const creditor = payload.members.find(
                (member) => member.id === transfer.toMemberId,
              );
              const iOwe = transfer.fromMemberId === viewerId;
              return (
                <div
                  key={`${transfer.fromMemberId}-${transfer.toMemberId}`}
                  className="flex flex-wrap items-center gap-2"
                >
                  <span className="text-sm font-bold text-ink">
                    {transfer.fromMemberId === viewerId ? "You" : from}
                  </span>
                  <span className="text-ink-soft">pays</span>
                  <span className="text-sm font-bold text-ink">
                    {transfer.toMemberId === viewerId ? "you" : to}
                  </span>
                  <span className="ml-auto font-display text-xs text-electric">
                    {formatPaise(transfer.amountPaise)}
                  </span>
                  {iOwe && creditor?.qrUrl ? (
                    <button
                      type="button"
                      title={`Show ${to}'s payment QR`}
                      onClick={() => setPaying(transfer)}
                      className="size-7 shrink-0 overflow-hidden rounded-lg border-2 border-silver-deep bg-white shadow-sticker transition-transform duration-150 hover:scale-105"
                    >
                      {/* Signed URL into the private payment-qrs bucket. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={creditor.qrUrl}
                        alt={`${to}'s payment QR`}
                        className="size-full object-contain"
                      />
                    </button>
                  ) : null}
                  {editable && iOwe ? (
                    <button
                      type="button"
                      onClick={() => setPaying(transfer)}
                      className={buttonClass({ variant: "pop", size: "sm" })}
                    >
                      Pay
                    </button>
                  ) : editable ? (
                    <button
                      type="button"
                      onClick={() => setSettling(transfer)}
                      className={buttonClass({ variant: "ghost", size: "sm" })}
                    >
                      Log promise
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="mt-3 text-sm font-semibold text-ink-soft">
            Nobody owes anybody. Suspicious, but correct.
          </p>
        )}

        {payload.settlements.length > 0 ? (
          <div className="mt-3 flex flex-col gap-1.5 border-t-2 border-dashed border-silver-deep pt-3">
            <p className="font-display text-[9px] uppercase tracking-tight text-ink-soft">
              Settlements
            </p>
            {payload.settlements.map((settlement) => (
              <SettlementRow
                key={settlement.id}
                settlement={settlement}
                names={names}
                viewerId={viewerId}
                isOwner={isOwner}
                editable={editable}
              />
            ))}
          </div>
        ) : null}
      </Window>

      <Window
        title="Every expense"
        icon={<span aria-hidden="true">🧾</span>}
        actions={
          categories.length > 0 ? (
            <Tabs
              value={tab}
              onValueChange={setTab}
              items={[
                { value: "all", label: "All" },
                ...categories.map((entry) => ({
                  value: entry.category,
                  label: CATEGORY_LABELS[entry.category],
                })),
              ]}
            />
          ) : undefined
        }
      >
        {live.length === 0 ? (
          <EmptyState
            illustration="coins"
            title="No expenses yet"
            description={
              editable
                ? "Log the first chai run and the balances start moving."
                : "This trip never logged an expense."
            }
            action={
              editable ? (
                <Button size="sm" variant="pop" onClick={() => setAdding(true)}>
                  Log an expense
                </Button>
              ) : undefined
            }
          />
        ) : (
          <TabPanel when="all" active={tab}>
            <ExpenseList
              tripId={tripId}
              byDay={byDay}
              sharesByExpense={sharesByExpense}
              names={names}
              viewerId={viewerId}
              editable={editable}
              onEdit={startEdit}
            />
          </TabPanel>
        )}

        {live.length > 0
          ? categories.map((entry) => (
              <TabPanel key={entry.category} when={entry.category} active={tab}>
                <ExpenseList
                  tripId={tripId}
                  byDay={byDay.filter(([, list]) =>
                    list.some((expense) => expense.category === entry.category),
                  )}
                  sharesByExpense={sharesByExpense}
                  names={names}
                  viewerId={viewerId}
                  editable={editable}
                  onEdit={startEdit}
                  onlyCategory={entry.category}
                />
              </TabPanel>
            ))
          : null}
      </Window>

      {adding ? (
        <ExpenseForm
          members={payload.members}
          startDate={startDate}
          endDate={endDate}
          today={today}
          viewerId={viewerId}
          onClose={() => setAdding(false)}
        />
      ) : null}

      {editing ? (
        <ExpenseForm
          members={payload.members}
          startDate={startDate}
          endDate={endDate}
          today={today}
          viewerId={viewerId}
          expense={editing.expense}
          sharesById={editing.shares}
          onClose={() => setEditing(null)}
        />
      ) : null}

      {settling ? (
        <SettleForm
          members={payload.members}
          viewerId={viewerId}
          fromMemberId={settling.fromMemberId}
          toMemberId={settling.toMemberId}
          amountPaise={settling.amountPaise}
          onClose={() => setSettling(null)}
        />
      ) : null}

      {paying ? (
        <PayModal
          viewerId={viewerId}
          fromMemberId={paying.fromMemberId}
          toMemberId={paying.toMemberId}
          amountPaise={paying.amountPaise}
          members={payload.members}
          onClose={() => setPaying(null)}
        />
      ) : null}

      {myQr ? (
        <PaymentQrModal
          tripId={tripId}
          qrUrl={payload.members.find((member) => member.id === viewerId)?.qrUrl ?? null}
          upiId={payload.members.find((member) => member.id === viewerId)?.upiId ?? null}
          onClose={() => setMyQr(false)}
        />
      ) : null}
    </div>
  );
}

type ListProps = {
  tripId: string;
  byDay: [string, MoneyExpense[]][];
  sharesByExpense: Map<string, Map<string, number>>;
  names: Map<string, string>;
  viewerId: string;
  editable: boolean;
  onEdit: (expense: MoneyExpense, shares: Map<string, number>) => void;
  onlyCategory?: string;
};

function ExpenseList({
  tripId,
  byDay,
  sharesByExpense,
  names,
  viewerId,
  editable,
  onEdit,
  onlyCategory,
}: ListProps) {
  return (
    <div className="flex flex-col gap-3">
      {byDay.map(([date, list]) => {
        const rows = onlyCategory
          ? list.filter((expense) => expense.category === onlyCategory)
          : list;
        const dayTotal = rows.reduce((sum, expense) => sum + expense.amount_paise, 0);
        return (
          <section key={date} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between">
              <h3 className="font-display text-[10px] uppercase tracking-tight text-ink-soft">
                {longDate(date)}
              </h3>
              <p className="font-display text-[10px] text-ink-soft">
                {formatPaise(dayTotal)}
              </p>
            </div>
            {rows.map((expense) => (
              <ExpenseRow
                key={expense.id}
                expense={expense}
                tripId={tripId}
                shares={sharesByExpense.get(expense.id) ?? new Map()}
                names={names}
                viewerId={viewerId}
                editable={editable}
                onEdit={onEdit}
              />
            ))}
          </section>
        );
      })}
    </div>
  );
}