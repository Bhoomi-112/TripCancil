"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClass } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import {
  CalendarIcon,
  ChevronRightIcon,
  PencilIcon,
  TrashIcon,
} from "@/components/ui/icons";
import { formatTripDates } from "@/lib/constants";
import type { TravellerTrip } from "@/lib/traveller/service";
import { openTripAction } from "./actions";
import { TripDeleteForm } from "./trip-delete-form";
import { TripEditForm } from "./trip-edit-form";

export function TripRow({ trip }: { trip: TravellerTrip }) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const canManage = trip.isOwner && !trip.ended;

  return (
    <li className="gloss rounded-window border-2 border-silver-deep bg-white/75 p-3 shadow-bubble">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-display text-sm uppercase tracking-tight text-ink">
              {trip.name}
            </h3>
            <Badge tone={trip.isOwner ? "sunny" : "chrome"}>
              {trip.isOwner ? "Owner" : "Member"}
            </Badge>
            {trip.ended ? (
              <Badge tone="ink">Read-only</Badge>
            ) : (
              <Badge tone="pop">Open trip</Badge>
            )}
          </div>

          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-bold text-ink-soft">
            <span>{trip.destination}</span>
            <span aria-hidden="true" className="text-hotpink">
              *
            </span>
            <span className="inline-flex items-center gap-1">
              <CalendarIcon className="size-3.5" />
              {formatTripDates(trip.startDate, trip.endDate)}
            </span>
          </p>

          <p className="mt-1 font-display text-[9px] uppercase tracking-tight text-ink-soft/80">
            {trip.memberCount} {trip.memberCount === 1 ? "member" : "members"} ·{" "}
            {trip.itemCount} plan {trip.itemCount === 1 ? "item" : "items"} ·{" "}
            {trip.expenseCount} {trip.expenseCount === 1 ? "expense" : "expenses"} ·{" "}
            {trip.photoCount} {trip.photoCount === 1 ? "photo" : "photos"}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {canManage && (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setEditing(true)}
              >
                <PencilIcon className="size-4" />
                Edit
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setDeleting(true)}
              >
                <TrashIcon className="size-4" />
                Delete
              </Button>
            </>
          )}

          <form action={openTripAction} className="flex">
            <input type="hidden" name="tripId" value={trip.tripId} />
            <button type="submit" className={buttonClass({ size: "sm", variant: "primary" })}>
              Open
              <ChevronRightIcon className="size-4" />
            </button>
          </form>
        </div>
      </div>

      <Modal
        open={editing}
        onClose={() => setEditing(false)}
        title={`edit ${trip.name}`}
        description="Renaming or re-dating works for the whole group."
        size="md"
      >
        <TripEditForm trip={trip} onDone={() => setEditing(false)} />
      </Modal>

      <Modal
        open={deleting}
        onClose={() => setDeleting(false)}
        title={`delete ${trip.name}?`}
        size="md"
      >
        <TripDeleteForm trip={trip} onDone={() => setDeleting(false)} />
      </Modal>
    </li>
  );
}