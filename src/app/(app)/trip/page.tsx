import { AvatarStack } from "@/components/ui/avatar";
import { ScreenHeader } from "@/components/shell/screen-header";
import { Badge } from "@/components/ui/badge";
import { Window } from "@/components/ui/window";
import { CopyInviteButton } from "@/components/auth/invite-actions";
import { QrCode } from "@/components/auth/qr-code";
import { requireSession } from "@/lib/auth/context";
import { isOwner } from "@/lib/auth/roles";
import { activeLockout } from "@/lib/auth/rate-limit";
import { getSupabase } from "@/lib/db/client";
import { env } from "@/lib/env";
import { formatTripDates, LOCATION_TYPE_LABELS } from "@/lib/constants";
import { MemberRow, RotateInviteButton } from "./member-controls";

export default async function TripPage() {
  const { member, trip } = await requireSession();
  const owner = isOwner({ member, trip });

  const { data: members } = await getSupabase()
    .from("members")
    .select("*")
    .eq("trip_id", trip.id)
    .order("created_at", { ascending: true });

  const roster = members ?? [];
  const shareUrl = `${env.appUrl}/join?code=${trip.invite_code}`;

  return (
    <>
      <ScreenHeader
        title="Trip"
        subtitle={`${trip.destination} · ${formatTripDates(trip.start_date, trip.end_date)}`}
        badge={LOCATION_TYPE_LABELS[trip.location_type]}
        actions={<AvatarStack names={roster.map((row) => row.display_name)} />}
      />

      <div className="flex flex-col gap-4">
        <Window
          title="invite code"
          tone="chrome"
          actions={owner ? <RotateInviteButton /> : null}
          bodyClassName="flex flex-col gap-4"
        >
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <QrCode
              value={shareUrl}
              className="w-36 shrink-0 rounded-2xl border-2 border-silver-deep shadow-sticker"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <p className="break-all rounded-2xl border-2 border-dashed border-electric/50 bg-electric/5 px-3 py-2 text-center font-display text-lg tracking-[0.2em] text-electric-deep">
                {trip.invite_code}
              </p>
              <p className="text-sm font-semibold text-ink-soft">
                Send this to the group. They pick a display name and a 6-digit PIN,
                and that name is theirs for the whole trip.
              </p>
              <CopyInviteButton code={trip.invite_code} shareUrl={shareUrl} />
            </div>
          </div>
        </Window>

        <Window
          title={`crew · ${roster.length}`}
          bodyClassName="flex flex-col gap-3"
        >
          {roster.length === 0 ? (
            <p className="text-sm font-semibold text-ink-soft">
              Nobody else has joined yet.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {roster.map((row) => (
                <MemberRow
                  key={row.id}
                  memberId={row.id}
                  displayName={row.display_name}
                  isOwner={row.role === "owner"}
                  isSelf={row.id === member.id}
                  canManage={owner}
                  locked={Boolean(activeLockout(row))}
                />
              ))}
            </ul>
          )}

          <div className="flex flex-wrap items-center gap-2 border-t-2 border-dashed border-silver-mid pt-3">
            <Badge tone="pop" sticker>
              {owner ? "You own this trip" : "You are a member"}
            </Badge>
            <span className="text-xs font-semibold text-ink-soft">
              {owner
                ? "Only you can reset a PIN, remove someone or rotate the code."
                : "The owner can reset your PIN if you forget it."}
            </span>
          </div>
        </Window>

        <Window title="how the login works" tone="ink" bodyClassName="flex flex-col gap-2">
          <p className="text-sm font-semibold text-cream/85">
            No email, no password, no social login. The invite code gets you to the
            door, your display name says who you are, and the 6-digit PIN is the only
            secret. It is stored as a bcrypt hash, so it can never be read back, not
            even by the owner.
          </p>
          <p className="text-sm font-semibold text-cream/85">
            Five wrong PINs locks that member out for 15 minutes. Sessions last 14 days
            in a signed, httpOnly cookie.
          </p>
        </Window>
      </div>
    </>
  );
}
