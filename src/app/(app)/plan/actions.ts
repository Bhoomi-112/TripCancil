"use server";

import { revalidatePath } from "next/cache";
import { failed, runAction, type ActionState } from "@/lib/actions/state";
import { requireSession } from "@/lib/auth/context";
import {
  createItem,
  deleteItem,
  ItineraryError,
  reorderDay,
  updateItem,
} from "@/lib/itinerary/service";
import {
  deleteItineraryItemSchema,
  itineraryItemSchema,
  reorderDaySchema,
  updateItineraryItemSchema,
} from "@/lib/validation/itinerary";
import { fieldErrorsOf, formToObject } from "@/lib/validation/auth";

export async function createItineraryItemAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const context = await requireSession();

    const parsed = itineraryItemSchema.safeParse(formToObject(formData));
    if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

    try {
      await createItem(context, parsed.data);
    } catch (error) {
      if (error instanceof ItineraryError) return failed(error.message);
      throw error;
    }

    revalidatePath("/plan");
    return { ok: true };
  });
}

export async function updateItineraryItemAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const context = await requireSession();

    const parsed = updateItineraryItemSchema.safeParse(formToObject(formData));
    if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

    const { itemId, ...input } = parsed.data;
    try {
      await updateItem(context, itemId, input);
    } catch (error) {
      if (error instanceof ItineraryError) return failed(error.message);
      throw error;
    }

    revalidatePath("/plan");
    return { ok: true };
  });
}

export async function deleteItineraryItemAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const context = await requireSession();

    const parsed = deleteItineraryItemSchema.safeParse(formToObject(formData));
    if (!parsed.success) return { fieldErrors: fieldErrorsOf(parsed.error) };

    try {
      await deleteItem(context, parsed.data.itemId);
    } catch (error) {
      if (error instanceof ItineraryError) return failed(error.message);
      throw error;
    }

    revalidatePath("/plan");
    return { ok: true };
  });
}

/**
 * Drag-and-drop lands here. It takes plain arguments rather than FormData so the
 * board can fire it from an event handler while keeping the same optimistic
 * shape as the other actions.
 */
export async function reorderItineraryDayAction(
  _previous: ActionState,
  dayIndex: number,
  itemIds: string[],
): Promise<ActionState> {
  return runAction(async () => {
    const context = await requireSession();

    const parsed = reorderDaySchema.safeParse({ dayIndex, itemIds });
    if (!parsed.success) return failed(parsed.error.issues[0].message);

    try {
      await reorderDay(context, parsed.data.dayIndex, parsed.data.itemIds);
    } catch (error) {
      if (error instanceof ItineraryError) return failed(error.message);
      throw error;
    }

    revalidatePath("/plan");
    return { ok: true };
  });
}