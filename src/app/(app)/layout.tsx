import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { ToastProvider } from "@/components/ui/toast";
import { requireSession } from "@/lib/auth/context";

export default async function AppLayout({ children }: { children: ReactNode }) {
  // requireSession redirects to /join when there is no valid, still-member cookie.
  const { member, trip } = await requireSession();

  return (
    <ToastProvider>
      <AppShell displayName={member.display_name} tripName={trip.name}>
        {children}
      </AppShell>
    </ToastProvider>
  );
}
