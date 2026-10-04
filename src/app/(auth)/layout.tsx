import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { ToastProvider } from "@/components/ui/toast";
import { getSessionContext } from "@/lib/auth/context";

export default async function AuthLayout({ children }: { children: ReactNode }) {
  // Already signed in? The auth screens have nothing to offer.
  if (await getSessionContext()) redirect("/plan");

  return (
    <ToastProvider>
      <div className="dotted-grid flex min-h-dvh flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </ToastProvider>
  );
}
