import { Avatar, AvatarStack } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Button,
  ButtonLink,
  IconButton,
} from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { PinInput } from "@/components/auth/pin-input";
import { QrCode } from "@/components/auth/qr-code";
import { EmptyState } from "@/components/ui/empty-state";
import {
  ChevronRightIcon,
  HeartIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  SparkleIcon,
  TrashIcon,
  UploadIcon,
} from "@/components/ui/icons";
import { Modal } from "@/components/ui/modal";
import { Skeleton, SkeletonCard, SkeletonText } from "@/components/ui/skeleton";
import { TabPanel, Tabs } from "@/components/ui/tabs";
import { ToastInfo, useToast } from "@/components/ui/toast";
import { Window } from "@/components/ui/window";
import { useState, type ReactNode } from "react";

function Section({
  title,
  blurb,
  children,
}: {
  title: string;
  blurb: string;
  children: ReactNode;
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

const swatches = [
  { name: "cream", token: "--color-cream", hex: "#fff4e2" },
  { name: "ink", token: "--color-ink", hex: "#251a42" },
  { name: "electric", token: "--color-electric", hex: "#2f49ff" },
  { name: "hotpink", token: "--color-hotpink", hex: "#ff3d9a" },
  { name: "lime", token: "--color-lime", hex: "#ccff3d" },
  { name: "cyan", token: "--color-cyan", hex: "#3ee0ff" },
  { name: "grape", token: "--color-grape", hex: "#7c3aed" },
  { name: "silver", token: "--color-silver", hex: "#e4eaf4" },
  { name: "sunny", token: "--color-sunny", hex: "#ffc53d" },
];

export function FoundationsSection() {
  return (
    <Section
      title="Foundations"
      blurb="Palette tokens, pixel display font, rounded body font, Y2K surface treatments."
    >
      <div className="space-y-5">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {swatches.map((swatch) => (
            <div key={swatch.name} className="space-y-1">
              <div
                className="gloss h-14 rounded-2xl border-2 border-ink/15"
                style={{ backgroundColor: `var(${swatch.token})` }}
              />
              <p className="font-display text-[8px] uppercase tracking-tight text-ink">
                {swatch.name}
              </p>
              <p className="text-[10px] font-bold text-ink-soft">{swatch.hex}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="iridescent rounded-window p-4 shadow-window">
            <p className="font-display text-xs uppercase tracking-tight text-white drop-shadow-[0_1px_0_rgb(37_26_66/0.35)]">
              Iridescent
            </p>
            <p className="text-sm font-bold text-white/90">
              Soft holographic wash for hero bands
            </p>
          </div>
          <div className="dotted-grid scanlines rounded-window border-2 border-silver-deep bg-cream p-4">
            <p className="font-display text-xs uppercase tracking-tight text-ink">
              Dotted grid + CRT scanlines
            </p>
            <p className="text-sm font-semibold text-ink-soft">
              Retro texture without hurting contrast
            </p>
          </div>
        </div>

        <div className="rounded-window border-2 border-silver-mid bg-white/70 p-4">
          <p className="chrome-text font-display text-2xl uppercase leading-8 tracking-tight">
            Chrome text
          </p>
          <p className="mt-2 text-base font-bold text-ink">
            Body copy sits in Nunito at weight 700 — rounded, friendly, readable at
            360px. Display copy uses Press Start 2P for the arcade feel.
          </p>
        </div>
      </div>
    </Section>
  );
}

export function ButtonSection() {
  return (
    <Section
      title="Buttons"
      blurb="Glossy bubble buttons: six tones, four sizes, loading, icon and link flavours."
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary">Electric</Button>
          <Button variant="accent">Hot pink</Button>
          <Button variant="pop">Lime pop</Button>
          <Button variant="chrome">Chrome</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg" sparkle>
            Big sparkle
          </Button>
          <IconButton label="Add stop">
            <PlusIcon className="size-5" />
          </IconButton>
          <IconButton label="Edit" variant="chrome">
            <PencilIcon className="size-4" />
          </IconButton>
          <IconButton label="Delete" variant="danger">
            <TrashIcon className="size-4" />
          </IconButton>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="accent" loading>
            Splitting
          </Button>
          <Button variant="primary" disabled>
            Disabled
          </Button>
          <Button variant="ghost" disabled>
            Disabled ghost
          </Button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button variant="primary" block>
            Block button
          </Button>
          <ButtonLink href="/plan" variant="pop" block>
            Button as link
            <ChevronRightIcon className="size-4" />
          </ButtonLink>
        </div>
      </div>
    </Section>
  );
}

export function WindowSection() {
  return (
    <Section
      title="Windows"
      blurb="Faux window chrome with a title bar, three dots, optional icon, actions and footer."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Window
          title="itinerary.day1"
          icon={<Badge tone="bubble">3 stops</Badge>}
          actions={
            <IconButton label="Add item" size="sm" className="size-7">
              <PlusIcon className="size-3.5" />
            </IconButton>
          }
          footer={
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-ink-soft">Day 1 · Beach</span>
              <AvatarStack names={["Bhoomi", "Ravi"]} size="xs" />
            </div>
          }
        >
          <p className="text-sm font-semibold text-ink">
            Cream tone for everyday content cards.
          </p>
        </Window>

        <Window title="map.layer" tone="chrome" actions={<Badge tone="ink">live</Badge>}>
          <p className="text-sm font-semibold text-ink">
            Chrome tone for map and media panels.
          </p>
        </Window>

        <Window title="dark.mode" tone="ink" className="md:col-span-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="pop">scanline</Badge>
            <Badge tone="bubble">glow</Badge>
            <Badge tone="chrome">CRT</Badge>
            <p className="text-sm font-semibold text-cream/80">
              Ink tone for contrast moments and recaps.
            </p>
          </div>
        </Window>
      </div>
    </Section>
  );
}

export function FormSection() {
  return (
    <Section
      title="Inputs"
      blurb="Fields with labels, hints, error states, disabled state and text areas."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-4">
          <Field label="Trip name" htmlFor="d-name">
            <Input id="d-name" defaultValue="Konkan coast run" />
          </Field>
          <Field label="Destination" htmlFor="d-dest" hint="Searched on the map next">
            <Input id="d-dest" placeholder="Lonavala" />
          </Field>
          <Field label="Invite code" htmlFor="d-code" error="No trip matches that code">
            <Input id="d-code" defaultValue="TRIP-404" invalid />
          </Field>
        </div>
        <div className="space-y-4">
          <Field label="Day" htmlFor="d-day" hint="Native select, chips on the Plan tab">
            <Select id="d-day" defaultValue="1">
              <option value="0">Day 1 · Fri 12 Sep</option>
              <option value="1">Day 2 · Sat 13 Sep</option>
              <option value="2">Day 3 · Sun 14 Sep</option>
            </Select>
          </Field>
          <Field label="Notes" htmlFor="d-notes">
            <Textarea
              id="d-notes"
              defaultValue="Sunset at Lingmala, then drive back before the toll queue."
            />
          </Field>
          <Field label="Locked" htmlFor="d-off">
            <Input id="d-off" defaultValue="Owner only" disabled />
          </Field>
          <div className="flex items-center gap-2 rounded-2xl border-2 border-silver-deep bg-white/85 px-3.5 py-2.5 shadow-[inset_0_2px_4px_rgb(37_26_66/0.08)]">
            <SearchIcon className="size-5 shrink-0 text-ink-soft" />
            <span className="text-base font-bold text-ink-soft">
              Search a place…
            </span>
          </div>
        </div>
      </div>
    </Section>
  );
}

export function AuthSection() {
  return (
    <Section
      title="Auth bits"
      blurb="The PIN pad, the invite code plate and the QR that carries it. Every join and login screen is built from these."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-4">
          <Field label="6-digit PIN" htmlFor="d-pin" hint="Pick one if you are new.">
            <PinInput name="d-pin" defaultValue="1234" readOnly />
          </Field>
          <Field
            label="Wrong PIN"
            htmlFor="d-pin-bad"
            error="That PIN is not right. 3 tries left."
          >
            <PinInput name="d-pin-bad" defaultValue="9999" invalid readOnly />
          </Field>
        </div>
        <div className="space-y-3">
          <p className="break-all rounded-2xl border-2 border-dashed border-electric/50 bg-electric/5 px-3 py-2 text-center font-display text-lg tracking-[0.2em] text-electric-deep">
            KONKAN7X4QP2M
          </p>
          <div className="flex items-center gap-3">
            <QrCode
              value="https://trip-cancil.vercel.app/join?code=KONKAN7X4QP2M"
              className="w-32 shrink-0 rounded-2xl border-2 border-silver-deep shadow-sticker"
            />
            <p className="text-sm font-semibold text-ink-soft">
              Scans straight into the join form with the code prefilled. Drawn as SVG
              paths, so it stays crisp and picks up the palette.
            </p>
          </div>
        </div>
      </div>
    </Section>
  );
}

export function BadgeSection() {
  const tones = ["pop", "bubble", "grape", "chrome", "ink", "sunny"] as const;
  return (
    <Section
      title="Badges & stickers"
      blurb="Tight pills for status, die-cut stickers for personality."
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {tones.map((tone) => (
            <Badge key={tone} tone={tone}>
              {tone}
            </Badge>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone="bubble" sticker icon={<HeartIcon className="size-3" />}>
            liked
          </Badge>
          <Badge tone="pop" sticker>
            packing done
          </Badge>
          <Badge tone="sunny" sticker>
            over cap
          </Badge>
          <Badge tone="grape" sticker icon={<SparkleIcon className="size-3" />}>
            locked in
          </Badge>
        </div>
      </div>
    </Section>
  );
}

export function TabsSection() {
  const [tab, setTab] = useState("all");
  return (
    <Section
      title="Tabs"
      blurb="Segmented chrome rail, controlled or uncontrolled, with panels."
    >
      <Tabs
        value={tab}
        onValueChange={setTab}
        items={[
          { value: "all", label: "Everything" },
          { value: "food", label: "Food", badge: <Badge tone="pop">12</Badge> },
          { value: "stay", label: "Stay" },
          { value: "rides", label: "Rides" },
        ]}
      />
      <div className="mt-4">
        <TabPanel when="all" active={tab}>
          <p className="text-sm font-semibold text-ink">
            All 31 expenses across 4 members.
          </p>
        </TabPanel>
        <TabPanel when="food" active={tab}>
          <p className="text-sm font-semibold text-ink">
            12 food expenses · ₹4,120 all in.
          </p>
        </TabPanel>
        <TabPanel when="stay" active={tab}>
          <p className="text-sm font-semibold text-ink">2 hotel bookings and 1 villa night.</p>
        </TabPanel>
        <TabPanel when="rides" active={tab}>
          <p className="text-sm font-semibold text-ink">17 rides and tolls.</p>
        </TabPanel>
      </div>
    </Section>
  );
}

export function AvatarSection() {
  return (
    <Section
      title="Avatars"
      blurb="Deterministic colours per name, presence dot, and stacks for member lists."
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Avatar name="Bhoomi Awhad" size="xs" />
          <Avatar name="Ravi Kumar" size="sm" online />
          <Avatar name="Sana Qureshi" size="md" />
          <Avatar name="Dev Patel" size="lg" online />
          <Avatar name="Ila Nair" size="xl" />
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <AvatarStack names={["Bhoomi", "Ravi", "Sana", "Dev"]} />
          <AvatarStack names={["Bhoomi", "Ravi", "Sana", "Dev", "Ila", "Nikhil", "Tara"]} max={4} size="md" />
        </div>
      </div>
    </Section>
  );
}

export function ModalSection() {
  const [size, setSize] = useState<"sm" | "md" | "lg" | null>(null);
  return (
    <Section
      title="Modal"
      blurb="Bottom sheet on mobile, floating window on desktop. Escape closes."
    >
      <div className="flex flex-wrap gap-2">
        {(["sm", "md", "lg"] as const).map((value) => (
          <Button key={value} variant="chrome" onClick={() => setSize(value)}>
            Open {value}
          </Button>
        ))}
        <Button variant="ghost" onClick={() => setSize("md")}>
          Open with footer
        </Button>
      </div>
      <Modal
        open={size !== null}
        onClose={() => setSize(null)}
        title="Lock this place in"
        description="The winner becomes an itinerary item and the pin turns solid."
        size={size ?? "md"}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setSize(null)}>
              Not yet
            </Button>
            <Button variant="pop" onClick={() => setSize(null)} sparkle>
              Lock it in
            </Button>
          </div>
        }
      >
        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-2xl border-2 border-lime-deep bg-lime/70 px-3 py-2">
            <span className="text-sm font-extrabold text-ink">Tiger Hill</span>
            <Badge tone="ink">+3 votes</Badge>
          </div>
          <div className="flex items-center justify-between rounded-2xl border-2 border-silver-deep bg-white/70 px-3 py-2">
            <span className="text-sm font-bold text-ink">Lonavala bus stand</span>
            <Badge tone="chrome">+1 vote</Badge>
          </div>
        </div>
      </Modal>
    </Section>
  );
}

export function ToastSection() {
  const toast = useToast();
  return (
    <Section
      title="Toasts"
      blurb="Stacked, auto-dismiss after 3.6s, never covering the tab bar."
    >
      <div className="flex flex-wrap gap-2">
        <Button variant="pop" onClick={() => toast.success("Expense split saved")}>
          Success
        </Button>
        <Button variant="primary" onClick={() => toast.info("Poll synced · 5 new edits")}>
          Info
        </Button>
        <Button variant="accent" onClick={() => toast.warn("Food cap crossed by ₹400")}>
          Warning
        </Button>
        <Button variant="danger" onClick={() => toast.error("Wrong PIN · 4 tries left")}>
          Error
        </Button>
      </div>
      <div className="mt-3">
        <ToastInfo>Fire a few in a row to see the stack cap.</ToastInfo>
      </div>
    </Section>
  );
}

export function LoadingSection() {
  return (
    <Section
      title="Skeletons"
      blurb="Shimmering placeholders used while SWR polls the first time."
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton circle className="size-12" />
          <div className="flex-1">
            <SkeletonText lines={2} />
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    </Section>
  );
}

export function EmptyStateSection() {
  return (
    <Section
      title="Empty states"
      blurb="Pixel illustrations, one per situation the app can be empty in."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <EmptyState
          illustration="beach"
          title="No stops yet"
          description="Add a place from the map or type one in."
        />
        <EmptyState
          illustration="map"
          title="Nothing pinned"
          description="Search a place to drop the first pin."
        />
        <EmptyState
          illustration="camera"
          title="Album is empty"
          description="Booth exports land here automatically."
        />
        <EmptyState
          illustration="coins"
          title="No expenses yet"
          description="Log the first chai run to start the ledger."
        />
        <EmptyState
          illustration="suitcase"
          title="Packing list is bare"
          description="Seed a starter list from your destination type."
        />
        <EmptyState
          illustration="cloud"
          title="Nothing to preview"
          description="Upload a ticket or ID to see it here."
        />
      </div>
    </Section>
  );
}

export function ShellSection() {
  return (
    <Section
      title="App shell"
      blurb="Bottom tab bar under 768px, sidebar above it. Open a real tab to try it."
    >
      <div className="flex flex-wrap items-center gap-2">
        <ButtonLink href="/plan" variant="primary" size="lg" sparkle>
          Open the Plan tab
          <ChevronRightIcon className="size-5" />
        </ButtonLink>
        <ButtonLink href="/design" variant="ghost" size="lg">
          <UploadIcon className="size-5" />
          Back to design
        </ButtonLink>
      </div>
      <div className="relative mt-4 h-24 overflow-hidden rounded-window border-2 border-ink/10 bg-linear-to-b from-white to-silver">
        {Array.from({ length: 9 }, (_, index) => (
          <SparkleIcon
            key={index}
            className="absolute size-4 animate-twinkle text-hotpink"
            style={{
              left: `${(index * 11) % 92}%`,
              top: `${(index * 23) % 80}%`,
              animationDelay: `${index * 0.22}s`,
            }}
          />
        ))}
        <p className="absolute inset-x-0 bottom-3 text-center font-display text-[10px] uppercase tracking-tight text-ink">
          sparkle layer · twinkle loop · reduced-motion safe
        </p>
      </div>
      <p className="mt-3 text-xs font-semibold text-ink-soft">
        Preview widths: 360px and 1280px. Every component above is responsive by
        default.
      </p>
    </Section>
  );
}
