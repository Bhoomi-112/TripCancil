"use server";

import { failed, runAction, type ActionState } from "@/lib/actions/state";
import { AuthError, createTrip, joinOrLogin } from "@/lib/auth/service";
import { getClientIp } from "@/lib/auth/rate-limit";
import { setSessionCookie } from "@/lib/auth/session";
import { ensureTraveller } from "@/lib/traveller/session";
import {
  createTripSchema,
  fieldErrorsOf,
  formToObject,
  joinSchema,
} from "@/lib/validation/auth";

export async function createTripAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const parsed = createTripSchema.safeParse(formToObject(formData));
    if (!parsed.success) {
      return { fieldErrors: fieldErrorsOf(parsed.error) };
    }

    try {
      // Minting the traveller account first means the trip is filed under it from
      // the very first insert, so it shows up in "my trips" with nothing to claim.
      const travellerId = await ensureTraveller();
      const { trip, member } = await createTrip(parsed.data, travellerId);
      await setSessionCookie({ memberId: member.id, tripId: trip.id });
      return { ok: true, redirectTo: "/trip" };
    } catch (error) {
      if (error instanceof AuthError) {
        return failed(error.message, error.field ? { [error.field]: error.message } : undefined);
      }
      throw error;
    }
  });
}

export async function joinTripAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const parsed = joinSchema.safeParse(formToObject(formData));
    if (!parsed.success) {
      return { fieldErrors: fieldErrorsOf(parsed.error) };
    }

    try {
      const travellerId = await ensureTraveller();
      const { trip, member } = await joinOrLogin(
        parsed.data,
        await getClientIp(),
        travellerId,
      );
      await setSessionCookie({ memberId: member.id, tripId: trip.id });
      return { ok: true, redirectTo: "/plan" };
    } catch (error) {
      if (error instanceof AuthError) {
        return failed(error.message, error.field ? { [error.field]: error.message } : undefined);
      }
      throw error;
    }
  });
}
