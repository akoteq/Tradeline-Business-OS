import type { Metadata } from "next";
import { Geist, Geist_Mono, Sora } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { AppShell } from "@/components/AppShell";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
});

const siteUrl = "https://trunqo.com";
const siteName = "Trunqo";
const siteDescription =
  "Trunqo is the business operating system for owners running more than one company. One alert feed, one accounting engine, and a delegation model that scopes access down to what each person owns — delivered straight to WhatsApp and email the moment it matters.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${siteName} — The trunk your businesses grow from`,
    template: `%s · ${siteName}`,
  },
  description: siteDescription,
  keywords: [
    "business operating system",
    "multi-business management",
    "delegation software",
    "accounting automation",
    "business alerts WhatsApp",
    "SME management platform",
    "holding company software",
  ],
  authors: [{ name: siteName }],
  creator: siteName,
  publisher: siteName,
  category: "Business software",
  applicationName: siteName,
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: siteUrl,
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
    ],
    shortcut: "/favicon.ico",
    apple: { url: "/apple-touch-icon.png", sizes: "180x180" },
  },
  manifest: "/site.webmanifest",
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName,
    title: `${siteName} — The trunk your businesses grow from`,
    description: siteDescription,
    locale: "en_US",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: `${siteName} — the trunk your businesses grow from`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteName} — The trunk your businesses grow from`,
    description: siteDescription,
    images: ["/og-image.png"],
  },
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
      className={`${geistSans.variable} ${geistMono.variable} ${sora.variable} h-full`}
      suppressHydrationWarning
    >
      <body
        className="min-h-full antialiased bg-background text-foreground font-sans"
        suppressHydrationWarning
      >
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}