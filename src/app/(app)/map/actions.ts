"use server";

import { revalidatePath } from "next/cache";
import { failed, runAction, type ActionState } from "@/lib/actions/state";
import { getSessionContext, requireSession } from "@/lib/auth/context";
import { getSupabase } from "@/lib/db/client";
import { searchPlaces } from "@/lib/maps/nominatim";
import { createPlaceSchema, formToObject } from "@/lib/validation/places";

export async function addPlaceAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const { member, trip } = await requireSession();

    const parsed = createPlaceSchema.safeParse(formToObject(formData));
    if (!parsed.success) {
      return { fieldErrors: parsed.error.flatten().fieldErrors };
    }

    const supabase = getSupabase();
    const { error } = await supabase.from("places").insert({
      trip_id: trip.id,
      added_by_member_id: member.id,
      name: parsed.data.name,
      lat: parseFloat(parsed.data.lat),
      lng: parseFloat(parsed.data.lng),
      address: parsed.data.address || null,
      location_type: parsed.data.locationType,
      notes: parsed.data.notes || null,
    });

    if (error) return failed(error.message);
    revalidatePath("/map");
    return { ok: true };
  });
}

export async function searchPlacesAction(query: string): Promise<ActionState> {
  return runAction(async () => {
    const context = await getSessionContext();
    if (!context) return failed("Session expired");

    const results = await searchPlaces(query);
    return { ok: true, payload: results } as ActionState;
  });
}
