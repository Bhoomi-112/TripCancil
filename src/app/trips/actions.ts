"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { failed, runAction, type ActionState } from "@/lib/actions/state";
import { clearSessionCookie, setSessionCookie } from "@/lib/auth/session";
import { todayUtcISO } from "@/lib/constants";
import { fieldErrorsOf, formToObject } from "@/lib/validation/auth";
import {
  deleteTrip,
  tripAccessForTraveller,
  tripDetailsSchema,
  TripAdminError,
  updateTripDetails,
} from "@/lib/traveller/service";
import { clearTraveller, readTraveller } from "@/lib/traveller/session";

const tripIdSchema = z.string().uuid("Unknown trip.");

/**
 * One tap from "my trips" into a trip, with no PIN typed again. This is the
 * whole point of the traveller cookie, and also its risk: it is only ever handed
 * out after a membership row proves the traveller id, so the click can do nothing
 * the clicker could not already do by typing the PIN once.
 */
export async function openTripAction(formData: FormData): Promise<void> {
  const parsed = tripIdSchema.safeParse(formData.get("tripId"));
  if (!parsed.success) redirect("/trips");

  const travellerId = await readTraveller();
  if (!travellerId) redirect("/");

  const access = await tripAccessForTraveller(travellerId, parsed.data);
  if (!access) redirect("/trips");

  await setSessionCookie({ memberId: access.member.id, tripId: access.trip.id });
  redirect("/plan");
}

export async function updateTripAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const travellerId = await readTraveller();
    if (!travellerId) return failed("This device has been signed out.");

    const values = formToObject(formData);
    const tripId = tripIdSchema.safeParse(values.tripId);
    if (!tripId.success) return { fieldErrors: fieldErrorsOf(tripId.error) };

    const parsed = tripDetailsSchema.safeParse(values);
    if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

    const access = await tripAccessForTraveller(travellerId, tripId.data);
    if (!access) return failed("That trip is not on this device.");

    try {
      await updateTripDetails(access.trip, access.member, parsed.data, todayUtcISO());
    } catch (error) {
      if (error instanceof TripAdminError) return failed(error.message);
      throw error;
    }

    revalidatePath("/trips");
    revalidatePath("/trip");
    return { ok: true };
  });
}

export async function deleteTripAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const travellerId = await readTraveller();
    if (!travellerId) return failed("This device has been signed out.");

    const values = formToObject(formData);
    const tripId = tripIdSchema.safeParse(values.tripId);
    if (!tripId.success) return { fieldErrors: fieldErrorsOf(tripId.error) };

    const access = await tripAccessForTraveller(travellerId, tripId.data);
    if (!access) return failed("That trip is not on this device.");

    // Typing the name is the last stop on a trip that takes everyone else's
    // photos, expenses and documents with it.
    if (values.confirmName !== access.trip.name) {
      return {
        fieldErrors: {
          confirmName: `Type "${access.trip.name}" exactly to confirm.`,
        },
      };
    }

    try {
      await deleteTrip(access.trip, access.member, todayUtcISO());
    } catch (error) {
      if (error instanceof TripAdminError) return failed(error.message);
      throw error;
    }

    revalidatePath("/trips");
    return { ok: true };
  });
}

/** Signs this device out of every trip it remembers. */
export async function forgetDeviceAction(): Promise<void> {
  await clearSessionCookie();
  await clearTraveller();
  redirect("/");
}