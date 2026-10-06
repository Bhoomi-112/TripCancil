"use server";

import { revalidatePath } from "next/cache";
import { failed, runAction, type ActionState } from "@/lib/actions/state";
import { requireSession } from "@/lib/auth/context";
import {
  addPackingItem,
  deletePackingItem,
  seedStarterItems,
  togglePackingItem,
  updatePackingItem,
} from "@/lib/packing/service";
import {
  packingItemIdSchema,
  packingItemSchema,
  type PackingItemInput,
} from "@/lib/validation/packing";

function readItemInput(formData: FormData): { input: PackingItemInput; error?: ActionState } {
  const parsed = packingItemSchema.safeParse({
    name: formData.get("name"),
    category: formData.get("category"),
    isShared: formData.get("isShared") === "true",
    assignedTo: formData.get("assignedTo") || null,
  });

  if (!parsed.success) {
    return {
      input: {
        name: "",
        category: "other",
        isShared: true,
        assignedTo: null,
      },
      error: failed(
        "That item could not be read.",
        parsed.error.flatten().fieldErrors as Record<string, string>,
      ),
    };
  }
  return { input: parsed.data };
}

function readItemId(formData: FormData): { itemId: string; error?: ActionState } {
  const parsed = packingItemIdSchema.safeParse({ itemId: formData.get("itemId") });
  if (!parsed.success) {
    return { itemId: "", error: failed("That item could not be found.") };
  }
  return { itemId: parsed.data.itemId };
}

export async function addPackingItemAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const context = await requireSession();
    const { input, error } = readItemInput(formData);
    if (error) return error;

    const id = await addPackingItem(context, input);
    revalidatePath("/trip");
    return { ok: true, payload: { id } };
  });
}

export async function updatePackingItemAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const context = await requireSession();
    const { itemId, error: idError } = readItemId(formData);
    if (idError) return idError;
    const { input, error } = readItemInput(formData);
    if (error) return error;

    await updatePackingItem(context, itemId, input);
    revalidatePath("/trip");
    return { ok: true };
  });
}

export async function togglePackingItemAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const context = await requireSession();
    const { itemId, error } = readItemId(formData);
    if (error) return error;

    await togglePackingItem(context, itemId);
    revalidatePath("/trip");
    return { ok: true };
  });
}

export async function deletePackingItemAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const context = await requireSession();
    const { itemId, error } = readItemId(formData);
    if (error) return error;

    await deletePackingItem(context, itemId);
    revalidatePath("/trip");
    return { ok: true };
  });
}

export async function seedStarterItemsAction(): Promise<ActionState> {
  return runAction(async () => {
    const context = await requireSession();
    const added = await seedStarterItems(context);
    revalidatePath("/trip");
    return { ok: true, payload: { added } };
  });
}