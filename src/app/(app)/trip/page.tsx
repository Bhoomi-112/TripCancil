import { AvatarStack } from "@/components/ui/avatar";
import { ScreenHeader } from "@/components/shell/screen-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export default function TripPage() {
  return (
    <>
      <ScreenHeader
        title="Trip"
        subtitle="Members, invite code and settings land in the next prompts"
        actions={<AvatarStack names={["Bhoomi", "Ravi", "Sana", "Dev", "Ila", "Nikhil"]} />}
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <Badge tone="grape" sticker>
          Owner tools
        </Badge>
        <Badge tone="chrome">Rotate invite</Badge>
      </div>
      <EmptyState
        illustration="suitcase"
        title="Trip setup comes next"
        description="Create a trip, share the invite code, and everyone joins with a name and a 6-digit PIN."
      />
    </>
  );
}
