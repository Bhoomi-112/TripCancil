import "server-only";

import { getSupabase } from "@/lib/db/client";
import type { Member, Trip } from "./context";
import { generateInviteCode } from "./codes";
import { burnPinCompare, hashPin, verifyPin } from "./password";
import {
  activeLockout,
  clearFailedAttempts,
  isIpThrottled,
  LOCKOUT_MINUTES,
  MAX_MEMBER_FAILURES,
  recordFailedAttempt,
  recordUnknownAttempt,
} from "./rate-limit";
import type { CreateTripInput, JoinInput } from "@/lib/validation/auth";
import { claimMemberForTraveller } from "@/lib/traveller/service";

/** Safe to render: never carries a PIN, a hash, or which check failed. */
export class AuthError extends Error {
  field?: string;

  constructor(message: string, field?: string) {
    super(message);
    this.name = "AuthError";
    this.field = field;
  }
}

export type TripWithMember = { trip: Trip; member: Member };

export async function createTrip(
  input: CreateTripInput,
  travellerId?: string | null,
): Promise<TripWithMember> {
  const supabase = getSupabase();
  const pinHash = await hashPin(input.pin);

  // The invite code is minted here, so a collision with another trip's code has to
  // retry rather than surface as a unique violation.
  let trip: Trip | null = null;
  for (let attempt = 0; attempt < 5 && !trip; attempt += 1) {
    const inviteCode = generateInviteCode();
    const { data, error } = await supabase
      .from("trips")
      .insert({
        name: input.name,
        destination: input.destination,
        start_date: input.startDate,
        end_date: input.endDate,
        location_type: input.locationType,
        invite_code: inviteCode,
      })
      .select("*")
      .single();
    if (!error && data) trip = data;
    else if (error.code !== "23505") {
      throw new Error(`Could not create the trip: ${error.message}`);
    }
  }
  if (!trip) throw new Error("Could not mint a free invite code. Try again.");

  const { data: member, error: memberError } = await supabase
    .from("members")
    .insert({
      trip_id: trip.id,
      display_name: input.displayName,
      pin_hash: pinHash,
      role: "owner",
      traveler_id: travellerId ?? null,
    })
    .select("*")
    .single();
  if (memberError || !member) {
    throw new Error(`Could not add you as the owner: ${memberError?.message}`);
  }

  const { error: ownerError } = await supabase
    .from("trips")
    .update({ owner_member_id: member.id })
    .eq("id", trip.id);
  if (ownerError) throw new Error(`Could not set the trip owner: ${ownerError}`);

  return { trip: { ...trip, owner_member_id: member.id }, member };
}

async function findTripByInviteCode(inviteCode: string): Promise<Trip | null> {
  const { data } = await getSupabase()
    .from("trips")
    .select("*")
    .eq("invite_code", inviteCode)
    .maybeSingle();
  return data;
}

/** The unique constraint is case sensitive, so equality is not enough. */
async function findMemberByName(
  tripId: string,
  displayName: string,
): Promise<Member | null> {
  const { data } = await getSupabase()
    .from("members")
    .select("*")
    .eq("trip_id", tripId)
    .ilike("display_name", displayName)
    .limit(1)
    .maybeSingle();
  return data;
}

async function loadTripFor(member: Member): Promise<TripWithMember> {
  const { data: trip } = await getSupabase()
    .from("trips")
    .select("*")
    .eq("id", member.trip_id)
    .single();
  if (!trip) throw new Error("That trip no longer exists.");

  return { trip, member };
}

/** Signs in an existing member. Every rejection path costs the same time. */
export async function loginWithPin(
  input: JoinInput,
  ip: string,
  travellerId?: string | null,
): Promise<TripWithMember> {
  const { inviteCode, displayName, pin } = input;

  if (await isIpThrottled(ip)) {
    throw new AuthError(
      `Too many failed tries from this network. Wait ${LOCKOUT_MINUTES} minutes.`,
    );
  }

  const trip = await findTripByInviteCode(inviteCode);
  const member = trip ? await findMemberByName(trip.id, displayName) : null;

  if (!trip || !member) {
    await burnPinCompare(pin);
    await recordUnknownAttempt(ip);
    throw new AuthError(
      trip
        ? "No one in this trip goes by that name."
        : "That invite code does not match a trip.",
    );
  }

  const lockout = activeLockout(member);
  if (lockout) {
    await burnPinCompare(pin);
    throw new AuthError(
      `Too many wrong PINs. Try again in ${lockout.minutesLeft} minute${lockout.minutesLeft === 1 ? "" : "s"}.`,
      "pin",
    );
  }

  if (!(await verifyPin(pin, member.pin_hash))) {
    const { attempts, lockedUntil } = await recordFailedAttempt(member, ip);
    if (lockedUntil) {
      throw new AuthError(
        `Too many wrong PINs. Locked for ${LOCKOUT_MINUTES} minutes.`,
        "pin",
      );
    }
    const left = MAX_MEMBER_FAILURES - attempts;
    throw new AuthError(
      `That PIN is not right. ${left} ${left === 1 ? "try" : "tries"} left before a ${LOCKOUT_MINUTES}-minute lockout.`,
      "pin",
    );
  }

  await clearFailedAttempts(member.id);

  // The PIN is proven, so this membership can join the traveller account of the
  // device that just proved it. A row already claimed by another device is left
  // alone: first claim wins.
  if (travellerId && !member.traveler_id) {
    await claimMemberForTraveller(travellerId, member.id);
  }

  return loadTripFor({ ...member, failed_attempts: 0, locked_until: null });
}

/** Same code, same name, unknown member: joins instead of signing in. */
export async function joinOrLogin(
  input: JoinInput,
  ip: string,
  travellerId?: string | null,
): Promise<TripWithMember> {
  const trip = await findTripByInviteCode(input.inviteCode);
  if (!trip) {
    throw new AuthError("That invite code does not match a trip.", "inviteCode");
  }

  if (await findMemberByName(trip.id, input.displayName)) {
    return loginWithPin(input, ip, travellerId);
  }

  const supabase = getSupabase();
  const { data: member, error } = await supabase
    .from("members")
    .insert({
      trip_id: trip.id,
      display_name: input.displayName,
      pin_hash: await hashPin(input.pin),
      role: "member",
      traveler_id: travellerId ?? null,
    })
    .select("*")
    .single();
  if (error || !member) {
    throw new AuthError("Could not join that trip. Try again.", "displayName");
  }

  // Two simultaneous joins can both pass the name check, because the unique
  // constraint is case sensitive. The loser backs out instead of shadowing.
  const { count } = await supabase
    .from("members")
    .select("id", { count: "exact", head: true })
    .eq("trip_id", trip.id)
    .ilike("display_name", input.displayName);
  if ((count ?? 0) > 1) {
    await supabase.from("members").delete().eq("id", member.id);
    throw new AuthError(
      "Someone in this trip already goes by that name.",
      "displayName",
    );
  }

  return loadTripFor(member);
}

export async function rotateInviteCode(tripId: string): Promise<string> {
  const supabase = getSupabase();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const inviteCode = generateInviteCode();
    const { data, error } = await supabase
      .from("trips")
      .update({ invite_code: inviteCode })
      .eq("id", tripId)
      .select("invite_code")
      .single();
    if (!error && data) return data.invite_code;
    if (error.code !== "23505") throw new Error(error.message);
  }
  throw new Error("Could not mint a free invite code. Try again.");
}
