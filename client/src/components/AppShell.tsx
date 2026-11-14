"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X } from "lucide-react";
import Sidebar from "./Sidebar";
import { AssistantLauncher } from "./assistant/AssistantPanel";
import { Toaster } from "./Toast";
import { ConfirmHost } from "./Confirm";
import { useAuth } from "./AuthProvider";
import { isExternal, externalCanOpen } from "@/lib/auth";
import { NotificationBell, NotificationsListener, NotificationsPanel } from "./notifications/Notifications";

const NO_SHELL = ["/login", "/change-password"];
const HIDDEN_KEY = "sidebar-hidden";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const external = isExternal(user);
  // Outside collaborators only have their projects and tasks; anything else sends them there.
  const blocked = external && !NO_SHELL.includes(pathname) && !externalCanOpen(pathname);
  useEffect(() => { if (blocked) router.replace("/projects"); }, [blocked, router]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const closeNotifications = useCallback(() => setNotificationsOpen(false), []);
  // Desktop only, remembered per browser. Read after mount so the server render matches.
  const [sidebarHidden, setSidebarHidden] = useState(false);
  useEffect(() => {
    try { setSidebarHidden(localStorage.getItem(HIDDEN_KEY) === "1"); } catch { /* storage blocked */ }
  }, []);
  const toggleHidden = () => setSidebarHidden((h) => {
    try { localStorage.setItem(HIDDEN_KEY, h ? "0" : "1"); } catch { /* storage blocked */ }
    return !h;
  });

  if (NO_SHELL.includes(pathname)) return <>{children}<Toaster /><ConfirmHost /></>;

  return (
    <div className="flex min-h-screen">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar
        mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} hidden={sidebarHidden} onToggleHidden={toggleHidden}
        onOpenNotifications={() => setNotificationsOpen(true)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <header className="md:hidden sticky top-0 z-10 flex items-center gap-3 h-14 px-4 bg-surface border-b border-border shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <span className="font-semibold text-gray-900 text-sm truncate">Tradeline Business Operating System</span>
          <NotificationBell className="ml-auto shrink-0" onOpen={() => setNotificationsOpen(true)} />
        </header>

        {/* Deadlines, deals needing attention and KPI alerts live on the home page (Attention tab),
            not in a banner over every page. */}
        <main className="flex-1 overflow-auto">{blocked ? null : children}</main>
      </div>

      {!external && <AssistantLauncher />}
      <NotificationsListener />
      {notificationsOpen && <NotificationsPanel onClose={closeNotifications} />}
      <Toaster />
      <ConfirmHost />
    </div>
  );
}
