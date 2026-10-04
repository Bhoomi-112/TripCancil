import { ScreenHeader } from "@/components/shell/screen-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Window } from "@/components/ui/window";

export default function PhotosPage() {
  return (
    <>
      <ScreenHeader
        title="Photos"
        subtitle="Photobooth engine and shared album land in the next prompts"
      />
      <Window title="album.preview" tone="chrome" icon={<Badge tone="bubble">booth</Badge>}>
        <EmptyState
          illustration="camera"
          title="Nothing shot yet"
          description="Pick up to four photos, pick a themed layout, export a strip."
        />
      </Window>
    </>
  );
}
