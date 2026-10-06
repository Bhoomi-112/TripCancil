/**
 * Live checks for P6: the packing list and the documents vault. Run with the
 * dev server up:
 *
 *   NODE_OPTIONS=--conditions=react-server npx tsx scripts/verify-p6.mts
 *
 * Everything it creates it deletes again (including the uploads in the private
 * `documents` bucket); the seeded trip is only ever read.
 */
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import type { Database } from "../src/lib/db/types";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    try {
      process.loadEnvFile(file);
    } catch {
      continue;
    }
  }
}

loadEnv();

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error("Missing Supabase env");

const db = createClient<Database>(url, serviceKey, {
  auth: { persistSession: false },
});

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    passed += 1;
    console.log(`  ok   ${name}`);
  } else {
    failed += 1;
    failures.push(name);
    console.log(`  FAIL ${name}${detail ? ` -> ${detail}` : ""}`);
  }
}

// --------------------------------------------------------------- fixtures

async function makeTrip(name: string, daysAgo: number, daysLong: number, people = 3) {
  const start = new Date(Date.now() - daysAgo * 86400000);
  const end = new Date(start.getTime() + (daysLong - 1) * 86400000);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const { data: trip, error } = await db
    .from("trips")
    .insert({
      name,
      destination: "Konkan",
      start_date: iso(start),
      end_date: iso(end),
      location_type: "city",
      invite_code: `P6V${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
    })
    .select("id")
    .single();
  if (error) throw error;

  const memberIds: string[] = [];
  for (let index = 0; index < people; index += 1) {
    const { data: row, error: memberError } = await db
      .from("members")
      .insert({
        trip_id: trip.id,
        display_name: `M${index}`,
        pin_hash: bcrypt.hashSync("123456", 10),
        role: index === 0 ? "owner" : "member",
      })
      .select("id")
      .single();
    if (memberError) throw memberError;
    memberIds.push(row.id);
  }
  await db.from("trips").update({ owner_member_id: memberIds[0] }).eq("id", trip.id);

  return {
    tripId: trip.id,
    memberIds,
    startDate: iso(start),
    endDate: iso(end),
    context: (viewerId: string) =>
      ({
        trip: {
          id: trip.id,
          name,
          start_date: iso(start),
          end_date: iso(end),
          location_type: "city",
        },
        member: {
          id: viewerId,
          role: viewerId === memberIds[0] ? "owner" : "member",
        },
      }) as never,
  };
}

const live = await makeTrip("verify-p6-live", 1, 3);
const over = await makeTrip("verify-p6-over", 10, 3);
const other = await makeTrip("verify-p6-other", 1, 3);

const { starterItemsFor } = await import("../src/lib/packing/starter");
const {
  readPacking,
  addPackingItem,
  updatePackingItem,
  togglePackingItem,
  deletePackingItem,
  seedStarterItems,
  PackingError,
} = await import("../src/lib/packing/service");
const {
  readDocuments,
  uploadDocument,
  deleteDocument,
  DocumentsError,
} = await import("../src/lib/documents/service");

// ------------------------------------------------- HTTP on an empty editable trip

const { signSession } = await import("../src/lib/auth/session");
async function cookie(tripId: string, memberId: string) {
  return `tc_session=${await signSession({ memberId, tripId })}`;
}

const otherCookie = await cookie(other.tripId, other.memberIds[0]);
const emptyRes = await fetch(`${BASE}/trip`, { headers: { cookie: otherCookie } });
const emptyHtml = await emptyRes.text();
check("an empty trip page opens", emptyRes.status === 200, String(emptyRes.status));
check("the packing window is there", emptyHtml.includes("pack-list.exe"));
check("the vault window is there", emptyHtml.includes("doc-vault.exe"));
check("an editable empty trip offers the starter list", emptyHtml.includes("Starter list"));
check("an editable empty trip offers uploads", emptyHtml.includes("Upload a document"));
check("no read-only badge on a live trip", !emptyHtml.includes("Read-only"));
check("no pin hashes on the trip page", !emptyHtml.includes("pin_hash") && !emptyHtml.includes("$2b$"));
check("no invite code on the trip page", !emptyHtml.includes("invite_code"));
check("no storage paths on the trip page", !emptyHtml.includes("storage_path"));

const otherPackingApi = await fetch(`${BASE}/api/trips/${other.tripId}/packing`, {
  headers: { cookie: otherCookie },
});
const otherPackingBody = await otherPackingApi.json();
check("the empty packing route answers", otherPackingApi.status === 200, String(otherPackingApi.status));
check("it ships empty items but the crew", Array.isArray(otherPackingBody.items) && otherPackingBody.items.length === 0 && otherPackingBody.members?.length === 3);

const otherDocApi = await fetch(`${BASE}/api/trips/${other.tripId}/documents`, {
  headers: { cookie: otherCookie },
});
const otherDocBody = await otherDocApi.json();
check("the empty vault route answers", otherDocApi.status === 200, String(otherDocApi.status));
check("it ships an empty document list", Array.isArray(otherDocBody.documents) && otherDocBody.documents.length === 0);

const signedOutPacking = await fetch(`${BASE}/api/trips/${other.tripId}/packing`);
check("the packing route needs a session", signedOutPacking.status === 401, String(signedOutPacking.status));
const signedOutDocs = await fetch(`${BASE}/api/trips/${other.tripId}/documents`);
check("the vault route needs a session", signedOutDocs.status === 401, String(signedOutDocs.status));

// ------------------------------------------------------------- packing rules

const [owner, second, third] = live.memberIds;
const ownerCtx = live.context(owner);

const empty = await readPacking(live.tripId, owner);
check("a fresh list has nothing and the crew", empty.items.length === 0 && empty.members.length === 3);

const sharedId = await addPackingItem(ownerCtx, {
  name: "First-aid kit",
  category: "toiletries",
  isShared: true,
  assignedTo: second,
});
check("a shared item returns its id", typeof sharedId === "string" && sharedId.length > 0);
const { data: sharedRow } = await db
  .from("packing_items")
  .select("is_shared, assigned_to, checked, created_by")
  .eq("id", sharedId)
  .single();
check("a shared item is shared and assigned", sharedRow?.is_shared === true && sharedRow?.assigned_to === second);
check("a fresh item is unchecked", sharedRow?.checked === false);

let foreignCarrierError = "";
try {
  await addPackingItem(ownerCtx, {
    name: "Someone else's bag",
    category: "gear",
    isShared: true,
    assignedTo: over.memberIds[0],
  });
} catch (error) {
  foreignCarrierError = error instanceof PackingError ? error.message : String(error);
}
check("an outsider cannot be handed a shared item", foreignCarrierError.includes("not a member of this trip"), foreignCarrierError);

const personalId = await addPackingItem(live.context(second), {
  name: "Birthday gift",
  category: "other",
  isShared: false,
  assignedTo: third,
});
const { data: personalRow } = await db
  .from("packing_items")
  .select("is_shared, assigned_to, created_by")
  .eq("id", personalId)
  .single();
check("a personal item is private", personalRow?.is_shared === false);
check(
  "a personal item stays with the person who made it",
  personalRow?.assigned_to === second,
  "the form said someone else but the server forced the creator",
);

const ownerView = await readPacking(live.tripId, owner);
check("a member does not see another one's private list", !ownerView.items.some((item) => item.id === personalId));
const ownView = await readPacking(live.tripId, second);
check("the owner of a private item sees it", ownView.items.some((item) => item.id === personalId));
check("shared items are visible to everyone", ownView.items.some((item) => item.id === sharedId));

await togglePackingItem(live.context(third), sharedId);
const { data: toggledRow } = await db
  .from("packing_items")
  .select("checked")
  .eq("id", sharedId)
  .single();
check("any crew member can check off a shared item", toggledRow?.checked === true);

let foreignToggleError = "";
try {
  await togglePackingItem(live.context(third), personalId);
} catch (error) {
  foreignToggleError = error instanceof PackingError ? error.message : String(error);
}
check("nobody else can touch a private item", foreignToggleError.includes("someone else's personal list"), foreignToggleError);
await togglePackingItem(ownerCtx, personalId);
const { data: toggledPersonal } = await db
  .from("packing_items")
  .select("checked")
  .eq("id", personalId)
  .single();
check("the trip owner may check off a member's private item", toggledPersonal?.checked === true);

await updatePackingItem(ownerCtx, sharedId, {
  name: "Mini first-aid kit",
  category: "toiletries",
  isShared: true,
  assignedTo: third,
});
const { data: updatedRow } = await db
  .from("packing_items")
  .select("name, category, assigned_to")
  .eq("id", sharedId)
  .single();
check("editing renames a shared item", updatedRow?.name === "Mini first-aid kit");
check("editing can hand the item to someone else", updatedRow?.assigned_to === third);

await updatePackingItem(live.context(second), sharedId, {
  name: "Mini first-aid kit",
  category: "toiletries",
  isShared: true,
  assignedTo: "",
});
const { data: nobodyRow } = await db
  .from("packing_items")
  .select("assigned_to")
  .eq("id", sharedId)
  .single();
check("choosing nobody keeps the current carrier", nobodyRow?.assigned_to === third);

let foreignEditError = "";
try {
  await updatePackingItem(live.context(third), personalId, {
    name: "Rewritten",
    category: "other",
    isShared: false,
    assignedTo: "",
  });
} catch (error) {
  foreignEditError = error instanceof PackingError ? error.message : String(error);
}
check("a member cannot edit another one's private item", foreignEditError.includes("someone else's personal list"), foreignEditError);

// Make the private item shared: it must stay with its maker unless reassigned.
await updatePackingItem(live.context(second), personalId, {
  name: "Birthday gift",
  category: "other",
  isShared: true,
  assignedTo: "",
});
const thirdView = await readPacking(live.tripId, third);
check("switching an item to shared opens it up", thirdView.items.some((item) => item.id === personalId));
const { data: convertedRow } = await db
  .from("packing_items")
  .select("is_shared, assigned_to, checked")
  .eq("id", personalId)
  .single();
check("a converted item keeps its carrier and check", convertedRow?.is_shared === true && convertedRow?.assigned_to === second && convertedRow?.checked === true);

const beforeSeed = await readPacking(live.tripId, owner);
const alreadyOnList = new Set(
  beforeSeed.items.map((item) => `${item.name.trim().toLowerCase()}|${item.category}`),
);
const alreadySeeded = starterItemsFor("city").filter((item) =>
  alreadyOnList.has(`${item.name.trim().toLowerCase()}|${item.category}`),
).length;
const seededCount = await seedStarterItems(ownerCtx);
const cityExpected = starterItemsFor("city").length;
check("a starter tap adds only what is missing", seededCount === cityExpected - alreadySeeded, `${seededCount} vs ${cityExpected - alreadySeeded} (${alreadySeeded} already packed)`);
const reseededCount = await seedStarterItems(ownerCtx);
check("a second starter tap adds nothing", reseededCount === 0, String(reseededCount));

await deletePackingItem(live.context(third), sharedId);
let foreignDeleteError = "";
try {
  await deletePackingItem(live.context(third), "11111111-2222-4333-8444-555555555555");
} catch (error) {
  foreignDeleteError = error instanceof PackingError ? error.message : String(error);
}
check("a mystery item id is refused", foreignDeleteError.includes("not on this trip's list"), foreignDeleteError);
const afterDelete = await readPacking(live.tripId, owner);
check("deleting a shared item removes it", !afterDelete.items.some((item) => item.id === sharedId));
const { error: personalDeleteError } = await db.from("packing_items").delete().eq("id", personalId);
check("the second private item is gone before the re-seed check", personalDeleteError === null);
const { data: personalGone } = await db.from("packing_items").select("id").eq("id", personalId).maybeSingle();
check("the private item row is really gone", personalGone === null);

let overWriteError = "";
try {
  await addPackingItem(over.context(over.memberIds[0]), {
    name: "Too late",
    category: "docs",
    isShared: true,
    assignedTo: "",
  });
} catch (error) {
  overWriteError = error instanceof PackingError ? error.message : String(error);
}
check("a past trip refuses new packing", overWriteError.includes("read-only"), overWriteError);
let overSeedError = "";
try {
  await seedStarterItems(over.context(over.memberIds[0]));
} catch (error) {
  overSeedError = error instanceof PackingError ? error.message : String(error);
}
check("a past trip refuses a starter seed", overSeedError.includes("read-only"), overSeedError);

// Cross-trip: an item on another list must never leak into this one.
const otherItemId = await addPackingItem(other.context(other.memberIds[0]), {
  name: "Their loudspeaker",
  category: "gear",
  isShared: true,
  assignedTo: other.memberIds[1],
});
const liveView = await readPacking(live.tripId, owner);
check("another trip's item is invisible here", !liveView.items.some((item) => item.id === otherItemId));
let crossTripDeleteError = "";
try {
  await deletePackingItem(ownerCtx, otherItemId);
} catch (error) {
  crossTripDeleteError = error instanceof PackingError ? error.message : String(error);
}
check("another trip's item cannot be deleted from here", crossTripDeleteError.includes("not on this trip's list"), crossTripDeleteError);

// ------------------------------------------------------------- documents rules

const fixturePaths: string[] = [];

const pdfBytes = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF", "utf8");
const pngBytes = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

let emptyFileError = "";
try {
  await uploadDocument(live.context(second), {
    title: "Empty",
    type: "other",
    itineraryItemId: null,
    file: { name: "empty.pdf", mimeType: "application/pdf", size: 0, bytes: new ArrayBuffer(0) },
  });
} catch (error) {
  emptyFileError = error instanceof DocumentsError ? error.message : String(error);
}
check("an empty file is refused", emptyFileError.includes("empty"), emptyFileError);

let disallowedMimeError = "";
try {
  await uploadDocument(live.context(second), {
    title: "Not allowed",
    type: "other",
    itineraryItemId: null,
    file: { name: "notes.txt", mimeType: "text/plain", size: 10, bytes: toArrayBuffer(Buffer.from("hello")) },
  });
} catch (error) {
  disallowedMimeError = error instanceof DocumentsError ? error.message : String(error);
}
check("only PDFs and images are welcomed", disallowedMimeError.includes("Only PDFs and images"), disallowedMimeError);

let oversizedError = "";
try {
  await uploadDocument(live.context(second), {
    title: "Huge",
    type: "other",
    itineraryItemId: null,
    file: {
      name: "huge.png",
      mimeType: "image/png",
      size: 10 * 1024 * 1024 + 1,
      bytes: new ArrayBuffer(10 * 1024 * 1024 + 1),
    },
  });
} catch (error) {
  oversizedError = error instanceof DocumentsError ? error.message : String(error);
}
check("a ten-megabyte-plus file is refused", oversizedError.includes("capped at 10 MB"), oversizedError);

const { data: itineraryLive, error: itineraryInsertError } = await db
  .from("itinerary_items")
  .insert({ trip_id: live.tripId, day_index: 0, position: 0, title: "Landing" })
  .select("id")
  .single();
if (itineraryInsertError) throw itineraryInsertError;
const { data: itineraryOther, error: itineraryOtherError } = await db
  .from("itinerary_items")
  .insert({ trip_id: other.tripId, day_index: 0, position: 0, title: "Bonus" })
  .select("id")
  .single();
if (itineraryOtherError) throw itineraryOtherError;

let foreignPlanError = "";
try {
  await uploadDocument(live.context(second), {
    title: "Linked to the wrong trip",
    type: "other",
    itineraryItemId: itineraryOther.id,
    file: {
      name: "wow.png",
      mimeType: "image/png",
      size: pngBytes.length,
      bytes: toArrayBuffer(pngBytes),
    },
  });
} catch (error) {
  foreignPlanError = error instanceof DocumentsError ? error.message : String(error);
}
check("a plan item from another trip is refused", foreignPlanError.includes("not on this trip"), foreignPlanError);

const pdfId = await uploadDocument(live.context(second), {
  title: "Train tickets to Goa",
  type: "ticket",
  itineraryItemId: itineraryLive.id,
  file: { name: "tickets.pdf", mimeType: "application/pdf", size: pdfBytes.length, bytes: toArrayBuffer(pdfBytes) },
});
const { data: pdfRow } = await db
  .from("documents")
  .select("storage_path, uploader_id, itinerary_item_id, type")
  .eq("id", pdfId)
  .single();
check("a pdf upload lands in the right trip folder", pdfRow?.storage_path.startsWith(`${live.tripId}/`) ?? false, pdfRow?.storage_path);
check("the stored path is slugged and safe", pdfRow?.storage_path.endsWith("-train-tickets-to-goa.pdf") ?? false, pdfRow?.storage_path);
check("the uploader is recorded", pdfRow?.uploader_id === second);
check("the plan link is kept", pdfRow?.itinerary_item_id === itineraryLive.id);
check("the kind is stored", pdfRow?.type === "ticket");
fixturePaths.push(pdfRow!.storage_path);

const pngId = await uploadDocument(live.context(third), {
  title: "Screenshot of the itinerary",
  type: "other",
  itineraryItemId: itineraryLive.id,
  file: { name: "shot.png", mimeType: "image/png", size: pngBytes.length, bytes: toArrayBuffer(pngBytes) },
});
const { data: pngRow } = await db
  .from("documents")
  .select("storage_path, uploader_id")
  .eq("id", pngId)
  .single();
check("an image upload gets a png extension", pngRow?.storage_path.endsWith(".png") ?? false, pngRow?.storage_path);
fixturePaths.push(pngRow!.storage_path);

const vault = await readDocuments(live.tripId);
check("the vault reads its documents", vault.documents.length === 2, String(vault.documents.length));
check("the newest document comes first", vault.documents[0]?.id === pngId);
check("a pdf is typed pdf", vault.documents.find((d) => d.id === pdfId)?.kind === "pdf");
check("an image is typed image", vault.documents.find((d) => d.id === pngId)?.kind === "image");
check("the vault knows the plan", vault.itineraryOptions.some((o) => o.id === itineraryLive.id && o.label === "Day 1 · Landing"), JSON.stringify(vault.itineraryOptions));
check("the vault knows the crew", vault.members.length === 3);
for (const document of vault.documents) {
  check("every preview is a signed url", document.previewUrl.startsWith(`${url}/storage/v1/object/sign/documents/`), document.previewUrl.slice(0, 60));
}

let strangerDeleteError = "";
try {
  await deleteDocument(live.context(third), pdfId);
} catch (error) {
  strangerDeleteError = error instanceof DocumentsError ? error.message : String(error);
}
check("a plain member cannot delete someone else's upload", strangerDeleteError.includes("uploader or the trip owner"), strangerDeleteError);

await deleteDocument(ownerCtx, pdfId);
const { data: deletedDoc } = await db.from("documents").select("id").eq("id", pdfId).maybeSingle();
check("a deleted vault row is gone", deletedDoc === null);
const { data: goneFile, error: goneFileError } = await db.storage.from("documents").info(pdfRow!.storage_path);
check("the stored file is gone too", goneFile === null && goneFileError !== null, JSON.stringify({ goneFile, goneFileError }));

let overUploadError = "";
try {
  await uploadDocument(over.context(over.memberIds[0]), {
    title: "Too late",
    type: "other",
    itineraryItemId: null,
    file: { name: "late.png", mimeType: "image/png", size: 1, bytes: new ArrayBuffer(1) },
  });
} catch (error) {
  overUploadError = error instanceof DocumentsError ? error.message : String(error);
}
check("a past trip refuses uploads", overUploadError.includes("read-only"), overUploadError);

const otherDocId = await uploadDocument(other.context(other.memberIds[0]), {
  title: "Them again",
  type: "other",
  itineraryItemId: null,
  file: { name: "them.png", mimeType: "image/png", size: pngBytes.length, bytes: toArrayBuffer(pngBytes) },
});
const { data: otherDocRow } = await db
  .from("documents")
  .select("storage_path")
  .eq("id", otherDocId)
  .single();
fixturePaths.push(otherDocRow!.storage_path);
const liveVault = await readDocuments(live.tripId);
check("another trip's vault is invisible here", !liveVault.documents.some((d) => d.id === otherDocId));
let crossTripDocError = "";
try {
  await deleteDocument(ownerCtx, otherDocId);
} catch (error) {
  crossTripDocError = error instanceof DocumentsError ? error.message : String(error);
}
check("another trip's document cannot be deleted from here", crossTripDocError.includes("not on this trip"), crossTripDocError);

// ----------------------------------------------------- the live HTTP surface

const liveCookie = await cookie(live.tripId, owner);
const liveDocsApi = await fetch(`${BASE}/api/trips/${live.tripId}/documents`, {
  headers: { cookie: liveCookie },
});
const liveDocsBody = await liveDocsApi.json();
check("the live vault route answers", liveDocsApi.status === 200, String(liveDocsApi.status));
check("the vault still has its upload", liveDocsBody.documents?.some((d: { id: string }) => d.id === pngId));
check("the vault leaks no storage paths", !JSON.stringify(liveDocsBody).includes("storage_path"));
check("the vault leaks no pins or invite codes", !JSON.stringify(liveDocsBody).includes("pin_hash") && !JSON.stringify(liveDocsBody).includes("invite_code"));

const livePackingApi = await fetch(`${BASE}/api/trips/${live.tripId}/packing`, {
  headers: { cookie: liveCookie },
});
const livePackingBody = await livePackingApi.json();
check("the live packing route answers", livePackingApi.status === 200, String(livePackingApi.status));
check("it ships the starter-seeded items", livePackingBody.items?.length >= cityExpected - alreadySeeded, String(livePackingBody.items?.length));
check("it leaks no pins or invite codes", !JSON.stringify(livePackingBody).includes("pin_hash") && !JSON.stringify(livePackingBody).includes("invite_code"));

const twoCookies = await cookie(other.tripId, other.memberIds[0]);
const wrongTripPacking = await fetch(`${BASE}/api/trips/${live.tripId}/packing`, {
  headers: { cookie: twoCookies },
});
check("a trip cookie is refused on another trip's packing", wrongTripPacking.status === 404, String(wrongTripPacking.status));
const wrongTripDocs = await fetch(`${BASE}/api/trips/${live.tripId}/documents`, {
  headers: { cookie: twoCookies },
});
check("a trip cookie is refused on another trip's vault", wrongTripDocs.status === 404, String(wrongTripDocs.status));

const overCookie = await cookie(over.tripId, over.memberIds[0]);
const overRes = await fetch(`${BASE}/trip`, { headers: { cookie: overCookie } });
const overHtml = await overRes.text();
check("a past trip page opens", overRes.status === 200, String(overRes.status));
check("a past trip is badged read-only", overHtml.includes("Read-only"));
check("a past trip offers no starter list", !overHtml.includes("Starter list"));
check("a past trip offers no uploads", !overHtml.includes("Upload a document"));
check("a past trip shows the untouched vault", overHtml.includes("The vault is empty"));

// ------------------------------------------------------------------- cleanup

for (const path of fixturePaths) {
  await db.storage.from("documents").remove([path]);
}
for (const fixture of [live.tripId, over.tripId, other.tripId]) {
  await db.from("trips").delete().eq("id", fixture);
}
const { data: leftoverTrips } = await db.from("trips").select("id").ilike("name", "verify-p6-%");
check("no verify-p6 trips left behind", (leftoverTrips ?? []).length === 0, JSON.stringify(leftoverTrips));

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log(`failed: ${failures.join(", ")}`);
  process.exit(1);
}

function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
}