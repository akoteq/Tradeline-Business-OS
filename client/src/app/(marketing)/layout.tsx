import type { Metadata } from "next";
import { MotionProvider } from "@/components/marketing/MotionProvider";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { SiteHeader } from "@/components/marketing/SiteHeader";

/**
 * Public pages: no auth, no data fetching, no sidebar. This is the only place that opts in to
 * search indexing (the root layout defaults to noindex).
 */
export const metadata: Metadata = {
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
};

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <MotionProvider>
      {/* Without JavaScript the hero would stay hidden waiting for its entrance. Show it. */}
      <noscript>
        <style>{`[data-reveal]{opacity:1!important;transform:none!important}`}</style>
      </noscript>
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-base focus:text-accent-foreground"
      >
        Skip to content
      </a>
      <SiteHeader />
      <main id="content" tabIndex={-1} className="outline-none">
        {children}
      </main>
      <SiteFooter />
    </MotionProvider>
  );
}
