import { ScreenHeader } from "@/components/shell/screen-header";
import { Badge } from "@/components/ui/badge";
import { requireSession } from "@/lib/auth/context";
import { tripHasEnded } from "@/lib/constants";
import { readMoney } from "@/lib/money/service";
import { MoneyBoard } from "./money-board";

export default async function MoneyPage() {
  const { trip, member } = await requireSession();
  const ended = tripHasEnded(trip.end_date);

  const payload = await readMoney(trip.id);

  return (
    <>
      <ScreenHeader
        title="Money"
        subtitle={
          ended ? "The ledger as it was left" : "Who paid, who owes, who settled"
        }
        badge={ended ? "Read-only" : undefined}
      />
      {!ended ? (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge tone="bubble" sticker>
            Paise only
          </Badge>
          <Badge tone="pop">Never floats</Badge>
          <Badge tone="chrome">Soft deletes</Badge>
        </div>
      ) : null}
      <MoneyBoard
        tripId={trip.id}
        viewerId={member.id}
        isOwner={member.role === "owner"}
        editable={!ended}
        initial={payload}
        startDate={trip.start_date}
        endDate={trip.end_date}
        today={new Date().toISOString().slice(0, 10)}
      />
    </>
  );
}