import type { ReactNode } from "react";
import { ToastProvider } from "@/components/ui/toast";

export default async function AuthLayout({ children }: { children: ReactNode }) {
  // No bounce here on purpose: joining or starting a trip is how a traveller who
  // already belongs to another trip adds another membership, so these screens
  // must stay reachable while a session exists. The action that submits the form
  // simply mints the new trip's session over the current one.
  return (
    <ToastProvider>
      <div className="dotted-grid flex min-h-dvh flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </ToastProvider>
  );
}
