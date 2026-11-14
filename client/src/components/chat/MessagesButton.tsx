"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { MessageCircle } from "lucide-react";
import { useUnreadMessages } from "./ChatListener";

/** The way into Messages, with the unread count. "row" is the sidebar row; "icon" the mobile header button. */
export function MessagesButton({ variant = "icon", rail = false, onNavigate, className }: {
  variant?: "icon" | "row"; rail?: boolean; onNavigate?: () => void; className?: string;
}) {
  const unread = useUnreadMessages();
  const pathname = usePathname();
  const active = pathname === "/messages";
  const label = unread ? `Messages, ${unread} unread` : "Messages";
  const badge = unread > 0 && (
    <span className="min-w-[18px] rounded-full bg-accent px-1.5 text-center text-[11px] font-semibold leading-[18px] text-accent-foreground tabular-nums">
      {unread > 99 ? "99+" : unread}
    </span>
  );
  if (variant === "row") {
    return (
      <Link
        href="/messages" onClick={onNavigate} aria-label={label} title={rail ? label : undefined} aria-current={active ? "page" : undefined}
        className={clsx(
          "relative w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30",
          active ? "bg-foreground/[0.06] text-foreground" : "text-muted hover:bg-foreground/[0.05] hover:text-foreground",
          className,
        )}
      >
        <MessageCircle size={15} strokeWidth={1.75} className="shrink-0" />
        <span className={clsx("flex-1 text-left whitespace-nowrap transition-opacity", rail && "md:opacity-0")}>Messages</span>
        {rail ? unread > 0 && <span className="absolute left-6 top-1.5 h-2 w-2 rounded-full bg-accent" /> : badge}
      </Link>
    );
  }
  return (
    <Link href="/messages" aria-label={label} title={label} className={clsx("relative p-1.5 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors", className)}>
      <MessageCircle size={20} />
      {unread > 0 && <span className="absolute -right-0.5 -top-0.5">{badge}</span>}
    </Link>
  );
}
