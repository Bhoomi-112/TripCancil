"use client";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabPanel } from "@/components/ui/tabs";
import { Window } from "@/components/ui/window";
import { useState } from "react";
import {
  CATEGORY_COLOURS,
  CATEGORY_LABELS,
  EXPENSE_CATEGORIES,
  SETTLEMENT_STATUS_LABELS,
} from "@/lib/money/categories";
import { formatPaise, formatPaiseShort } from "@/lib/money/paise";
import type { MoneyExpense, MoneyMember, MoneySettlement } from "@/lib/money/balances";
import { AmountInput } from "@/app/(app)/money/amount-input";
import { SettlementRow } from "@/app/(app)/money/settlement-row";

const MEMBERS: MoneyMember[] = [
  { id: "m1", displayName: "Bhoomi", role: "owner", upiId: "bhoomi@okaxis", qrUrl: null },
  { id: "m2", displayName: "Ravi", role: "member", upiId: "9876543210@ybl", qrUrl: null },
  { id: "m3", displayName: "Sana", role: "member", upiId: null, qrUrl: null },
  { id: "m4", displayName: "Dev", role: "member", upiId: null, qrUrl: null },
];

const NAMES = new Map(MEMBERS.map((member) => [member.id, member.displayName]));

/** A stand-in QR so the settle-up row can be reviewed without a stored one. */
const MOCK_QR =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'%3E%3Crect width='10' height='10' fill='white'/%3E%3Crect x='1' y='1' width='3' height='3' fill='%23111'/%3E%3Crect x='6' y='1' width='3' height='3' fill='%23111'/%3E%3Crect x='1' y='6' width='3' height='3' fill='%23111'/%3E%3Crect x='5' y='5' width='2' height='2' fill='%23111'/%3E%3Crect x='8' y='7' width='1' height='2' fill='%23111'/%3E%3C/svg%3E";

const SHARES = new Map([
  ["m1", 90000],
  ["m2", 70000],
  ["m3", 60000],
  ["m4", 50000],
]);

const EXPENSES: MoneyExpense[] = [
  {
    id: "e1",
    trip_id: "t1",
    payer_id: "m1",
    amount_paise: 270000,
    category: "stay",
    note: "Two nights at the Alibaug resort",
    spent_on: "2026-11-12",
    receiptUrl: null,
    deleted_at: null,
    created_at: "2026-11-12T09:00:00Z",
  },
  {
    id: "e2",
    trip_id: "t1",
    payer_id: "m2",
    amount_paise: 64300,
    category: "food",
    note: "Chaukhandi breakfast",
    spent_on: "2026-11-12",
    receiptUrl: null,
    deleted_at: null,
    created_at: "2026-11-12T10:30:00Z",
  },
  {
    id: "e3",
    trip_id: "t1",
    payer_id: "m3",
    amount_paise: 185000,
    category: "transport",
    note: "Fuel to Alibaug",
    spent_on: "2026-11-13",
    receiptUrl: null,
    deleted_at: null,
    created_at: "2026-11-13T08:15:00Z",
  },
];

const SETTLEMENTS: MoneySettlement[] = [
  {
    id: "s1",
    trip_id: "t1",
    from_member: "m2",
    to_member: "m1",
    amount_paise: 45000,
    status: "pending",
    created_at: "2026-11-13T20:30:00Z",
  },
  {
    id: "s2",
    trip_id: "t1",
    from_member: "m4",
    to_member: "m1",
    amount_paise: 120000,
    status: "paid",
    created_at: "2026-11-13T21:00:00Z",
  },
  {
    id: "s3",
    trip_id: "t1",
    from_member: "m3",
    to_member: "m2",
    amount_paise: 66000,
    status: "confirmed",
    created_at: "2026-11-14T09:45:00Z",
  },
];

const BALANCES = [
  { memberId: "m1", paidPaise: 900000, sharePaise: 620000, netPaise: 280000 },
  { memberId: "m2", paidPaise: 340000, sharePaise: 545000, netPaise: -205000 },
  { memberId: "m3", paidPaise: 120000, sharePaise: 505000, netPaise: -385000 },
  { memberId: "m4", paidPaise: 90000, sharePaise: 350000, netPaise: -260000 },
];

function Block({
  title,
  blurb,
  children,
}: {
  title: string;
  blurb: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-display text-sm uppercase tracking-tight text-electric-deep">
          {title}
        </h2>
        <p className="text-sm font-semibold text-ink-soft">{blurb}</p>
      </div>
      <Window title={title.toLowerCase().replace(/\s+/g, ".")} tone="cream">
        {children}
      </Window>
    </section>
  );
}

