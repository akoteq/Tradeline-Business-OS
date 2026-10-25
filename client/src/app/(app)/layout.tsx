import { Providers } from "@/components/Providers";
import { AppShell } from "@/components/AppShell";

/**
 * Everything signed-in lives under this group: auth, data fetching, sidebar, alerts, assistant.
 * The group name "(app)" is not part of any URL, so no route paths change.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <AppShell>{children}</AppShell>
    </Providers>
  );
}
