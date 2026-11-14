"use client";

import { clsx } from "clsx";
import { useAuth } from "@/components/AuthProvider";
import { segments } from "@/lib/mentions";

/**
 * Stored text with its @[Name](id) mentions shown as chips. `names` (id → current name, from the
 * API) wins over the name saved in the text, so a renamed person shows correctly. A mention of
 * you is tinted stronger, so you can spot it.
 */
export function MentionText({ value, names, className }: { value: string | null | undefined; names?: Record<string, string | null>; className?: string }) {
  const { user } = useAuth();
  return (
    <span className={clsx("whitespace-pre-wrap break-words", className)}>
      {segments(value).map((s, i) => {
        if ("text" in s) return <span key={i}>{s.text}</span>;
        const me = s.mention.id === user?.id;
        return (
          <span
            key={i}
            className={clsx("rounded px-0.5 font-medium", me ? "bg-accent/20 text-accent" : "bg-accent/10 text-foreground")}
          >
            @{names?.[s.mention.id] || s.mention.name}
          </span>
        );
      })}
    </span>
  );
}
