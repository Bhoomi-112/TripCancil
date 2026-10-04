"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

export function CopyInviteButton({
  code,
  shareUrl,
  label = "Copy invite link",
}: {
  code: string;
  shareUrl: string;
  label?: string;
}) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      toast.error("Could not reach the clipboard. Copy the code instead.");
      return;
    }
    setCopied(true);
    toast.success(`Invite ${code} copied.`);
    setTimeout(() => setCopied(false), 2000);
  }

  async function share() {
    if (!navigator.share) {
      await copy();
      return;
    }
    await navigator.share({
      title: "Join our trip",
      text: `Join our trip on TripCancil with invite code ${code}`,
      url: shareUrl,
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="primary" onClick={copy} sparkle>
        {copied ? "Copied!" : label}
      </Button>
      <Button type="button" variant="chrome" onClick={share}>
        Share
      </Button>
    </div>
  );
}
