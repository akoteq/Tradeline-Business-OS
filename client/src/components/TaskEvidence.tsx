"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, ExternalLink, FileText, Film, Image as ImageIcon, Link2, Paperclip, X } from "lucide-react";
import { fmtFileSize, TaskAttachment } from "@/app/(app)/tasks/components/task-utils";

/**
 * What a manager checks before approving finished work: every link and file on the task, with
 * files opening in a viewer on the page (images, PDFs, video, audio, text and Office documents)
 * so they can check the work without downloading anything. Links open in a new tab, since most
 * sites refuse to be shown inside another page.
 */

type Preview = "image" | "pdf" | "video" | "audio" | "text" | "office" | "none";

const ext = (a: TaskAttachment) => (a.name.split(".").pop() ?? a.url.split("?")[0].split(".").pop() ?? "").toLowerCase();

function previewOf(a: TaskAttachment): Preview {
  if (a.kind !== "FILE") return "none";
  const t = (a.fileType ?? "").toLowerCase();
  const e = ext(a);
  if (t === "application/pdf" || e === "pdf") return "pdf";
  if (t.startsWith("image/")) return "image";
  if (t.startsWith("video/")) return "video";
  if (t.startsWith("audio/")) return "audio";
  if (t.startsWith("text/") || ["txt", "csv", "md"].includes(e)) return "text";
  if (["doc", "docx", "xls", "xlsx", "ppt", "pptx"].includes(e)) return "office";
  return "none";
}

// Cloudinary renders a small thumbnail of an image, or of a PDF's first page.
function thumbOf(a: TaskAttachment): string | null {
  const p = previewOf(a);
  if ((p !== "image" && p !== "pdf") || !a.url.includes("/upload/")) return null;
  const url = a.url.replace("/upload/", "/upload/c_fill,w_96,h_96,pg_1,f_auto,q_auto/");
  return p === "pdf" ? url.replace(/\.pdf($|\?)/i, ".jpg$1") : url;
}

const KIND_LABEL: Record<Preview, string> = {
  image: "Image", pdf: "PDF", video: "Video", audio: "Audio", text: "Text", office: "Document", none: "File",
};

function KindIcon({ a, size = 16 }: { a: TaskAttachment; size?: number }) {
  if (a.kind === "LINK") return <Link2 size={size} />;
  const p = previewOf(a);
  if (p === "image") return <ImageIcon size={size} />;
  if (p === "video") return <Film size={size} />;
  if (p === "pdf" || p === "text" || p === "office") return <FileText size={size} />;
  return <Paperclip size={size} />;
}

const host = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; } };
const fmtDay = (d?: string) => {
  if (!d) return "";
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? "" : dt.toLocaleDateString("en-GH", { month: "short", day: "numeric" });
};

export function TaskEvidence({ items }: { items?: TaskAttachment[] }) {
  const list = items ?? [];
  const [open, setOpen] = useState<number | null>(null);
  const files = list.filter((a) => a.kind === "FILE");

  if (!list.length) {
    return (
      <p className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted">
        No links or files attached. If you need proof the work was done, reject it and ask for it.
      </p>
    );
  }

  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
        Evidence · {list.length} {list.length === 1 ? "item" : "items"}
      </p>
      <ul className="divide-y divide-border/70 rounded-lg border border-border">
        {list.map((a) => {
          const thumb = thumbOf(a);
          const meta = a.kind === "LINK"
            ? host(a.url)
            : [KIND_LABEL[previewOf(a)], fmtFileSize(a.fileSize), fmtDay(a.addedAt) && `added ${fmtDay(a.addedAt)}`].filter(Boolean).join(" · ");
          const fileIndex = files.indexOf(a);
          return (
            <li key={`${a.kind}-${a.publicId ?? a.url}`} className="flex items-center gap-3 px-3 py-2">
              {thumb ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thumb} alt="" className="h-10 w-10 shrink-0 rounded-md border border-border object-cover bg-background" loading="lazy" />
              ) : (
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-accent/10 text-accent">
                  <KindIcon a={a} />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground" title={a.name}>{a.name}</p>
                <p className="truncate text-xs text-muted" title={a.kind === "LINK" ? a.url : undefined}>{meta}</p>
              </div>
              {a.kind === "FILE" ? (
                <button
                  type="button"
                  onClick={() => setOpen(fileIndex)}
                  className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-accent/40 hover:text-accent"
                >
                  View
                </button>
              ) : (
                <a
                  href={a.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:border-accent/40 hover:text-accent"
                >
                  Open <ExternalLink size={12} />
                </a>
              )}
            </li>
          );
        })}
      </ul>
      {open !== null && files[open] && <Viewer files={files} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />}
    </div>
  );
}

function Viewer({ files, index, onIndex, onClose }: { files: TaskAttachment[]; index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const a = files[index];
  const p = previewOf(a);
  const many = files.length > 1;
  const go = useCallback((d: number) => onIndex((index + d + files.length) % files.length), [index, files.length, onIndex]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (many && e.key === "ArrowRight") go(1);
      else if (many && e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = overflow; };
  }, [go, many, onClose]);

  const body = (() => {
    switch (p) {
      // eslint-disable-next-line @next/next/no-img-element
      case "image": return <img src={a.url} alt={a.name} className="max-h-full max-w-full object-contain" />;
      case "pdf":
      case "text": return <iframe src={a.url} title={a.name} className="h-full w-full rounded-lg bg-white" />;
      case "video": return <video src={a.url} controls className="max-h-full max-w-full" />;
      case "audio": return <audio src={a.url} controls className="w-full max-w-md" />;
      // Office files are shown by Microsoft's online viewer, which loads the file from its public link.
      case "office": return <iframe src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(a.url)}`} title={a.name} className="h-full w-full rounded-lg bg-white" />;
      default: return (
        <div className="max-w-sm text-center text-sm text-white/80">
          <Paperclip size={28} className="mx-auto mb-3 text-white/60" />
          This kind of file can&apos;t be shown here. Open it in a new tab to check it.
        </div>
      );
    }
  })();

  return createPortal(
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/85 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`Viewing ${a.name}`}>
      <div className="flex items-center gap-3 px-4 py-3 text-white">
        <KindIcon a={a} size={18} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{a.name}</p>
          <p className="text-xs text-white/60">
            {[KIND_LABEL[p], fmtFileSize(a.fileSize), many ? `${index + 1} of ${files.length}` : ""].filter(Boolean).join(" · ")}
          </p>
        </div>
        <a
          href={a.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/25 px-3 py-1.5 text-xs font-semibold hover:bg-white/10"
        >
          Open in new tab <ExternalLink size={12} />
        </a>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 hover:bg-white/10">
          <X size={20} />
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-4 md:px-16">
        {body}
        {many && (
          <>
            <button type="button" onClick={() => go(-1)} aria-label="Previous file" className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 md:left-4">
              <ChevronLeft size={22} />
            </button>
            <button type="button" onClick={() => go(1)} aria-label="Next file" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 md:right-4">
              <ChevronRight size={22} />
            </button>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
