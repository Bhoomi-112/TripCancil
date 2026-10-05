import "server-only";

import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";
import { env } from "@/lib/env";
import { getSupabase } from "@/lib/db/client";

export const TRAVELLER_COOKIE = "tc_traveller";
export const TRAVELLER_TTL_DAYS = 180;
const TRAVELLER_TTL_SECONDS = TRAVELLER_TTL_DAYS * 24 * 60 * 60;

/**
 * The device-side half of a traveller account.
 *
 * A `travelers` row carries no email, no password and nothing to guess: the only
 * proof of ownership is this signed cookie, which is why it is httpOnly (script
 * cannot read it) and why every trip it unlocks is still re-checked against that
 * traveller's member rows on each request.
 *
 * This is deliberately NOT the trip session. A trip session (member_id + trip_id)
 * is what `/plan`, `/money` and every action require; the traveller cookie only
 * ever answers "which trips does this device belong to".
 */
async function signTraveller(travelerId: string): Promise<string> {
  return new SignJWT({ traveller_id: travelerId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(travelerId)
    .setIssuedAt()
    .setExpirationTime(`${TRAVELLER_TTL_DAYS}d`)
    .setJti(crypto.randomUUID())
    .sign(new TextEncoder().encode(env.sessionSecret));
}

export async function readTraveller(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(TRAVELLER_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(env.sessionSecret), {
      algorithms: ["HS256"],
    });
    if (typeof payload.traveller_id !== "string") return null;
    // A uuid in the wrong shape is a forged or truncated cookie, not a traveller.
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.traveller_id)) {
      return null;
    }
    return payload.traveller_id;
  } catch {
    return null;
  }
}

/** Returns this device's traveller, minting one the first time it is asked for. */
export async function ensureTraveller(): Promise<string> {
  const existing = await readTraveller();
  if (existing) return existing;

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("travelers")
    .insert({})
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(`Could not start a traveller account: ${error?.message}`);
  }

  const store = await cookies();
  store.set(TRAVELLER_COOKIE, await signTraveller(data.id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TRAVELLER_TTL_SECONDS,
  });
  return data.id;
}

export async function clearTraveller(): Promise<void> {
  const store = await cookies();
  store.delete(TRAVELLER_COOKIE);
}