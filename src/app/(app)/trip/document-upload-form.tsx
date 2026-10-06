"use client";

import { useMemo, useState } from "react";
import { useSWRConfig } from "swr";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import {
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABELS,
} from "@/lib/documents/categories";
import { MAX_DOCUMENT_BYTES } from "@/lib/documents/limits";
import { isDocumentsKey, type ItineraryOption } from "@/lib/documents/types";

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 KB";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

type Props = {
  tripId: string;
  itineraryOptions: ItineraryOption[];
  onClose: () => void;
};

export function DocumentUploadForm({ tripId, itineraryOptions, onClose }: Props) {
  const toast = useToast();
  const { mutate } = useSWRConfig();

  const [title, setTitle] = useState("");
  const [type, setType] = useState<string>(DOCUMENT_TYPES[0]);
  const [itineraryItemId, setItineraryItemId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tooBig = useMemo(
    () => (file ? file.size > MAX_DOCUMENT_BYTES : false),
    [file],
  );

  async function submit() {
    if (uploading) return;
    if (!file) {
      setError("Choose a file to upload.");
      return;
    }
    if (tooBig) {
      setError("Files are capped at 10 MB.");
      return;
    }
    if (!title.trim()) {
      setError("Title the document.");
      return;
    }

    setError(null);
    setUploading(true);
    const form = new FormData();
    form.set("title", title);
    form.set("type", type);
    form.set("itineraryItemId", itineraryItemId);
    form.set("file", file);

    try {
      const response = await fetch(`/api/trips/${tripId}/documents`, {
        method: "POST",
        body: form,
      });
      const json = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !json.ok) {
        setError(json.error ?? "Could not upload that file.");
        return;
      }
      toast.success("Document added to the vault.");
      void mutate(isDocumentsKey);
      onClose();
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="new-doc.exe"
      description="Private vault: tickets, confirmations, IDs. Only the crew can see these."
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="document-upload-form"
            variant="pop"
            size="sm"
            loading={uploading}
          >
            Upload
          </Button>
        </>
      }
    >
      <form
        id="document-upload-form"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        className="flex flex-col gap-3"
      >
        <Field
          label="Title"
          hint="Airline ticket, hotel booking, passport…"
          error={error && !title.trim() ? error : undefined}
        >
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={120}
            placeholder="Pune → Goa train tickets"
            autoFocus
          />
        </Field>

        <Field label="What kind of document">
          <Select value={type} onChange={(event) => setType(event.target.value)}>
            {DOCUMENT_TYPES.map((entry) => (
              <option key={entry} value={entry}>
                {DOCUMENT_TYPE_LABELS[entry]}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Plan item"
          hint="Optional. Link it to a day of the itinerary."
        >
          <Select
            value={itineraryItemId}
            onChange={(event) => setItineraryItemId(event.target.value)}
          >
            <option value="">Not linked</option>
            {itineraryOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="File"
          error={tooBig ? "Files are capped at 10 MB." : undefined}
        >
          <label
            className={cn(
              "flex w-full cursor-pointer flex-col items-center gap-1 rounded-2xl border-2 border-dashed px-3.5 py-4 text-center transition-transform duration-150 active:translate-y-[2px]",
              file
                ? "border-electric bg-electric/5"
                : tooBig || (error && !file)
                  ? "border-hotpink bg-white/60"
                  : "border-silver-deep bg-white/70",
            )}
          >
            <input
              type="file"
              accept={[
                "application/pdf",
                "image/png",
                "image/jpeg",
                "image/webp",
                "image/gif",
                "image/heic",
                "image/heif",
              ].join(",")}
              className="sr-only"
              onChange={(event) => {
                const picked = event.target.files?.[0] ?? null;
                setFile(picked);
                if (picked && !title.trim()) {
                  setTitle(picked.name.replace(/\.[^.]+$/, ""));
                }
              }}
            />
            {file ? (
              <>
                <span className="max-w-full truncate text-sm font-extrabold text-ink">
                  {file.name}
                </span>
                <span className="text-xs font-bold text-ink-soft">
                  {formatSize(file.size)} · tap to swap
                </span>
              </>
            ) : (
              <>
                <span className="font-display text-[10px] uppercase tracking-tight text-electric-deep">
                  Drop a PDF or image here
                </span>
                <span className="text-xs font-semibold text-ink-soft">
                  Max 10 MB · PDF, PNG, JPG, WebP, GIF, HEIC
                </span>
              </>
            )}
          </label>
        </Field>

        {error && title && file && !tooBig ? (
          <p className="text-xs font-extrabold text-hotpink-deep">{error}</p>
        ) : null}

        <p className="text-xs font-semibold text-ink-soft">
          Stored in a private vault. Only the crew can preview it, and the owner
          or uploader can delete it.
        </p>
      </form>
    </Modal>
  );
}