"use server";

import { revalidatePath } from "next/cache";
import { failed, runAction, type ActionState } from "@/lib/actions/state";
import { isOwner, requireSession } from "@/lib/auth/context";
import { hashPin } from "@/lib/auth/password";
import { rotateInviteCode } from "@/lib/auth/service";
import { clearSessionCookie } from "@/lib/auth/session";
import { getSupabase } from "@/lib/db/client";
import { fieldErrorsOf, formToObject, resetPinSchema } from "@/lib/validation/auth";

export async function logoutAction(): Promise<void> {
  await clearSessionCookie();
  revalidatePath("/", "layout");
}

export async function rotateInviteCodeAction(): Promise<ActionState> {
  return runAction(async () => {
    const context = await requireSession();
    if (!isOwner(context)) {
      return failed("Only the trip owner can rotate the invite code.");
    }
    await rotateInviteCode(context.trip.id);
    revalidatePath("/trip");
    return { ok: true };
  });
}

export async function resetPinAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const context = await requireSession();
    if (!isOwner(context)) {
      return failed("Only the trip owner can reset a PIN.");
    }

    const parsed = resetPinSchema.safeParse(formToObject(formData));
    if (!parsed.success) {
      return { fieldErrors: fieldErrorsOf(parsed.error) };
    }

    const supabase = getSupabase();
    const { data: target, error: lookupError } = await supabase
      .from("members")
      .select("id, trip_id, role")
      .eq("id", parsed.data.memberId)
      .maybeSingle();
    if (lookupError) return failed(lookupError.message);
    if (!target || target.trip_id !== context.trip.id) {
      return failed("That member is not in your trip.");
    }
    if (target.role === "owner") {
      return failed("The owner's PIN is changed from their own device.");
    }

    // Resetting a PIN also lifts any lockout, otherwise the member stays locked out
    // of the trip the owner just rescued them from.
    const { error } = await supabase
      .from("members")
      .update({
        pin_hash: await hashPin(parsed.data.pin),
        failed_attempts: 0,
        locked_until: null,
      })
      .eq("id", target.id);
    if (error) return failed(`Could not reset that PIN: ${error.message}`);

    revalidatePath("/trip");
    return { ok: true };
  });
}

export async function removeMemberAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const context = await requireSession();
    if (!isOwner(context)) {
      return failed("Only the trip owner can remove a member.");
    }

    const memberId = formData.get("memberId");
    if (typeof memberId !== "string") {
      return failed("Pick a member to remove.");
    }

    const supabase = getSupabase();
    const { data: target } = await supabase
      .from("members")
      .select("id, trip_id, role")
      .eq("id", memberId)
      .maybeSingle();
    if (!target || target.trip_id !== context.trip.id) {
      return failed("That member is not in your trip.");
    }
    if (target.role === "owner") {
      return failed("The owner cannot be removed. Transfer the trip first.");
    }

    const { error } = await supabase.from("members").delete().eq("id", memberId);
    if (error) return failed(`Could not remove that member: ${error.message}`);

    revalidatePath("/trip");
    return { ok: true };
  });
}
