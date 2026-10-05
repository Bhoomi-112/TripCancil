"use server";

import { revalidatePath } from "next/cache";
import { failed, runAction, type ActionState } from "@/lib/actions/state";
import { getSessionContext, requireSession } from "@/lib/auth/context";
import { searchPlaces } from "@/lib/maps/nominatim";
import {
  addPlaceToDay,
  addSearchResultToDay,
  proposePlace,
} from "@/lib/maps/service";
import { formToObject } from "@/lib/validation/auth";
import {
  placeToDaySchema,
  proposePlaceSchema,
  searchResultToDaySchema,
} from "@/lib/validation/places";

/** Search is read-only, so it only needs a session, never an editable trip. */
export async function searchPlacesAction(query: string): Promise<ActionState> {
  return runAction(async () => {
    const context = await getSessionContext();
    if (!context) return failed("Session expired");

    const results = await searchPlaces(query);
    return { ok: true, payload: results } as ActionState;
  });
}

/** Puts a pin on the map as a candidate. Not in any day yet. */
export async function proposePlaceAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const context = await requireSession();

    const parsed = proposePlaceSchema.safeParse(formToObject(formData));
    if (!parsed.success) {
      return failed(
        "That spot could not be read.",
        parsed.error.flatten().fieldErrors as Record<string, string>,
      );
    }

    const placeId = await proposePlace(context, parsed.data);
    revalidatePath("/map");
    return { ok: true, payload: { placeId } };
  });
}

/** Pins an existing map place onto a day from its popup. */
export async function addPlaceToDayAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const context = await requireSession();

    const parsed = placeToDaySchema.safeParse(formToObject(formData));
    if (!parsed.success) {
      return failed(
        "That day could not be read.",
        parsed.error.flatten().fieldErrors as Record<string, string>,
      );
    }

    await addPlaceToDay(context, parsed.data);
    // The stop shows up on the plan board as well as the map.
    revalidatePath("/map");
    revalidatePath("/plan");
    return { ok: true };
  });
}

/** Creates a pin from a search hit and drops it into a day in one go. */
export async function addSearchResultToDayAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const context = await requireSession();

    const parsed = searchResultToDaySchema.safeParse(formToObject(formData));
    if (!parsed.success) {
      return failed(
        "That spot could not be read.",
        parsed.error.flatten().fieldErrors as Record<string, string>,
      );
    }

    await addSearchResultToDay(context, parsed.data);
    revalidatePath("/map");
    revalidatePath("/plan");
    return { ok: true };
  });
}