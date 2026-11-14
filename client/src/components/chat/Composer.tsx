"use client";

import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent, type KeyboardEvent } from "react";
import { clsx } from "clsx";
import { FileText, Loader2, Paperclip, Send, X } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "@/components/Toast";
import { useSocket } from "@/components/RealtimeProvider";
import { fileSize, type ChatAttachment } from "@/lib/chat";

/**
 * The box at the bottom of a chat. Enter sends, Shift+Enter is a new line. Files are uploaded as
 * soon as they're added (button, drag and drop, or pasting an image) and sent with the message.
 * While you type, the other person sees "typing…".
 */

const MAX_FILES = 5, MAX_BYTES = 20 * 1024 * 1024, MAX_BODY = 4000;

type Pending = { key: string; name: string; size: number; preview?: string; done?: ChatAttachment; failed?: boolean };

async function upload(file: File): Promise<ChatAttachment> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await api.post("/messages/attachments", fd, { headers: { "Content-Type": "multipart/form-data" } });
  return res.data as ChatAttachment;
}
const discard = (a: ChatAttachment) => api.delete("/messages/attachments", { data: { publicId: a.publicId, resourceType: a.resourceType } }).catch(() => {});

export function Composer({ conversationId, onSend, disabledReason }: {
  conversationId: string;
  onSend: (input: { body: string; attachments: ChatAttachment[] }) => Promise<void>;
  disabledReason?: string | null;
}) {
  const socket = useSocket();
  const [text, setText] = useState("");
  const [files, setFiles] = useState<Pending[]>([]);
  const [sending, setSending] = useState(false);
  const [dragging, setDragging] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // A different chat: start clean, and throw away files that were never sent.
  const filesRef = useRef(files);
  filesRef.current = files;
  useEffect(() => {
    setText("");
    taRef.current?.focus();
    return () => { filesRef.current.forEach((f) => f.done && discard(f.done)); setFiles([]); };
  }, [conversationId]);

  // Grow with the text, up to about 8 lines.
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 180)}px`;
  }, [text]);

  // "typing…": sent when you start, renewed every few seconds, cleared after a pause or on send.
  const typingSent = useRef(0);
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const signalTyping = (on: boolean) => {
    if (!socket) return;
    if (on) {
      if (Date.now() - typingSent.current > 3000) { socket.emit("typing", { conversationId, typing: true }); typingSent.current = Date.now(); }
      if (stopTimer.current) clearTimeout(stopTimer.current);
      stopTimer.current = setTimeout(() => signalTyping(false), 4000);
    } else {
      if (stopTimer.current) clearTimeout(stopTimer.current);
      if (typingSent.current) socket.emit("typing", { conversationId, typing: false });
      typingSent.current = 0;
    }
  };
  useEffect(() => () => { if (stopTimer.current) clearTimeout(stopTimer.current); }, []);

  const addFiles = (list: FileList | File[]) => {
    const incoming = Array.from(list);
    const room = MAX_FILES - files.length;
    if (incoming.length > room) toast.warning(`You can send up to ${MAX_FILES} files at a time.`);
    for (const file of incoming.slice(0, Math.max(0, room))) {
      if (file.size > MAX_BYTES) { toast.warning(`${file.name} is too big`, { description: "Files can be up to 20 MB." }); continue; }
      const key = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const preview = file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined;
      setFiles((f) => [...f, { key, name: file.name || "image.png", size: file.size, preview }]);
      upload(file)
        .then((done) => setFiles((f) => {
          if (!f.some((x) => x.key === key)) { discard(done); return f; }   // removed while uploading
          return f.map((x) => (x.key === key ? { ...x, done } : x));
        }))
        .catch((err) => {
          setFiles((f) => f.map((x) => (x.key === key ? { ...x, failed: true } : x)));
          toast.failed(`Couldn't upload ${file.name}`, err);
        });
    }
  };
  const remove = (p: Pending) => {
    setFiles((f) => f.filter((x) => x.key !== p.key));
    if (p.done) discard(p.done);
    if (p.preview) URL.revokeObjectURL(p.preview);
  };

  const uploading = files.some((f) => !f.done && !f.failed);
  const ready = files.filter((f) => f.done).map((f) => f.done!);
  const canSend = !sending && !uploading && (text.trim().length > 0 || ready.length > 0) && text.length <= MAX_BODY;

  const send = async () => {
    if (!canSend) return;
    setSending(true);
    signalTyping(false);
    try {
      await onSend({ body: text.trim(), attachments: ready });
      files.forEach((f) => f.preview && URL.revokeObjectURL(f.preview));
      setText("");
      setFiles([]);
    } catch (err) {
      toast.failed("Couldn't send your message", err);
    } finally {
      setSending(false);
      taRef.current?.focus();
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); }
  };
  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const pasted = Array.from(e.clipboardData.files);
    if (pasted.length) { e.preventDefault(); addFiles(pasted); }
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  };

  if (disabledReason) {
    return <div className="border-t border-border px-4 py-3 text-center text-sm text-muted">{disabledReason}</div>;
  }

  return (
    <div
      className={clsx("relative border-t border-border px-3 py-3 sm:px-4", dragging && "bg-accent/5")}
      onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setDragging(true); } }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false); }}
      onDrop={onDrop}
    >
      {dragging && (
        <div className="pointer-events-none absolute inset-1 flex items-center justify-center rounded-xl border-2 border-dashed border-accent/50 text-sm font-medium text-accent">
          Drop files to attach
        </div>
      )}

      {files.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-2">
          {files.map((f) => (
            <li key={f.key} className={clsx("flex max-w-[220px] items-center gap-2 rounded-lg border px-2 py-1.5 text-xs", f.failed ? "border-red-200 bg-red-500/5" : "border-border bg-background")}>
              {f.preview
                ? <img src={f.preview} alt="" className="h-8 w-8 shrink-0 rounded object-cover" />
                : <FileText size={16} className="shrink-0 text-muted" />}
              <span className="min-w-0">
                <span className="block truncate font-medium text-foreground">{f.name}</span>
                <span className="block text-muted">{f.failed ? "Upload failed" : f.done ? fileSize(f.size) : "Uploading…"}</span>
              </span>
              {!f.done && !f.failed && <Loader2 size={13} className="shrink-0 animate-spin text-muted" />}
              <button onClick={() => remove(f)} className="shrink-0 rounded p-0.5 text-muted hover:text-foreground" aria-label={`Remove ${f.name}`}><X size={13} /></button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-end gap-2">
        <input ref={fileRef} type="file" multiple hidden onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
        <button
          onClick={() => fileRef.current?.click()} disabled={files.length >= MAX_FILES}
          className="mb-0.5 shrink-0 rounded-lg p-2 text-muted transition-colors hover:bg-foreground/5 hover:text-foreground disabled:opacity-40"
          aria-label="Attach files" title="Attach files (or drop or paste them)"
        >
          <Paperclip size={18} />
        </button>
        <textarea
          ref={taRef}
          value={text}
          rows={1}
          onChange={(e) => { setText(e.target.value); signalTyping(e.target.value.length > 0); }}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          onBlur={() => signalTyping(false)}
          placeholder="Write a message"
          aria-label="Write a message"
          className="max-h-[180px] min-h-[40px] flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm leading-relaxed text-foreground placeholder:text-muted/70 focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
        <button
          onClick={send} disabled={!canSend}
          className="mb-0.5 shrink-0 rounded-xl bg-accent p-2.5 text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
          aria-label="Send" title={uploading ? "Waiting for files to upload" : "Send (Enter)"}
        >
          {sending ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
        </button>
      </div>
      {text.length > MAX_BODY - 200 && (
        <p className={clsx("mt-1 text-right text-[11px]", text.length > MAX_BODY ? "text-red-600" : "text-muted")}>{text.length.toLocaleString()} / {MAX_BODY.toLocaleString()}</p>
      )}
    </div>
  );
}
