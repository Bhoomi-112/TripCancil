"use client";

import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { SparkleIcon } from "@/components/ui/icons";
import { ToastProvider } from "@/components/ui/toast";
import {
  AuthSection,
  AvatarSection,
  BadgeSection,
  ButtonSection,
  EmptyStateSection,
  FormSection,
  FoundationsSection,
  LoadingSection,
  ModalSection,
  ShellSection,
  TabsSection,
  ToastSection,
  WindowSection,
} from "./sections";
import { MoneySection } from "./money-section";

const groups = [
  { label: "Foundations", Sections: [FoundationsSection] },
  { label: "Buttons", Sections: [ButtonSection] },
  { label: "Windows", Sections: [WindowSection] },
  { label: "Forms", Sections: [FormSection] },
  { label: "Auth", Sections: [AuthSection] },
  { label: "Badges", Sections: [BadgeSection] },
  { label: "Tabs", Sections: [TabsSection] },
  { label: "Avatars", Sections: [AvatarSection] },
  { label: "Modal", Sections: [ModalSection] },
  { label: "Toasts", Sections: [ToastSection] },
  { label: "Skeletons", Sections: [LoadingSection] },
  { label: "Empty states", Sections: [EmptyStateSection] },
  { label: "Money", Sections: [MoneySection] },
  { label: "Shell", Sections: [ShellSection] },
];

export default function DesignPage() {
  return (
    <ToastProvider>
      <div className="min-h-dvh pb-16">
        <header className="sticky top-0 z-30 border-b-2 border-silver-mid bg-cream/85 px-4 py-3 backdrop-blur-md">
          <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="gloss grid size-9 place-items-center rounded-2xl border-2 border-hotpink-deep bg-hotpink text-white shadow-bubble">
                <SparkleIcon className="size-5 animate-twinkle" />
              </span>
              <div>
                <h1 className="font-display text-sm uppercase leading-5 tracking-tight text-ink">
                  Design system
                </h1>
                <p className="text-xs font-semibold text-ink-soft">
                  Every Y2K component, every state
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone="pop">P2</Badge>
              <ButtonLink href="/join" variant="chrome" size="sm">
                Join screen
              </ButtonLink>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-4xl space-y-8 px-4 pt-6">
          {groups.map((group) => (
            <div key={group.label} className="space-y-3">
              {group.Sections.map((Section) => (
                <Section key={group.label} />
              ))}
            </div>
          ))}
        </main>
      </div>
    </ToastProvider>
  );
}
