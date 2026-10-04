import "server-only";

import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";
import { env } from "@/lib/env";

export const SESSION_COOKIE = "tc_session";
export const SESSION_TTL_DAYS = 14;
export const SESSION_TTL_SECONDS = SESSION_TTL_DAYS * 24 * 60 * 60;

export type SessionPayload = {
  memberId: string;
  tripId: string;
};

function secretKey(): Uint8Array {
  return new TextEncoder().encode(env.sessionSecret);
}

/**
 * The token deliberately carries nothing but the two ids. Role and display name
 * are re-read from the database on every request so an owner change or a removed
 * member takes effect immediately instead of living on for 14 days.
 */
export async function signSession({
  memberId,
  tripId,
}: SessionPayload): Promise<string> {
  return new SignJWT({ trip_id: tripId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(memberId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_DAYS}d`)
    .setJti(crypto.randomUUID())
    .sign(secretKey());
}

export async function readSessionToken(
  token: string | undefined,
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      algorithms: ["HS256"],
    });
    if (!payload.sub || typeof payload.trip_id !== "string") return null;
    return { memberId: payload.sub, tripId: payload.trip_id };
  } catch {
    // Expired, tampered with, or signed by an older secret: treat as signed out.
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  return readSessionToken(store.get(SESSION_COOKIE)?.value);
}

export async function setSessionCookie(payload: SessionPayload): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, await signSession(payload), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
