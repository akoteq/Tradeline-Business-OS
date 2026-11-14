"use client";

import { clsx } from "clsx";
import { useOnline } from "./useChatStore";

/** A person's initial in a circle, with a green dot when they're online. */
export function ChatAvatar({ userId, name, size = "md" }: { userId?: string | null; name: string; size?: "sm" | "md" }) {
  const online = useOnline(userId);
  return (
    <span className={clsx("relative inline-flex shrink-0", size === "sm" ? "h-8 w-8" : "h-10 w-10")}>
      <span className={clsx(
        "flex h-full w-full items-center justify-center rounded-full bg-foreground/10 font-semibold text-foreground/70",
        size === "sm" ? "text-xs" : "text-sm",
      )}>
        {(name.trim().charAt(0) || "?").toUpperCase()}
      </span>
      {online && (
        <span
          className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-surface bg-emerald-500"
          role="img" aria-label="Online" title="Online"
        />
      )}
    </span>
  );
}
