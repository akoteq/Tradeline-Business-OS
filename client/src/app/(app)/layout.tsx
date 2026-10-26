import { Providers } from "@/components/Providers";
import { AppShell } from "@/components/AppShell";

/**
 * Everything signed-in lives under this group: auth, data fetching, sidebar, alerts, assistant.
 * The group name "(app)" is not part of any URL, so no route paths change.
 */
// Applies a saved dark theme before the page paints, so it doesn't flash light first. ThemeToggle
// in the top bar owns the choice (same storage key); this only reads it.
const themeScript = `try{if(localStorage.getItem("trunqo.theme")==="dark")document.documentElement.dataset.theme="dark"}catch(e){}`;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      <AppShell>{children}</AppShell>
    </Providers>
  );
}
