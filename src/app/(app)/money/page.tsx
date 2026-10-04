import { ScreenHeader } from "@/components/shell/screen-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export default function MoneyPage() {
  return (
    <>
      <ScreenHeader
        title="Money"
        subtitle="Budgets, splits and settle-up land in the next prompts"
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone="bubble" sticker>
          Paise only
        </Badge>
        <Badge tone="pop">Never floats</Badge>
        <Badge tone="chrome">Soft deletes</Badge>
      </div>
      <EmptyState
        illustration="coins"
        title="The money loop is next"
        description="Expenses split four ways, balances simplified, and QR codes shown for settling up."
      />
    </>
  );
}
