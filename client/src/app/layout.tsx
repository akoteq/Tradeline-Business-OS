import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { site } from "@/lib/site";

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

/**
 * The root layout is deliberately thin: fonts, <html>, <body> and defaults every route inherits.
 *
 *   app/(marketing)  public pages. No auth, no sidebar, indexable.
 *   app/(app)        the signed-in product. Providers + AppShell live in its layout.
 *
 * Default is "do not index": anything new is private until a layout opts in. The landing page
 * does that in app/(marketing)/layout.tsx.
 */
export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: site.name,
    template: `%s · ${site.name}`,
  },
  applicationName: site.name,
  robots: { index: false, follow: false },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
    ],
    shortcut: "/favicon.ico",
    apple: { url: "/apple-touch-icon.png", sizes: "180x180" },
  },
  manifest: "/site.webmanifest",
  formatDetection: {
    telephone: false,
  },
};

export const viewport = {
  themeColor: "#f5f5f3",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${plexSans.variable} ${plexMono.variable} h-full`}
      suppressHydrationWarning
    >
      <body
        className="min-h-full antialiased bg-background text-foreground font-sans"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}