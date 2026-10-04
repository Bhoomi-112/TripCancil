import "server-only";

import bcrypt from "bcryptjs";

/**
 * bcryptjs is pure JS, so a deliberately modest cost keeps login responsive
 * on a phone. The 6-digit PIN space is only 1e6, and every failure is rate
 * limited, so this is not the weak link.
 */
const COST = 10;

/** Compared against when the member does not exist, so a missing member costs
 * the same wall-clock time as a wrong PIN and cannot be timed apart. */
let decoyHashPromise: Promise<string> | undefined;

function decoyHash(): Promise<string> {
  decoyHashPromise ??= bcrypt.hash("000000", COST);
  return decoyHashPromise;
}

export function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, COST);
}

export async function verifyPin(pin: string, pinHash: string): Promise<boolean> {
  return bcrypt.compare(pin, pinHash);
}

/** Burns the same time as a real check. Always await this on the failure path. */
export async function burnPinCompare(pin: string): Promise<void> {
  await bcrypt.compare(pin, await decoyHash());
}
