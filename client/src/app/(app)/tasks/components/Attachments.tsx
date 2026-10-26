"use client";

import { useRef, useState } from "react";
import { clsx } from "clsx";
import { FileText, Link2, Loader2, Paperclip, Upload, X } from "lucide-react";
import { api } from "@/lib/api";
import { apiError, fmtFileSize, type TaskAttachment } from "./task-utils";

export const MAX_ATTACHMENTS = 20;
export const MAX_FILE_BYTES = 20 * 1024 * 1024;

const inputClass =
  "w-full bg-background border border-transparent rounded-xl px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:bg-surface focus:border-accent focus:ring-2 focus:ring-accent/20 transition-colors";

// "docs.google.com/…" → a link anyone can open; bare domains get https:// in front.
function normaliseUrl(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(v) ? v : `https://${v}`);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

/** Uploads one file (POST /tasks/attachments) and returns it, ready to be saved on a task. */
export async function uploadAttachment(file: File): Promise<TaskAttachment> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await api.post("/tasks/attachments", fd, { headers: { "Content-Type": "multipart/form-data" } });
  return res.data as TaskAttachment;
}

/** Throws away files uploaded in this form that never got saved on a task. Best effort. */
export function discardUploads(files: TaskAttachment[]) {
  for (const f of files) {
    if (f.kind === "FILE" && f.publicId) api.delete("/tasks/attachments", { data: { publicId: f.publicId, resourceType: f.resourceType } }).catch(() => {});
  }
}

/**
 * Links and files for a task, in the add / edit form. Files upload to Cloudinary as soon as
 * they're picked (POST /tasks/attachments) and are saved with the task when the form is.
 * `onUploaded` reports each new upload so the form can throw it away if it's cancelled.
 */
