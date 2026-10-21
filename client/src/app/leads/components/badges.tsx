import { Lock, Users } from "lucide-react";
import { STATUS_COLORS, STATUS_LABEL, type Lead } from "./lib";

export function StatusBadge({ value }: { value: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${STATUS_COLORS[value] ?? "bg-foreground/5 text-muted"}`}>
      {STATUS_LABEL[value] ?? value}
    </span>
  );
}

export function VisibilityBadge({ value }: { value: Lead["visibility"] }) {
  return value === "PUBLIC" ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-sky-500/10 text-sky-700"><Users size={11} /> Shared</span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-foreground/5 text-muted"><Lock size={11} /> Private</span>
  );
}