export function MoneySection() {
  const [amount, setAmount] = useState<number | null>(270000);
  const [tab, setTab] = useState("all");

  return (
    <>
      <Block
        title="Amount input"
        blurb="Rupees in, paise out. Free typing, exact parsing, never a float."
      >
        <div className="grid gap-3 sm:max-w-md">
          <AmountInput
            name="amountRupees"
            label="Amount"
            defaultValue="2,700.50"
            onValueChange={setAmount}
          />
          <p className="text-xs font-semibold text-ink-soft">
            Parsed as {amount === null ? "nothing yet" : formatPaise(amount)} ·{" "}
            {amount === null ? "the form stays disabled" : "two people can split it"}
          </p>
          <AmountInput
            name="brokenRupees"
            error="Type a number of rupees, like 450."
            defaultValue="45a0"
          />
        </div>
      </Block>

      <Block
        title="Category chips"
        blurb="One colour per category, sorted by what it cost."
      >
        <div className="flex flex-wrap gap-1.5">
          {EXPENSE_CATEGORIES.map((category, index) => (
            <span
              key={category}
              className="inline-flex items-center gap-1.5 rounded-full border-2 border-silver-deep bg-white/70 px-2.5 py-1 font-display text-[9px] uppercase tracking-tight text-ink"
            >
              <span
                className="size-2.5 rounded-full border border-ink/20"
                style={{ background: CATEGORY_COLOURS[category] }}
                aria-hidden="true"
              />
              {CATEGORY_LABELS[category]}
              <span className="text-ink-soft">
                {formatPaiseShort([840000, 430000, 275000, 120000, 64000][index] ?? 0)}
              </span>
            </span>
          ))}
        </div>
      </Block>

      <Block
        title="Balances and suggested payments"
        blurb="Net per person, then the fewest payments to get everyone square."
      >
        <div className="flex flex-col gap-2">
          {BALANCES.map((balance) => (
            <div key={balance.memberId} className="flex items-center gap-2">
              <Avatar name={NAMES.get(balance.memberId) ?? "?"} size="xs" />
              <span className="text-sm font-bold text-ink">
                {NAMES.get(balance.memberId)}
              </span>
              <span className="ml-auto font-display text-xs text-ink-soft">
                paid {formatPaiseShort(balance.paidPaise)} · share{" "}
                {formatPaiseShort(balance.sharePaise)}
              </span>
              <span
                className={
                  balance.netPaise > 0
                    ? "font-display text-xs text-forest"
                    : "font-display text-xs text-hotpink-deep"
                }
              >
                {balance.netPaise > 0
                  ? `+${formatPaiseShort(balance.netPaise)}`
                  : formatPaiseShort(balance.netPaise)}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t-2 border-dashed border-silver-deep pt-3">
          <p className="font-display text-[9px] uppercase tracking-tight text-ink-soft">
            Fewest payments to square up
          </p>
          <div className="flex w-full flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-ink">You</span>
            <span className="text-ink-soft">pays</span>
            <span className="text-sm font-bold text-ink">Ravi</span>
            <span className="ml-auto font-display text-xs text-electric">
              {formatPaise(180000)}
            </span>
            <span
              title="Ravi's payment QR"
              className="size-7 shrink-0 overflow-hidden rounded-lg border-2 border-silver-deep bg-white shadow-sticker"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={MOCK_QR} alt="Ravi's payment QR" className="size-full object-contain" />
            </span>
            <button type="button" className={buttonClass({ variant: "pop", size: "sm" })}>
              Pay
            </button>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-ink">Dev</span>
            <span className="text-ink-soft">pays</span>
            <span className="text-sm font-bold text-ink">you</span>
            <span className="ml-auto font-display text-xs text-electric">
              {formatPaise(260000)}
            </span>
            <button type="button" className={buttonClass({ variant: "ghost", size: "sm" })}>
              Log promise
            </button>
          </div>
          <p className="text-xs font-semibold text-ink-soft">
            The person who owes sees their creditor&apos;s QR and a one-tap
            &quot;I paid&quot;; everybody else can only log a promise.
          </p>
        </div>
      </Block>

      <Block
        title="Settlement statuses"
        blurb="Promised, paid, settled — and the taps only the two of them, or the owner, get."
      >
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-1.5">
            {(["pending", "paid", "confirmed"] as const).map((status) => (
              <Badge
                key={status}
                tone={
                  status === "pending" ? "sunny" : status === "paid" ? "pop" : "bubble"
                }
              >
                {SETTLEMENT_STATUS_LABELS[status]}
              </Badge>
            ))}
          </div>
          {SETTLEMENTS.map((settlement) => (
            <SettlementRow
              key={settlement.id}
              settlement={settlement}
              names={NAMES}
              viewerId="m1"
              isOwner
              editable
            />
          ))}
        </div>
      </Block>

      <Block
        title="Expense row and filters"
        blurb="What it was, who covered it, and how it was split."
      >
        <Tabs
          value={tab}
          onValueChange={setTab}
          items={[
            { value: "all", label: "All" },
            { value: "stay", label: "Stay" },
            { value: "food", label: "Food" },
          ]}
        />
        {(["all", "stay", "food"] as const).map((value) => (
          <TabPanel key={value} when={value} active={tab}>
            <div className="flex flex-col gap-1.5">
              {EXPENSES.filter(
                (expense) => value === "all" || expense.category === value,
              ).map((expense) => (
                <div
                  key={expense.id}
                  className="flex items-center gap-2 rounded-2xl border-2 border-silver-deep bg-white/70 px-3 py-2"
                >
                  <Avatar name={NAMES.get(expense.payer_id) ?? "?"} size="xs" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-ink">
                      {expense.note}
                    </p>
                    <p className="font-display text-[9px] uppercase tracking-tight text-ink-soft">
                      {CATEGORY_LABELS[expense.category]} ·{" "}
                      {NAMES.get(expense.payer_id)} paid · {SHARES.size} way split
                    </p>
                  </div>
                  <span className="ml-auto font-display text-xs text-ink">
                    {formatPaise(expense.amount_paise)}
                  </span>
                  <button
                    type="button"
                    className={buttonClass({ variant: "ghost", size: "sm" })}
                  >
                    Edit
                  </button>
                </div>
              ))}
              {EXPENSES.filter(
                (expense) => value === "all" || expense.category === value,
              ).length === 0 ? (
                <EmptyState
                  illustration="coins"
                  title="Nothing in this pile"
                  description="Filter says no, not the ledger."
                />
              ) : null}
            </div>
          </TabPanel>
        ))}
      </Block>
    </>
  );
}