export function AttachmentsField({ value, onChange, onUploaded }: {
  value: TaskAttachment[];
  onChange: (next: TaskAttachment[]) => void;
  onUploaded: (file: TaskAttachment) => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [addingLink, setAddingLink] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkName, setLinkName] = useState("");
  const [uploading, setUploading] = useState<string[]>([]);
  const [error, setError] = useState("");
  // Uploads finish one after another; this keeps each one appending to the latest list.
  const latest = useRef(value);
  latest.current = value;

  const room = MAX_ATTACHMENTS - value.length - uploading.length;

  const addLink = () => {
    const url = normaliseUrl(linkUrl);
    if (!url) { setError("That doesn't look like a link. Paste the full address, e.g. https://…"); return; }
    if (value.some((a) => a.kind === "LINK" && a.url === url)) { setError("That link is already added."); return; }
    if (room <= 0) { setError(`A task can have up to ${MAX_ATTACHMENTS} links and files.`); return; }
    onChange([...value, { kind: "LINK", url, name: linkName.trim() || new URL(url).hostname }]);
    setLinkUrl(""); setLinkName(""); setAddingLink(false); setError("");
  };

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setError("");
    const picked = Array.from(files);
    const tooBig = picked.filter((f) => f.size > MAX_FILE_BYTES);
    const ok = picked.filter((f) => f.size <= MAX_FILE_BYTES).slice(0, Math.max(0, room));
    if (tooBig.length) setError(`${tooBig.map((f) => f.name).join(", ")} ${tooBig.length === 1 ? "is" : "are"} over 20 MB.`);
    else if (ok.length < picked.length) setError(`A task can have up to ${MAX_ATTACHMENTS} links and files.`);
    for (const file of ok) {
      setUploading((u) => [...u, file.name]);
      try {
        const saved = await uploadAttachment(file);
        onUploaded(saved);
        onChange([...latest.current, saved]);
      } catch (err) {
        setError(apiError(err, `We couldn't upload ${file.name}. Please try again.`));
      } finally {
        setUploading((u) => u.filter((n) => n !== file.name));
      }
    }
    if (fileInput.current) fileInput.current.value = "";
  };

  const remove = (i: number) => onChange(value.filter((_, j) => j !== i));

  return (
    <div className="space-y-2">
      {(value.length > 0 || uploading.length > 0) && (
        <ul className="rounded-xl border border-border divide-y divide-border/60">
          {value.map((a, i) => (
            <li key={`${a.kind}-${a.publicId ?? a.url}`} className="flex items-center gap-2.5 px-3 py-2 text-sm">
              {a.kind === "LINK" ? <Link2 size={15} className="shrink-0 text-accent" /> : <FileText size={15} className="shrink-0 text-accent" />}
              <a href={a.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate text-foreground hover:text-accent hover:underline" title={a.url}>
                {a.name}
              </a>
              <span className="shrink-0 text-xs text-muted">{a.kind === "FILE" ? fmtFileSize(a.fileSize) : "Link"}</span>
              <button type="button" onClick={() => remove(i)} aria-label={`Remove ${a.name}`} className="shrink-0 rounded-md p-1 text-muted hover:bg-primary/5 hover:text-red-600">
                <X size={14} />
              </button>
            </li>
          ))}
          {uploading.map((name) => (
            <li key={`uploading-${name}`} className="flex items-center gap-2.5 px-3 py-2 text-sm text-muted">
              <Loader2 size={15} className="shrink-0 animate-spin text-accent" />
              <span className="min-w-0 flex-1 truncate">{name}</span>
              <span className="shrink-0 text-xs">Uploading…</span>
            </li>
          ))}
        </ul>
      )}

      {addingLink ? (
        <div className="space-y-2 rounded-xl border border-border p-2.5">
          <input
            autoFocus
            value={linkUrl}
            onChange={(e) => { setLinkUrl(e.target.value); if (error) setError(""); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLink(); } if (e.key === "Escape") setAddingLink(false); }}
            placeholder="Paste a link, e.g. https://docs.google.com/…"
            className={inputClass}
          />
          <input
            value={linkName}
            onChange={(e) => setLinkName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLink(); } }}
            placeholder="What is it? (optional), e.g. Brief from the client"
            className={inputClass}
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { setAddingLink(false); setLinkUrl(""); setLinkName(""); setError(""); }} className="px-3 py-1.5 rounded-lg text-sm text-muted hover:text-foreground">
              Cancel
            </button>
            <button type="button" onClick={addLink} disabled={!linkUrl.trim()} className="px-3.5 py-1.5 rounded-lg bg-accent text-accent-foreground text-sm font-semibold hover:opacity-90 disabled:opacity-40">
              Add link
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => { setAddingLink(true); setError(""); }}
            disabled={room <= 0}
            className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-border px-3.5 py-2 text-sm text-foreground hover:border-accent hover:text-accent disabled:opacity-40 transition-colors"
          >
            <Link2 size={15} /> Add a link
          </button>
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={room <= 0}
            className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-border px-3.5 py-2 text-sm text-foreground hover:border-accent hover:text-accent disabled:opacity-40 transition-colors"
          >
            <Upload size={15} /> Upload files
          </button>
          <input ref={fileInput} type="file" multiple hidden onChange={(e) => upload(e.target.files)} />
        </div>
      )}

      {error ? <p className="text-xs text-red-600">{error}</p> : <p className="text-xs text-muted">Briefs, drafts, or proof it&apos;s done. Up to 20 MB a file.</p>}
    </div>
  );
}

/** A task's links and files in a list or card: the first few as chips, then "+N more". */
export function AttachmentChips({ items, max = 3, className }: { items?: TaskAttachment[]; max?: number; className?: string }) {
  if (!items?.length) return null;
  const shown = items.slice(0, max);
  return (
    <div className={clsx("flex flex-wrap items-center gap-1.5", className)}>
      {shown.map((a) => (
        <a
          key={`${a.kind}-${a.publicId ?? a.url}`}
          href={a.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          title={a.url}
          className="inline-flex max-w-[180px] items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-xs text-foreground/80 hover:border-accent/40 hover:text-accent"
        >
          {a.kind === "LINK" ? <Link2 size={11} className="shrink-0" /> : <Paperclip size={11} className="shrink-0" />}
          <span className="truncate">{a.name}</span>
        </a>
      ))}
      {items.length > max && <span className="text-xs text-muted">+{items.length - max} more</span>}
    </div>
  );
}
