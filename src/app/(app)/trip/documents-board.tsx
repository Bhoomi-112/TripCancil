"use client";

import { useCallback, useMemo, useState } from "react";
import useSWR from "swr";
import { Badge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { CloseIcon, InfoIcon, PlusIcon, UploadIcon } from "@/components/ui/icons";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { Window } from "@/components/ui/window";
import {
  DOCUMENT_TYPE_COLOURS,
  DOCUMENT_TYPE_LABELS,
  type DocumentType,
} from "@/lib/documents/categories";
import type {
  DocumentPreview,
  DocumentsPayload,
} from "@/lib/documents/types";
import { DocumentUploadForm } from "./document-upload-form";

type Props = {
  tripId: string;
  viewerId: string;
  isOwner: boolean;
  editable: boolean;
  initial: DocumentsPayload;
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const TYPE_EMOJI: Record<DocumentType, string> = {
  ticket: "🎫",
  hotel: "🏨",
  id: "🪪",
  insurance: "🛡️",
  other: "📄",
};

function shortDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

export function DocumentsBoard({
  tripId,
  viewerId,
  isOwner,
  editable,
  initial,
}: Props) {
  const toast = useToast();

  const [adding, setAdding] = useState(false);
  const [preview, setPreview] = useState<DocumentPreview | null>(null);
  const [deleting, setDeleting] = useState<DocumentPreview | null>(null);
  const [busy, setBusy] = useState(false);

  const { data, mutate } = useSWR<DocumentsPayload>(
    `/api/trips/${tripId}/documents`,
    fetcher,
    {
      fallbackData: initial,
      refreshInterval: 5000,
      keepPreviousData: true,
    },
  );
  const payload = data ?? initial;

  const names = useMemo(
    () =>
      new Map(payload.members.map((member) => [member.id, member.displayName])),
    [payload],
  );
  const planLabels = useMemo(
    () => new Map(payload.itineraryOptions.map((option) => [option.id, option.label])),
    [payload],
  );

  const handleDelete = useCallback(async () => {
    if (!deleting || busy) return;
    const target = deleting;
    setDeleting(null);
    setBusy(true);
    try {
      const response = await fetch(
        `/api/trips/${tripId}/documents?id=${encodeURIComponent(target.id)}`,
        { method: "DELETE" },
      );
      const json = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !json.ok) {
        toast.error(json.error ?? "Could not delete that file.");
        return;
      }
      toast.success(`Removed "${target.title}".`);
      await mutate();
    } catch {
      toast.error("Could not reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }, [busy, deleting, mutate, toast, tripId]);

  const canDelete = (document: DocumentPreview) =>
    editable &&
    (document.uploaderId === viewerId || isOwner);

  return (
    <>
      <Window
        title="doc-vault.exe"
        actions={
          editable ? (
            <Button size="sm" variant="pop" onClick={() => setAdding(true)}>
              <UploadIcon className="size-4" />
              Add
            </Button>
          ) : undefined
        }
      >
        {payload.documents.length === 0 ? (
          <EmptyState
            illustration="cloud"
            title="The vault is empty"
            description={
              editable
                ? "Tickets, hotel confirmations, IDs — upload one and the whole crew can preview it."
                : "This trip never filed a document."
            }
            action={
              editable ? (
                <Button
                  size="sm"
                  variant="accent"
                  sparkle
                  onClick={() => setAdding(true)}
                >
                  <PlusIcon className="size-4" />
                  Upload a document
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {payload.documents.map((document) => {
              const uploader = names.get(document.uploaderId);
              const linked = document.itineraryItemId
                ? planLabels.get(document.itineraryItemId)
                : undefined;
              return (
                <li
                  key={document.id}
                  className="flex items-center gap-3 rounded-2xl border-2 border-silver-deep bg-white/80 px-3 py-2.5 shadow-sticker"
                >
                  <span
                    className="flex size-10 shrink-0 items-center justify-center rounded-xl border-2 border-ink/10 text-lg"
                    style={{ backgroundColor: `${DOCUMENT_TYPE_COLOURS[document.type]}1a` }}
                    aria-hidden="true"
                  >
                    {TYPE_EMOJI[document.type]}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-sm font-extrabold text-ink">
                        {document.title}
                      </p>
                      <Badge
                        tone="chrome"
                        className="shrink-0"
                        style={{
                          borderColor: DOCUMENT_TYPE_COLOURS[document.type],
                          color: DOCUMENT_TYPE_COLOURS[document.type],
                        }}
                      >
                        {DOCUMENT_TYPE_LABELS[document.type]}
                      </Badge>
                    </div>
                    <p className="truncate text-[11px] font-bold text-ink-soft">
                      {uploader ?? "Someone"}
                      {linked ? ` · ${linked}` : ""} · {shortDate(document.createdAt)}
                    </p>
                  </div>

                  <Button
                    size="sm"
                    variant="chrome"
                    onClick={() => setPreview(document)}
                  >
                    Preview
                  </Button>

                  {canDelete(document) ? (
                    <IconButton
                      label={`Delete ${document.title}`}
                      size="sm"
                      variant="ghost"
                      className="size-9"
                      onClick={() => setDeleting(document)}
                    >
                      <CloseIcon className="size-4" />
                    </IconButton>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Window>

      {adding ? (
        <DocumentUploadForm
          tripId={tripId}
          itineraryOptions={payload.itineraryOptions}
          onClose={() => setAdding(false)}
        />
      ) : null}

      <Modal
        open={preview !== null}
        onClose={() => setPreview(null)}
        title="preview.exe"
        size="lg"
        footer={
          preview ? (
            <div className="flex items-center justify-between gap-2">
              <InfoIcon className="size-4 shrink-0 text-ink-soft" />
              <p className="min-w-0 flex-1 text-xs font-semibold text-ink-soft">
                Short-lived preview link; it refreshes with the live poll.
              </p>
              <a
                href={preview.previewUrl}
                target="_blank"
                rel="noreferrer"
                className="shrink-0"
              >
                <Button variant="chrome" size="sm">
                  Open in new tab
                </Button>
              </a>
            </div>
          ) : undefined
        }
      >
        {preview ? (
          <DocumentPreviewBody document={preview} />
        ) : null}
      </Modal>

      <Modal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="delete.bin"
        size="sm"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              Keep it
            </Button>
            <Button variant="danger" loading={busy} onClick={handleDelete}>
              <CloseIcon className="size-4" />
              Delete
            </Button>
          </div>
        }
      >
        <p className="text-sm font-semibold text-ink-soft">
          &ldquo;{deleting?.title}&rdquo; and its file are removed from the vault
          for everyone. There is no undo.
        </p>
      </Modal>
    </>
  );
}

function DocumentPreviewBody({ document }: { document: DocumentPreview }) {
  if (document.kind === "pdf") {
    return (
      <object
        data={document.previewUrl}
        type="application/pdf"
        className="h-[70vh] w-full rounded-2xl border-2 border-silver-deep bg-white"
      >
        <p className="p-6 text-sm font-semibold text-ink-soft">
          This browser cannot show the PDF inline. Use Open in new tab.
        </p>
      </object>
    );
  }
  return (
    // Signed Supabase URLs, not next/image sources: the vault previews whatever
    // the crew uploaded, so optimization is deliberately off for this one.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={document.previewUrl}
      alt={document.title}
      className="max-h-[70vh] w-full rounded-2xl border-2 border-silver-deep bg-silver object-contain"
    />
  );
}