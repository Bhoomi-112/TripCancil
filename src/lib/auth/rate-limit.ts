import "server-only";

import { headers } from "next/headers";
import { getSupabase } from "@/lib/db/client";
import type { Member } from "./context";

export const MAX_MEMBER_FAILURES = 5;
export const LOCKOUT_MINUTES = 15;
export const MAX_IP_FAILURES = 20;

const LOCKOUT_MS = LOCKOUT_MINUTES * 60 * 1000;
const IP_WINDOW_MS = LOCKOUT_MINUTES * 60 * 1000;

export type Lockout = { lockedUntil: string; minutesLeft: number };

export function activeLockout(
  member: Pick<Member, "locked_until">,
  now = Date.now(),
): Lockout | null {
  if (!member.locked_until) return null;
  const until = new Date(member.locked_until).getTime();
  if (Number.isNaN(until) || until <= now) return null;
  return {
    lockedUntil: member.locked_until,
    minutesLeft: Math.max(1, Math.ceil((until - now) / 60_000)),
  };
}

/** Vercel sets x-forwarded-for; x-real-ip and the platform fallbacks are for self-hosting. */
export async function getClientIp(): Promise<string> {
  const store = await headers();
  const forwarded = store.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || store.get("x-real-ip") || "unknown";
  return ip.slice(0, 64);
}

export async function isIpThrottled(ip: string): Promise<boolean> {
  const supabase = getSupabase();
  const since = new Date(Date.now() - IP_WINDOW_MS).toISOString();
  const { count } = await supabase
    .from("login_attempts")
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .gte("created_at", since);
  return (count ?? 0) >= MAX_IP_FAILURES;
}

/**
 * One failed attempt: append to the audit trail, bump the member's counter and
 * start a lockout on the fifth strike. The counter is written from the value the
 * caller read, so parallel guesses cannot race past the limit by resetting it.
 */
export async function recordFailedAttempt(
  member: Pick<Member, "id" | "failed_attempts">,
  ip: string,
): Promise<{ attempts: number; lockedUntil: string | null }> {
  const supabase = getSupabase();
  const attempts = member.failed_attempts + 1;
  const lockedUntil =
    attempts >= MAX_MEMBER_FAILURES
      ? new Date(Date.now() + LOCKOUT_MS).toISOString()
      : null;

  const { error } = await supabase
    .from("members")
    .update({
      failed_attempts: lockedUntil ? 0 : attempts,
      locked_until: lockedUntil,
    })
    .eq("id", member.id);
  if (error) throw new Error(`Could not update the attempt counter: ${error.message}`);

  await supabase.from("login_attempts").insert({ ip, member_id: member.id });

  return { attempts, lockedUntil };
}

export async function clearFailedAttempts(memberId: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("members")
    .update({ failed_attempts: 0, locked_until: null })
    .eq("id", memberId);
  if (error) throw new Error(`Could not clear the attempt counter: ${error.message}`);
}

/** An attempt that never resolved to a member still counts against the IP. */
export async function recordUnknownAttempt(ip: string): Promise<void> {
  await getSupabase().from("login_attempts").insert({ ip, member_id: null });
}
